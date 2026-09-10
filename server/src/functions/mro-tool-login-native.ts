import crypto from "node:crypto";
import type { Request, Response } from "express";
import { adminQuery } from "../db.js";

interface LoginBody {
  action?: unknown;
  username?: unknown;
  email?: unknown;
  identifier?: unknown;
  password?: unknown;
  instagram?: unknown;
  instagram_username?: unknown;
}

interface MroUserRow {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  password_hash: string | null;
  password_plain: string | null;
  plan_accounts: number;
  extra_accounts: number | null;
  expiration_days: number;
  expires_at: Date | string | null;
  source: string | null;
  is_active: boolean;
  trials_used: number;
  trials_period_start: Date | string;
  last_access: Date | string | null;
  created_at: Date | string;
}

interface MroAccountRow {
  id: string;
  user_id: string;
  instagram_username: string;
  is_trial: boolean;
  trial_expires_at: Date | string | null;
  created_at: Date | string;
}

const LIFETIME_DAYS = 999999;
const MONTHLY_TRIALS = 5;
const RENEWAL_WHATSAPP_LINK =
  "https://wa.me/555192835863?text=" +
  encodeURIComponent("Olá vim pelo renda extra, já usei 30 dias gostaria de saber sobre o desconto.");

function parseBody(body: unknown): LoginBody | null {
  try {
    if (Buffer.isBuffer(body)) return JSON.parse(body.toString("utf8")) as LoginBody;
    if (typeof body === "string") return JSON.parse(body) as LoginBody;
    if (body && typeof body === "object") return body as LoginBody;
    return null;
  } catch {
    return null;
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const leftDigest = crypto.createHash("sha256").update(left).digest();
  const rightDigest = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

function normalizeInstagram(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/^@/, "");
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function identifierFingerprint(identifier: string): string {
  return crypto.createHash("sha256").update(identifier).digest("hex").slice(0, 12);
}

function totalSlots(user: MroUserRow): number {
  return Math.max(0, Number(user.plan_accounts) || 0) + Math.max(0, Number(user.extra_accounts) || 0);
}

function planInfo(user: MroUserRow) {
  const lifetime = user.expiration_days >= LIFETIME_DAYS;
  const parsedExpiration = user.expires_at ? new Date(user.expires_at) : null;
  const expiresAt = parsedExpiration && !Number.isNaN(parsedExpiration.getTime()) ? parsedExpiration : null;
  const timeExpired = !lifetime && Boolean(expiresAt && expiresAt.getTime() <= Date.now());
  const daysRemaining = lifetime
    ? LIFETIME_DAYS
    : expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
      : Math.max(0, Number(user.expiration_days) || 0);

  return {
    plan_type: lifetime ? "vitalicio" : user.expiration_days > 365 ? "anual+" : user.expiration_days > 31 ? "anual" : "mensal",
    lifetime,
    source: user.source ?? null,
    expires_at: expiresAt?.toISOString() ?? null,
    days_remaining: daysRemaining,
    expired: !lifetime && (timeExpired || daysRemaining <= 0),
    access_allowed: user.is_active && !timeExpired && (lifetime || daysRemaining > 0),
  };
}

async function resolveInstagram(user: MroUserRow, instagram: string) {
  const [accounts, freeTrials, profiles] = await Promise.all([
    adminQuery<MroAccountRow>(
      `SELECT id, user_id, instagram_username, is_trial, trial_expires_at, created_at
         FROM public.mro_tool_accounts
        WHERE user_id = $1 AND lower(regexp_replace(instagram_username, '^@', '')) = $2
        LIMIT 1`,
      [user.id, instagram],
    ),
    adminQuery<{ expires_at: Date | string; instagram_removed: boolean | null; generated_username: string; email: string }>(
      `SELECT expires_at, instagram_removed, generated_username, email
         FROM public.free_trial_registrations
        WHERE lower(regexp_replace(instagram_username, '^@', '')) = $1
          AND COALESCE(instagram_removed, false) = false
          AND expires_at > now()
          AND (lower(generated_username) = lower($2) OR lower(email) = lower(COALESCE($3, '')))
        LIMIT 1`,
      [instagram, user.username, user.email],
    ),
    adminQuery<{ instagram_username: string }>(
      `SELECT instagram_username
         FROM public.squarecloud_user_profiles
        WHERE lower(regexp_replace(instagram_username, '^@', '')) = $1
          AND lower(squarecloud_username) = lower($2)
        LIMIT 1`,
      [instagram, user.username],
    ),
  ]);

  const account = accounts[0];
  if (account) {
    return {
      registered: true,
      source: account.is_trial ? "trial_account" : "plan_account",
      is_trial: account.is_trial,
      trial_expires_at: account.trial_expires_at,
    };
  }
  if (freeTrials[0]) {
    return { registered: true, source: "free_trial", is_trial: true, trial_expires_at: freeTrials[0].expires_at };
  }
  if (profiles[0]) {
    return { registered: true, source: "instagram_area", is_trial: false, trial_expires_at: null };
  }
  return { registered: false, source: null, is_trial: false, trial_expires_at: null };
}

/**
 * Atende somente o login da Ferramenta MRO diretamente no PostgreSQL.
 * As demais ações continuam na função original, sem alterar seu contrato.
 */
export async function handleNativeMroToolLogin(req: Request, res: Response): Promise<boolean> {
  if (req.method !== "POST") return false;
  const body = parseBody(req.body);
  const requestId = String(res.getHeader("X-MRO-Request-Id") ?? crypto.randomUUID());
  const bodyBytes = Buffer.isBuffer(req.body)
    ? req.body.byteLength
    : Buffer.byteLength(typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));

  if (!body) {
    console.warn(
      `[mro-login:${requestId}] etapa=parse_body resultado=invalido bytes=${bodyBytes} ` +
        `content_type=${JSON.stringify(req.header("content-type") ?? "ausente")}`,
    );
    return false;
  }
  if (body.action !== "login") {
    console.info(
      `[mro-login:${requestId}] etapa=roteamento resultado=encaminhado action=${JSON.stringify(String(body.action ?? "ausente").slice(0, 80))}`,
    );
    return false;
  }

  const identifier = String(body.username ?? body.email ?? body.identifier ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fingerprint = identifier ? identifierFingerprint(identifier) : "ausente";
  res.setHeader("X-MRO-Handler", "native-postgresql-login");
  console.info(
    `[mro-login:${requestId}] etapa=recebido handler=native-postgresql-login ` +
      `identifier_fp=${fingerprint} instagram_enviado=${Boolean(body.instagram ?? body.instagram_username)} bytes=${bodyBytes}`,
  );
  if (!identifier || !password || identifier.length > 255 || password.length > 255) {
    console.warn(`[mro-login:${requestId}] etapa=validacao resultado=entrada_invalida identifier_fp=${fingerprint}`);
    res.status(400).json({ success: false, error: "Usuário/email e senha são obrigatórios" });
    return true;
  }

  try {
    const users = await adminQuery<MroUserRow>(
      `SELECT id, username, email, name, password_hash, password_plain, plan_accounts,
              extra_accounts, expiration_days, expires_at, source, is_active,
              trials_used, trials_period_start, last_access, created_at
         FROM public.mro_tool_users
        WHERE lower(username) = $1 OR lower(COALESCE(email, '')) = $1
        LIMIT 1`,
      [identifier],
    );
    let user = users[0];
    console.info(
      `[mro-login:${requestId}] etapa=consulta_usuario resultado=${user ? "encontrado" : "nao_encontrado"} identifier_fp=${fingerprint}`,
    );
    const expectedHash = sha256(password);
    const hashMatches = Boolean(user?.password_hash && safeEqual(expectedHash, user.password_hash));
    const plainMatches = Boolean(user?.password_plain && safeEqual(password, user.password_plain));

    if (!user || (!hashMatches && !plainMatches)) {
      console.warn(
        `[mro-login:${requestId}] etapa=senha resultado=recusado motivo=credenciais_invalidas ` +
          `identifier_fp=${fingerprint} usuario_encontrado=${Boolean(user)} hash_presente=${Boolean(user?.password_hash)} ` +
          `legado_presente=${Boolean(user?.password_plain)}`,
      );
      res.status(200).json({ success: false, error: "Usuário ou senha incorretos" });
      return true;
    }

    if (plainMatches && !hashMatches) {
      await adminQuery("UPDATE public.mro_tool_users SET password_hash = $2, updated_at = now() WHERE id = $1", [
        user.id,
        expectedHash,
      ]);
      console.info(`[mro-login:${requestId}] etapa=senha resultado=migrado_para_sha256 user_id=${user.id}`);
    }

    const info = planInfo(user);
    console.info(
      `[mro-login:${requestId}] etapa=plano ativo=${user.is_active} expirado=${info.expired} ` +
        `acesso=${info.access_allowed} user_id=${user.id}`,
    );
    if (!info.access_allowed) {
      res.status(200).json({
        success: false,
        error: info.expired
          ? "Seu plano expirou. Contrate um novo plano para voltar a usar a ferramenta."
          : "Acesso expirado ou desativado",
        expired: info.expired,
        needs_renewal: true,
        whatsapp: RENEWAL_WHATSAPP_LINK,
      });
      return true;
    }

    const currentMonth = monthStart();
    const storedPeriod = new Date(user.trials_period_start).toISOString().slice(0, 10);
    if (storedPeriod < currentMonth) {
      await adminQuery(
        "UPDATE public.mro_tool_users SET trials_used = 0, trials_period_start = $2 WHERE id = $1",
        [user.id, currentMonth],
      );
      user = { ...user, trials_used: 0, trials_period_start: currentMonth };
    }

    const instagram = normalizeInstagram(body.instagram ?? body.instagram_username);
    const instagramCheck = instagram ? await resolveInstagram(user, instagram) : null;
    console.info(
      `[mro-login:${requestId}] etapa=instagram enviado=${Boolean(instagram)} ` +
        `registrado=${instagramCheck?.registered ?? "nao_verificado"} fonte=${instagramCheck?.source ?? "nenhuma"} user_id=${user.id}`,
    );
    if (instagramCheck && !instagramCheck.registered) {
      res.status(200).json({
        success: false,
        instagram_not_registered: true,
        instagram,
        error: `O Instagram @${instagram} não está cadastrado na sua conta. Cadastre o perfil na área /instagram antes de usar a ferramenta.`,
      });
      return true;
    }

    const accounts = await adminQuery<MroAccountRow>(
      `SELECT id, user_id, instagram_username, is_trial, trial_expires_at, created_at
         FROM public.mro_tool_accounts WHERE user_id = $1 ORDER BY created_at ASC`,
      [user.id],
    );
    await adminQuery("UPDATE public.mro_tool_users SET last_access = now() WHERE id = $1", [user.id]);

    const fixedAccounts = accounts.filter((account) => !account.is_trial);
    const trialAccounts = accounts.filter((account) => account.is_trial);
    const payload = {
      success: true,
      ...(instagramCheck
        ? { instagram_verified: true, instagram: { username: instagram, ...instagramCheck } }
        : {}),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        is_active: user.is_active,
        plan_accounts: Math.max(0, Number(user.plan_accounts) || 0),
        extra_accounts: Math.max(0, Number(user.extra_accounts) || 0),
        total_accounts: totalSlots(user),
        expiration_days: Math.max(0, Number(user.expiration_days) || 0),
        last_access: user.last_access,
        created_at: user.created_at,
        ...info,
      },
      accounts: fixedAccounts,
      trial_accounts: trialAccounts,
      trials: {
        limit: MONTHLY_TRIALS,
        used: Math.max(0, Number(user.trials_used) || 0),
        remaining: Math.max(0, MONTHLY_TRIALS - (Number(user.trials_used) || 0)),
        duration_days: 1,
        period_start: user.trials_period_start,
      },
      slots: {
        total: totalSlots(user),
        used: fixedAccounts.length,
        available: Math.max(0, totalSlots(user) - fixedAccounts.length),
      },
    };

    console.info(
      `[mro-login:${requestId}] etapa=resposta resultado=sucesso user_id=${user.id} ` +
        `instagram=${instagram ? "verificado" : "nao_enviado"} contas=${fixedAccounts.length} testes=${trialAccounts.length}`,
    );
    res.status(200).json(payload);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "sem_codigo";
    console.error(`[mro-login:${requestId}] etapa=postgres resultado=erro code=${code} message=${JSON.stringify(message)}`);
    res.status(503).json({ success: false, error: "Erro temporário na comunicação com o servidor" });
    return true;
  }
}