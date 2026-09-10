import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

function createCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const requestedHeaders = req.headers.get("access-control-request-headers");
  return {
    ...(origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        }
      : {}),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      requestedHeaders ??
      "authorization, x-client-info, apikey, content-type, x-requested-with, accept, accept-profile, content-profile, prefer, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Expose-Headers": "content-length, content-range",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

/** Vitalício threshold — qualquer valor >= 999999 é considerado acesso vitalício. */
const LIFETIME_DAYS = 999999;
/** Testes gratuitos por mês, cada um com duração de 1 dia. */
const MONTHLY_TRIALS = 5;
const DEFAULT_PLAN_ACCOUNTS = 4;
/** Contato para renovação exibido quando o plano expira. */
const RENEWAL_WHATSAPP_LINK =
  "https://wa.me/555192835863?text=" +
  encodeURIComponent("Olá vim pelo renda extra, já usei 30 dias gostaria de saber sobre o desconto.");
const PAGE_SIZE = 1000;
/** Timeout em ms para operações de banco — exceder resulta em erro rápido em vez de timeout de 150s. */
const DB_TIMEOUT_MS = 10_000;

/**
 * Cria cliente com timeout na conexão.
 * O Supabase JS não expõe o AbortController diretamente na v2, então
 * usamos um wrapper de fetch com signal.
 */
function createTimedClient(url: string, key: string) {
  return createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
        return fetch(input, { ...init, signal: controller.signal as any }).finally(() => clearTimeout(timeout));
      },
    },
  });
}

/** SHA-256 (Web Crypto) — mesmo padrão usado nas demais APIs do projeto. */
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface MroUserRow {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  password_hash: string | null;
  plan_accounts: number;
  /** Contas liberadas além do plano (extras concedidos pelo admin). */
  extra_accounts?: number | null;
  expiration_days: number;
  /** Data limite do acesso (planos com prazo, ex.: 30 dias do /renddx). */
  expires_at?: string | null;
  /** Origem da venda (ex.: "renddx"). */
  source?: string | null;
  is_active: boolean;

  trials_used: number;
  trials_period_start: string;
  last_access: string | null;
  created_at: string;
}

interface MroAccountRow {
  id: string;
  user_id: string;
  instagram_username: string;
  is_trial: boolean;
  trial_expires_at: string | null;
  created_at: string;
}

interface ProfileScreenshotRow {
  squarecloud_username: string | null;
  instagram_username: string | null;
  profile_screenshot_url: string | null;
  updated_at: string | null;
}

/**
 * Busca todas as linhas com paginação, parando quando atinge maxRows.
 * Usa o fetch com timeout global para nunca ultrapassar DB_TIMEOUT_MS por página.
 */
async function fetchAllRows<Row>(
  supabase: ReturnType<typeof createTimedClient>,
  queryFactory: () => { range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }> },
  maxRows = 10_000,
): Promise<{ data: Row[]; error: string | null }> {
  const rows: Row[] = [];

  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE - 1, maxRows - 1);
    const { data, error } = await queryFactory().range(from, to);

    if (error) return { data: rows, error: error.message };

    const page = data || [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

const monthStart = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
};

/**
 * Normaliza os dias de acesso:
 * - valores inválidos/negativos viram 0
 * - qualquer valor >= 9999 é tratado como vitalício (LIFETIME_DAYS = 999999)
 * Isso evita o erro "out of range for type integer" na importação.
 */
function normalizeExpiration(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 9999 ? LIFETIME_DAYS : n;
}

/**
 * Calcula o estado do plano.
 *
 * Quando `expires_at` está preenchido (compras com prazo, ex.: plano de 30 dias
 * vendido em /renddx) a data é a fonte da verdade: passado esse prazo o acesso é
 * negado em todas as rotas — login da extensão, verificações de conta e painel.
 */
function planInfo(user: MroUserRow) {
  const lifetime = user.expiration_days >= LIFETIME_DAYS;
  const expiresAt = user.expires_at ? new Date(user.expires_at) : null;
  const validExpiration = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
  const timeExpired = !lifetime && !!validExpiration && validExpiration.getTime() <= Date.now();

  const daysRemaining = lifetime
    ? LIFETIME_DAYS
    : validExpiration
    ? Math.max(0, Math.ceil((validExpiration.getTime() - Date.now()) / 86400000))
    : Math.max(0, Number(user.expiration_days) || 0);

  return {
    plan_type: lifetime ? "vitalicio" : user.expiration_days > 365 ? "anual+" : user.expiration_days > 31 ? "anual" : "mensal",
    lifetime,
    source: user.source ?? null,
    expires_at: validExpiration ? validExpiration.toISOString() : null,
    days_remaining: daysRemaining,
    expired: !lifetime && (timeExpired || daysRemaining <= 0),
    access_allowed: user.is_active && !timeExpired && (lifetime || daysRemaining > 0),
  };
}

/**
 * Limite real de contas fixas do usuário.
 * Soma as contas do plano com os extras liberados manualmente pelo admin.
 */
function totalSlots(user: MroUserRow): number {
  const plan = Math.max(0, Number(user.plan_accounts) || 0);
  const extra = Math.max(0, Number(user.extra_accounts) || 0);
  return plan + extra;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Preflight: responde 204 com todos os headers CORS, refletindo os headers pedidos.
  if (req.method === "OPTIONS") {
    console.log(
      `[MRO-TOOL-CORS] OPTIONS liberado origin=${req.headers.get("origin") ?? "sem-origin"} headers=${req.headers.get("access-control-request-headers") ?? "padrão"}`,
    );
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  let supabase: ReturnType<typeof createTimedClient>;
  try {
    supabase = createTimedClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  } catch (initErr) {
    console.error("[MRO-TOOL-API] init error:", initErr);
    return json({ success: false, error: "Erro ao inicializar conexão com banco" }, 500);
  }

  try {
    const raw = await req.text();
    let body: Record<string, any> = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ success: false, error: "Corpo da requisição inválido" }, 400);
    }

    const action = String(body.action || "");

    /** Busca usuário por username OU email. */
    async function findUser(identifier: string): Promise<MroUserRow | null> {
      const id = identifier.trim().toLowerCase();
      if (!id) return null;
      const lookupColumn = id.includes("@") ? "email" : "username";
      const { data } = await supabase
        .from("mro_tool_users")
        .select("*")
        .ilike(lookupColumn, id)
        .limit(1);
      return (data?.[0] as MroUserRow) || null;
    }

    /**
     * Devolve as contas fixas válidas do usuário.
     * A limpeza de contas de teste expiradas foi movida para o trigger SQL
     * (ver migration: auto_cleanup_expired_trials) para não travar o login.
     */
    async function getAccounts(userId: string): Promise<MroAccountRow[]> {
      const { data } = await supabase
        .from("mro_tool_accounts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      return (data || []) as MroAccountRow[];
    }

    /**
     * Resolve onde um @instagram está cadastrado para o usuário informado.
     * Fontes verificadas:
     *  1. mro_tool_accounts       -> contas do plano (fixas) e contas de teste (1 dia)
     *  2. free_trial_registrations-> perfis do teste grátis (ainda válidos)
     *  3. squarecloud_user_profiles-> perfis já cadastrados na área /instagram
     */
    async function resolveInstagram(user: MroUserRow, instagram: string) {
      const ig = instagram.trim().toLowerCase().replace(/^@/, "");

      const accounts = await getAccounts(user.id);
      const match = accounts.find((a) => a.instagram_username.toLowerCase().replace(/^@/, "") === ig);
      if (match) {
        return {
          registered: true,
          source: match.is_trial ? "trial_account" : "plan_account",
          is_trial: match.is_trial,
          trial_expires_at: match.trial_expires_at,
        };
      }

      // Teste grátis (free_trial_registrations)
      const { data: freeTrials } = await supabase
        .from("free_trial_registrations")
        .select("instagram_username, expires_at, instagram_removed, generated_username, email")
        .ilike("instagram_username", ig)
        .limit(5);

      const validTrial = (freeTrials || []).find((t: any) => {
        if (t.instagram_removed) return false;
        if (t.expires_at && new Date(t.expires_at).getTime() < Date.now()) return false;
        const owner = String(t.generated_username || "").toLowerCase();
        const mail = String(t.email || "").toLowerCase();
        return owner === user.username?.toLowerCase() || (!!user.email && mail === user.email.toLowerCase());
      });

      if (validTrial) {
        return {
          registered: true,
          source: "free_trial",
          is_trial: true,
          trial_expires_at: (validTrial as any).expires_at || null,
        };
      }

      // Perfis já cadastrados na área /instagram
      const { data: profiles } = await supabase
        .from("squarecloud_user_profiles")
        .select("instagram_username, squarecloud_username")
        .ilike("instagram_username", ig)
        .limit(10);

      const profileMatch = (profiles || []).find(
        (p: any) => String(p.squarecloud_username || "").toLowerCase() === user.username?.toLowerCase(),
      );
      if (profileMatch) {
        return { registered: true, source: "instagram_area", is_trial: false, trial_expires_at: null };
      }

      return { registered: false, source: null, is_trial: false, trial_expires_at: null };
    }


    /** Reinicia o contador de testes quando muda o mês. */
    async function ensureTrialPeriod(user: MroUserRow): Promise<MroUserRow> {
      const start = monthStart();
      if (user.trials_period_start >= start) return user;
      await supabase
        .from("mro_tool_users")
        .update({ trials_used: 0, trials_period_start: start })
        .eq("id", user.id);
      return { ...user, trials_used: 0, trials_period_start: start };
    }

    async function fullPayload(user: MroUserRow) {
      const accounts = await getAccounts(user.id);
      const fixed = accounts.filter((a) => !a.is_trial);
      const trials = accounts.filter((a) => a.is_trial);
      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          is_active: user.is_active,
          plan_accounts: user.plan_accounts,
          extra_accounts: Math.max(0, Number(user.extra_accounts) || 0),
          total_accounts: totalSlots(user),
          expiration_days: user.expiration_days,
          last_access: user.last_access,
          created_at: user.created_at,
          ...planInfo(user),
        },
        accounts: fixed,
        trial_accounts: trials,
        trials: {
          limit: MONTHLY_TRIALS,
          used: user.trials_used,
          remaining: Math.max(0, MONTHLY_TRIALS - user.trials_used),
          duration_days: 1,
          period_start: user.trials_period_start,
        },
        slots: {
          total: totalSlots(user),
          used: fixed.length,
          available: Math.max(0, totalSlots(user) - fixed.length),
        },
      };
    }

    // ---------------- PÚBLICO ----------------
    if (action === "login") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!identifier || !password) return json({ success: false, error: "Usuário/email e senha são obrigatórios" }, 400);
      if (identifier.length > 255 || password.length > 255) return json({ success: false, error: "Credenciais inválidas" }, 400);

      let user = await findUser(identifier);
      if (!user || !user.password_hash) return json({ success: false, error: "Usuário ou senha incorretos" });

      const hash = await sha256(password);
      if (hash !== user.password_hash) return json({ success: false, error: "Usuário ou senha incorretos" });

      const info = planInfo(user);
      if (!info.access_allowed) {
        return json({
          success: false,
          error: info.expired
            ? "Seu plano expirou. Contrate um novo plano para voltar a usar a ferramenta."
            : "Acesso expirado ou desativado",
          expired: info.expired,
          needs_renewal: true,
          whatsapp: RENEWAL_WHATSAPP_LINK,
        });
      }

      user = await ensureTrialPeriod(user);

      // Verificação opcional do @instagram que está logado na extensão.
      // Se o instagram for enviado e NÃO estiver cadastrado, o login é negado.
      const loginInstagram = String(body.instagram || body.instagram_username || "").trim().toLowerCase().replace(/^@/, "");
      if (loginInstagram) {
        const check = await resolveInstagram(user, loginInstagram);
        if (!check.registered) {
          return json({
            success: false,
            instagram_not_registered: true,
            instagram: loginInstagram,
            error: `O Instagram @${loginInstagram} não está cadastrado na sua conta. Cadastre o perfil na área /instagram antes de usar a ferramenta.`,
          });
        }
        await supabase.from("mro_tool_users").update({ last_access: new Date().toISOString() }).eq("id", user.id);
        return json({
          success: true,
          instagram_verified: true,
          instagram: { username: loginInstagram, ...check },
          ...(await fullPayload(user)),
        });
      }

      await supabase.from("mro_tool_users").update({ last_access: new Date().toISOString() }).eq("id", user.id);

      return json({ success: true, ...(await fullPayload(user)) });
    }

    /** Verifica se um nome de usuário está disponível para cadastro (formulários de compra). */
    if (action === "check_username") {
      const desired = String(body.username || "").trim().toLowerCase();
      if (!desired || desired.length < 4) {
        return json({ success: false, error: "Nome de usuário inválido", available: false });
      }
      if (desired.length > 255) {
        return json({ success: false, error: "Nome de usuário inválido", available: false });
      }
      const { data: existing, error: checkErr } = await supabase
        .from("mro_tool_users")
        .select("username")
        .eq("username", desired)
        .maybeSingle();
      if (checkErr) return json({ success: false, error: "Erro ao verificar usuário" }, 500);
      return json({ success: true, username: desired, available: !existing, exists: !!existing });
    }

    /**
     * Status do plano por usuário/e-mail — usado pela /dashboard para exibir o
     * bloqueio quando o plano de 30 dias expira. Não expõe dados sensíveis.
     */
    if (action === "plan_status") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      if (!identifier) return json({ success: false, error: "Usuário ou email é obrigatório" }, 400);
      const user = await findUser(identifier);
      if (!user) return json({ success: true, found: false, expired: false, access_allowed: true });
      const info = planInfo(user);
      return json({
        success: true,
        found: true,
        username: user.username,
        is_active: user.is_active,
        ...info,
        whatsapp: RENEWAL_WHATSAPP_LINK,
      });
    }

    if (action === "verify_user") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      if (!identifier) return json({ success: false, error: "Usuário ou email é obrigatório" }, 400);
      let user = await findUser(identifier);
      if (!user) return json({ success: false, error: "Usuário não encontrado" });
      user = await ensureTrialPeriod(user);
      return json({ success: true, ...(await fullPayload(user)) });
    }

    /** Verifica se o @instagram está cadastrado (plano, teste de 1 dia, teste grátis ou área /instagram). */
    if (action === "verify_instagram" || action === "check_instagram") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      const instagram = String(body.instagram || body.instagram_username || "").trim().toLowerCase().replace(/^@/, "");
      if (!identifier || !instagram) return json({ success: false, error: "Usuário e conta do Instagram são obrigatórios" }, 400);

      const user = await findUser(identifier);
      if (!user) return json({ success: false, error: "Usuário não encontrado" });
      const info = planInfo(user);
      if (!info.access_allowed) return json({ success: false, allowed: false, error: "Acesso expirado ou desativado", needs_renewal: true });

      const check = await resolveInstagram(user, instagram);
      if (!check.registered) {
        return json({
          success: true,
          allowed: false,
          registered: false,
          instagram,
          error: `O Instagram @${instagram} não está cadastrado nessa conta.`,
        });
      }
      return json({ success: true, allowed: true, registered: true, instagram, ...check, plan: info });
    }

    /** Verifica se uma conta do Instagram pode ser usada por esse usuário. */
    if (action === "check_account") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      const instagram = String(body.instagram || body.instagram_username || "").trim().toLowerCase().replace(/^@/, "");
      if (!identifier || !instagram) return json({ success: false, error: "Usuário e conta do Instagram são obrigatórios" }, 400);

      const user = await findUser(identifier);
      if (!user) return json({ success: false, error: "Usuário não encontrado" });
      if (!planInfo(user).access_allowed) return json({ success: false, error: "Acesso expirado ou desativado" });

      const check = await resolveInstagram(user, instagram);
      if (!check.registered) {
        return json({ success: false, allowed: false, registered: false, error: "Conta não cadastrada no plano" });
      }
      return json({ success: true, allowed: true, registered: true, source: check.source, is_trial: check.is_trial, trial_expires_at: check.trial_expires_at });
    }


    /** Cadastra conta fixa do plano (respeitando o limite) — usado pela extensão. */
    if (action === "add_account") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      const instagram = String(body.instagram || body.instagram_username || "").trim().toLowerCase();
      if (!identifier || !instagram) return json({ success: false, error: "Usuário e conta do Instagram são obrigatórios" }, 400);
      if (instagram.length > 120) return json({ success: false, error: "Conta inválida" }, 400);

      let user = await findUser(identifier);
      if (!user) return json({ success: false, error: "Usuário não encontrado" });
      if (!planInfo(user).access_allowed) return json({ success: false, error: "Acesso expirado ou desativado" });

      user = await ensureTrialPeriod(user);
      const isTrial = !!body.trial;
      const accounts = await getAccounts(user.id);

      if (accounts.some((a) => a.instagram_username.toLowerCase() === instagram)) {
        return json({ success: false, error: "Essa conta já está cadastrada" });
      }

      if (isTrial) {
        if (user.trials_used >= MONTHLY_TRIALS) {
          return json({ success: false, error: `Você já usou seus ${MONTHLY_TRIALS} testes deste mês`, trials_exhausted: true });
        }
        // Duração do teste: padrão 24h; a extensão pode pedir 6h (trial_hours: 6)
        const rawHours = Number(body.trial_hours ?? body.hours ?? 24);
        const trialHours = Number.isFinite(rawHours) ? Math.min(Math.max(rawHours, 1), 24) : 24;
        const expires = new Date(Date.now() + trialHours * 60 * 60 * 1000).toISOString();
        await supabase.from("mro_tool_accounts").insert({
          user_id: user.id, instagram_username: instagram, is_trial: true, trial_expires_at: expires,
        });
        await supabase.from("mro_tool_users").update({ trials_used: user.trials_used + 1 }).eq("id", user.id);
        user = { ...user, trials_used: user.trials_used + 1 };
        return json({ success: true, trial: true, trial_hours: trialHours, trial_expires_at: expires, ...(await fullPayload(user)) });
      }

      const fixedCount = accounts.filter((a) => !a.is_trial).length;
      const total = totalSlots(user);

      if (fixedCount >= total) {
        await supabase.from("mro_tool_logs").insert({
          user_id: user.id,
          action_type: "limit_reached",
          details: { instagram, fixed_count: fixedCount, total_slots: total }
        });
        return json({
          success: false,
          limit_reached: true,
          error: `Você não pode cadastrar mais nenhum perfil: o limite de ${total} conta(s) já foi excedido.`,
        });
      }

      // Se estiver usando vaga extra (acima de plan_accounts)
      if (fixedCount >= user.plan_accounts) {
        const extra = Math.max(0, Number(user.extra_accounts) || 0);
        if (extra > 0) {
          await supabase.from("mro_tool_users").update({ extra_accounts: extra - 1 }).eq("id", user.id);
          await supabase.from("mro_tool_logs").insert({
            user_id: user.id,
            action_type: "extra_consumed",
            details: { instagram, previous_extra: extra, new_extra: extra - 1 }
          });
        }
      }

      await supabase.from("mro_tool_accounts").insert({ user_id: user.id, instagram_username: instagram });
      await supabase.from("mro_tool_logs").insert({
        user_id: user.id,
        action_type: "account_added",
        details: { instagram, is_admin: false }
      });
      return json({ success: true, ...(await fullPayload(user)) });
    }

    if (action === "get_user_logs") {
      const id = String(body.id || "");
      if (!id) return json({ success: false, error: "ID é obrigatório" }, 400);
      const { data: logs, error } = await supabase
        .from("mro_tool_logs")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, logs });
    }


    // ---------------- ADMIN ----------------
    if (action === "list_users") {
      // A tela renderiza em blocos. Carregar milhares de usuários, contas e prints
      // numa única resposta fazia a função atingir o timeout da nuvem.
      const requestedLimit = Number(body.limit);
      const requestedOffset = Number(body.offset);
      const limit = Number.isFinite(requestedLimit) ? Math.min(2000, Math.max(1, Math.floor(requestedLimit))) : 50;
      const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0;

      const { data: usersData, error: usersError, count } = await supabase
        .from("mro_tool_users")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (usersError) return json({ success: false, error: usersError.message }, 500);

      const users = (usersData || []) as MroUserRow[];
      const userIds = users.map((user) => user.id);

      // PostgREST envia o filtro `in` na URL: com milhares de IDs a requisição
      // estoura o tamanho máximo e a nuvem responde "Bad Request". Por isso
      // quebramos as consultas em blocos pequenos.
      const chunk = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      let accounts: MroAccountRow[] = [];
      for (const ids of chunk(userIds, 100)) {
        const { data, error } = await supabase
          .from("mro_tool_accounts")
          .select("*")
          .in("user_id", ids)
          .order("created_at", { ascending: true });
        if (error) return json({ success: false, error: error.message }, 500);
        accounts = accounts.concat((data || []) as MroAccountRow[]);
      }

      // Busca somente os prints das contas exibidas neste bloco.
      const instagramNames = [...new Set(accounts.map((account) =>
        String(account.instagram_username || "").replace(/^@/, "").trim(),
      ).filter(Boolean))];
      let profiles: ProfileScreenshotRow[] = [];
      for (const names of chunk(instagramNames, 100)) {
        const { data, error } = await supabase
          .from("squarecloud_user_profiles")
          .select("squarecloud_username, instagram_username, profile_screenshot_url, updated_at")
          .in("instagram_username", names)
          .order("updated_at", { ascending: false });
        if (error) return json({ success: false, error: error.message }, 500);
        profiles = profiles.concat((data || []) as ProfileScreenshotRow[]);
      }


      const shotKey = (user: string, ig: string) =>
        `${String(user || "").toLowerCase().trim()}::${String(ig || "").toLowerCase().replace("@", "").trim()}`;
      const shots = new Map<string, string>();
      const shotsByIg = new Map<string, string>();
      for (const p of profiles) {
        if (!p.profile_screenshot_url) continue;
        shots.set(shotKey(p.squarecloud_username || "", p.instagram_username || ""), p.profile_screenshot_url);
        shotsByIg.set(
          String(p.instagram_username || "").toLowerCase().replace("@", "").trim(),
          p.profile_screenshot_url,
        );
      }

      const byUser = new Map<string, MroAccountRow[]>();
      for (const a of accounts) {
        const list = byUser.get(a.user_id) || [];
        list.push(a);
        byUser.set(a.user_id, list);
      }

      const result = users.map((u) => {
        const list = byUser.get(u.id) || [];
        const { password_hash, ...rest } = u as any;
        const withShots = list.map((a) => {
          const ig = String(a.instagram_username || "").toLowerCase().replace("@", "").trim();
          return {
            ...a,
            screenshot_url: shots.get(shotKey(u.username, ig)) || shotsByIg.get(ig) || null,
          };
        });
        return {
          ...rest,
          ...planInfo(u),
          has_password: !!password_hash || !!(u as any).password_plain,
          accounts: withShots.filter((a) => !a.is_trial),
          trial_accounts: withShots.filter((a) => a.is_trial),
          trials_remaining: Math.max(0, MONTHLY_TRIALS - u.trials_used),
        };
      });


      return json({ success: true, users: result, total: count || 0, trials_limit: MONTHLY_TRIALS });
    }

    /**
     * Vincula automaticamente emails e senhas aos usuários que ainda não têm.
     * Usa UPDATE em lote (100 por vez) para não estourar o timeout de 150s
     * mesmo com milhares de usuários.
     */
    if (action === "sync_emails" || action === "sync_credentials") {
      const overwrite = body.overwrite === true;

      // 1) Pega emails e senhas das tabelas de origem (mapeia username -> dados).
      const emailByUsername = new Map<string, string>();
      const passwordByUsername = new Map<string, string>();

      // created_accesses: busca apenas os que ainda não estão mapeados (LIMIT 5000).
      const { data: accesses } = await supabase
        .from("created_accesses")
        .select("username, customer_email, password")
        .order("created_at", { ascending: false })
        .limit(5000);
      for (const row of (accesses || []) as any[]) {
        const u = String(row.username || "").trim().toLowerCase();
        const e = String(row.customer_email || "").trim().toLowerCase();
        const p = String(row.password || "").trim();
        if (!u) continue;
        if (e && !emailByUsername.has(u)) emailByUsername.set(u, e);
        if (p && !passwordByUsername.has(u)) passwordByUsername.set(u, p);
      }

      // mro_orders: só preenche emails que ainda faltam.
      const { data: orders } = await supabase
        .from("mro_orders")
        .select("username, email")
        .order("created_at", { ascending: false })
        .limit(5000);
      for (const row of (orders || []) as any[]) {
        const u = String(row.username || "").trim().toLowerCase();
        const e = String(row.email || "").trim().toLowerCase();
        if (u && e && !emailByUsername.has(u)) emailByUsername.set(u, e);
      }

      // 2) Busca SOMENTE usuários que precisam de sync (sem email ou sem senha).
      // Isso evita varrer toda a tabela quando a maioria já tem dados.
      let { data: pendingUsers, error: pendingErr } = overwrite
        ? await supabase.from("mro_tool_users").select("id, username, email, password_plain").limit(10000)
        : await supabase
            .from("mro_tool_users")
            .select("id, username, email, password_plain")
            .or(`email.is.null,password_plain.is.null`)
            .limit(10000);

      if (pendingErr) {
        // Fallback: se o filtro .or() falhar (índice ausente), busca tudo.
        ({ data: pendingUsers } = await supabase
          .from("mro_tool_users")
          .select("id, username, email, password_plain")
          .limit(10000));
      }

      const users = (pendingUsers || []) as any[];
      const totalPending = users.length;
      let updated = 0;
      let passwords = 0;

      // 3) Atualiza em lotes de 100 para não estourar o timeout.
      const BATCH = 100;
      for (let i = 0; i < users.length; i += BATCH) {
        const batch = users.slice(i, i + BATCH);
        const patches: Record<string, unknown>[] = [];

        for (const u of batch) {
          const key = String(u.username || "").trim().toLowerCase();
          const patch: Record<string, unknown> = {};

          const email = emailByUsername.get(key);
          if (email && email !== u.email && (!u.email || overwrite)) patch.email = email;

          const currentPlain = u.password_plain as string | null;
          const password = passwordByUsername.get(key);
          if (password && password !== currentPlain && (!currentPlain || overwrite)) {
            patch.password_plain = password;
            patch.password_hash = await sha256(password);
          }

          if (!Object.keys(patch).length) continue;
          patches.push(patch);
        }

        // UPDATE em lote: uma query por batch de 100, não 100 queries sequenciais.
        for (let j = 0; j < batch.length; j++) {
          if (!patches[j]) continue;
          const { error } = await supabase
            .from("mro_tool_users")
            .update(patches[j])
            .eq("id", batch[j].id);
          if (!error) {
            updated += 1;
            if (patches[j].password_plain) passwords += 1;
          }
        }
      }

      return json({ success: true, updated, passwords, total_pending: totalPending });
    }

    /**
     * Envia (ou reenvia) o acesso do cliente por email, reaproveitando o template
     * oficial de boas-vindas. Só funciona se o usuário tiver email e senha visível.
     */
    if (action === "send_access") {
      const id = String(body.id || "");
      if (!id) return json({ success: false, error: "ID é obrigatório" }, 400);

      const { data: user } = await supabase
        .from("mro_tool_users")
        .select("id, username, email, password_plain, expiration_days")
        .eq("id", id)
        .maybeSingle();

      if (!user) return json({ success: false, error: "Usuário não encontrado" }, 404);
      if (!user.email) return json({ success: false, error: "Usuário sem email cadastrado" }, 400);
      if (!user.password_plain) {
        return json({ success: false, error: "Senha não disponível — edite o usuário e defina uma nova senha" }, 400);
      }

      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          email: user.email,
          username: user.username,
          password: user.password_plain,
          daysRemaining: user.expiration_days,
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.success === false) {
        return json({ success: false, error: result?.error || "Falha ao enviar email" }, 500);
      }

      return json({ success: true, email: user.email });
    }

    if (action === "upsert_user") {
      const username = String(body.username || "").trim().toLowerCase();
      if (!username) return json({ success: false, error: "Usuário é obrigatório" }, 400);

      const payload: Record<string, unknown> = {
        username,
        email: body.email ? String(body.email).trim().toLowerCase() : null,
        name: body.name ? String(body.name).trim() : null,
      };
      if (body.is_active !== undefined) payload.is_active = !!body.is_active;
      if (body.plan_accounts !== undefined && body.plan_accounts !== null && body.plan_accounts !== "") {
        payload.plan_accounts = Math.max(0, Number(body.plan_accounts) || 0);
      }
      if (body.extra_accounts !== undefined && body.extra_accounts !== null && body.extra_accounts !== "") {
        payload.extra_accounts = Math.max(0, Number(body.extra_accounts) || 0);
      }
      if (body.expiration_days !== undefined && body.expiration_days !== null && body.expiration_days !== "") {
        payload.expiration_days = normalizeExpiration(body.expiration_days);
      }
      if (body.password) {
        payload.password_hash = await sha256(String(body.password));
        // Cópia visível para o admin conseguir reenviar/copiar o acesso do cliente.
        payload.password_plain = String(body.password);
      }

      const { data: existing } = await supabase
        .from("mro_tool_users").select("id").eq("username", username).maybeSingle();

      const query = existing
        ? supabase.from("mro_tool_users").update(payload).eq("id", existing.id)
        : supabase.from("mro_tool_users").insert(payload);

      const { error } = await query;
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    /** Admin define/soma contas extras (além do plano) para um usuário. */
    if (action === "set_extras") {
      const id = String(body.id || "");
      if (!id) return json({ success: false, error: "ID é obrigatório" }, 400);

      const { data: user } = await supabase
        .from("mro_tool_users").select("id, extra_accounts").eq("id", id).maybeSingle();
      if (!user) return json({ success: false, error: "Usuário não encontrado" });

      const current = Math.max(0, Number((user as { extra_accounts?: number }).extra_accounts) || 0);
      const next =
        body.delta !== undefined && body.delta !== null && body.delta !== ""
          ? current + Number(body.delta)
          : Number(body.extra_accounts);
      const value = Math.max(0, Math.min(999, Number.isFinite(next) ? Math.trunc(next) : current));

      const { error } = await supabase.from("mro_tool_users").update({ extra_accounts: value }).eq("id", id);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, extra_accounts: value });
    }

    if (action === "delete_user") {
      if (!body.id) return json({ success: false, error: "ID é obrigatório" }, 400);
      const { error } = await supabase.from("mro_tool_users").delete().eq("id", body.id);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    /**
     * Admin adiciona conta manualmente.
     * O cadastro feito pelo admin NUNCA exige contas extras nem respeita o limite
     * do plano — extras existem apenas para o cadastro feito pelo próprio usuário.
     */
    if (action === "admin_add_account") {
      const userId = String(body.user_id || "");
      const instagram = String(body.instagram || "").trim().toLowerCase();
      if (!userId || !instagram) return json({ success: false, error: "Usuário e conta são obrigatórios" }, 400);

      const { data: user } = await supabase.from("mro_tool_users").select("id").eq("id", userId).maybeSingle();
      if (!user) return json({ success: false, error: "Usuário não encontrado" });

      const { error } = await supabase.from("mro_tool_accounts").insert({ user_id: userId, instagram_username: instagram });
      if (error) return json({ success: false, error: error.message }, 500);

      await supabase.from("mro_tool_logs").insert({
        user_id: userId,
        action_type: "account_added",
        details: { instagram, is_admin: true }
      });

      return json({ success: true });
    }


    /**
     * Remove uma conta do Instagram.
     * REGRA: remover NÃO devolve a vaga. O slot é consumido definitivamente,
     * ou seja 22/22 -> 21/21 (e não 21/22). Primeiro consome o extra, depois o plano.
     */
    if (action === "remove_account") {
      if (!body.id) return json({ success: false, error: "ID é obrigatório" }, 400);

      const { data: account } = await supabase
        .from("mro_tool_accounts")
        .select("id, user_id, is_trial")
        .eq("id", body.id)
        .maybeSingle();

      const { error } = await supabase.from("mro_tool_accounts").delete().eq("id", body.id);
      if (error) return json({ success: false, error: error.message }, 500);

      // Contas de teste não ocupam slot fixo, então não reduzem o limite.
      if (account && !account.is_trial && account.user_id) {
        const { data: user } = await supabase
          .from("mro_tool_users")
          .select("id, plan_accounts, extra_accounts")
          .eq("id", account.user_id)
          .maybeSingle();

        if (user) {
          const extra = Math.max(0, Number(user.extra_accounts) || 0);
          const plan = Math.max(0, Number(user.plan_accounts) || 0);
          const patch = extra > 0
            ? { extra_accounts: extra - 1 }
            : { plan_accounts: Math.max(0, plan - 1) };
          await supabase.from("mro_tool_users").update(patch).eq("id", user.id);
        }
      }

      return json({ success: true });
    }


    if (action === "reset_trials") {
      if (!body.id) return json({ success: false, error: "ID é obrigatório" }, 400);
      const { error } = await supabase
        .from("mro_tool_users")
        .update({ trials_used: 0, trials_period_start: monthStart() })
        .eq("id", body.id);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    /**
     * Importa em massa: [{ username, password, expiration_days, accounts: [] }]
     * Estratégia set-based (poucas queries) para não estourar o timeout de 150s
     * da edge function quando há centenas de usuários.
     */
    if (action === "bulk_import") {
      const rawItems = Array.isArray(body.users) ? body.users : [];
      if (!rawItems.length) return json({ success: false, error: "Nenhum usuário para importar" }, 400);
      if (rawItems.length > 500) {
        return json({ success: false, error: "Máximo de 500 usuários por lote" }, 400);
      }

      const errors: string[] = [];

      // 1) Normaliza + deduplica por username (mantém a última ocorrência).
      const byUsername = new Map<string, { username: string; email: string | null; password: string | null; expiration: number; igs: string[] }>();
      for (const item of rawItems) {
        const username = String(item?.username || "").trim().toLowerCase();
        if (!username || username.length > 255) continue;
        const igs = Array.isArray(item?.accounts)
          ? Array.from(new Set(
              item.accounts
                .map((a: unknown) => String(a ?? "").trim().toLowerCase())
                .filter((a: string) => !!a && a.length <= 120),
            )) as string[]
          : [];
        byUsername.set(username, {
          username,
          email: item?.email ? String(item.email).trim().toLowerCase() : null,
          password: item?.password ? String(item.password) : null,
          expiration: normalizeExpiration(item?.expiration_days),
          igs,
        });
      }

      const items = Array.from(byUsername.values());
      if (!items.length) return json({ success: false, error: "Nenhum usuário válido encontrado" }, 400);

      const usernames = items.map((i) => i.username);

      // 2) Uma única leitura dos usuários já existentes.
      const { data: existingUsers, error: exErr } = await supabase
        .from("mro_tool_users")
        .select("id, username, password_hash, password_plain, plan_accounts")
        .in("username", usernames);
      if (exErr) return json({ success: false, error: exErr.message }, 500);

      const existingMap = new Map<
        string,
        { id: string; password_hash: string | null; password_plain: string | null; plan_accounts: number | null }
      >();
      for (const u of (existingUsers || []) as any[]) {
        existingMap.set(String(u.username).toLowerCase(), {
          id: u.id,
          password_hash: u.password_hash,
          password_plain: u.password_plain ?? null,
          plan_accounts: u.plan_accounts ?? null,
        });
      }

      // 3) Monta as linhas do upsert (hash calculado em paralelo).
      const rows = await Promise.all(items.map(async (item) => {
        const prev = existingMap.get(item.username);
        const password_hash = item.password
          ? await sha256(item.password)
          : prev?.password_hash ?? null;
        const password_plain = item.password ? item.password : (prev as any)?.password_plain ?? null;
        return {
          username: item.username,
          email: item.email,
          expiration_days: item.expiration,
          // Nunca reduz o plano já configurado para o usuário.
          plan_accounts: Math.max(DEFAULT_PLAN_ACCOUNTS, item.igs.length, prev?.plan_accounts ?? 0),
          is_active: true,
          password_hash,
          password_plain,
        };
      }));

      // 4) Upsert único por username.
      const { data: upserted, error: upErr } = await supabase
        .from("mro_tool_users")
        .upsert(rows, { onConflict: "username" })
        .select("id, username");
      if (upErr) return json({ success: false, error: upErr.message }, 500);

      const idByUsername = new Map<string, string>();
      for (const u of (upserted || []) as any[]) {
        idByUsername.set(String(u.username).toLowerCase(), u.id);
      }

      const created = items.filter((i) => !existingMap.has(i.username)).length;
      const updated = items.length - created;

      // 5) Uma leitura de todas as contas já vinculadas + um insert em lote.
      const userIds = Array.from(idByUsername.values());
      const alreadyLinked = new Set<string>();
      if (userIds.length) {
        const { data: currentAccounts } = await supabase
          .from("mro_tool_accounts")
          .select("user_id, instagram_username")
          .in("user_id", userIds)
          .eq("is_trial", false);
        for (const a of (currentAccounts || []) as any[]) {
          alreadyLinked.add(`${a.user_id}::${String(a.instagram_username).toLowerCase()}`);
        }
      }

      const toInsert: { user_id: string; instagram_username: string }[] = [];
      for (const item of items) {
        const userId = idByUsername.get(item.username);
        if (!userId) {
          errors.push(`${item.username}: usuário não pôde ser gravado`);
          continue;
        }
        for (const ig of item.igs) {
          const key = `${userId}::${ig}`;
          if (alreadyLinked.has(key)) continue;
          alreadyLinked.add(key);
          toInsert.push({ user_id: userId, instagram_username: ig });
        }
      }

      let accountsAdded = 0;
      const CHUNK = 500;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error: accErr } = await supabase.from("mro_tool_accounts").insert(chunk);
        if (!accErr) {
          accountsAdded += chunk.length;
          continue;
        }
        // Fallback: se o lote falhar (ex.: 1 conta duplicada), insere uma a uma
        // para que as contas válidas não sejam perdidas.
        for (const row of chunk) {
          const { error: oneErr } = await supabase.from("mro_tool_accounts").insert(row);
          if (oneErr) errors.push(`${row.instagram_username}: ${oneErr.message}`);
          else accountsAdded += 1;
        }
      }

      return json({ success: true, created, updated, accounts_added: accountsAdded, errors: errors.slice(0, 20) });
    }


    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown";
    console.error("[MRO-TOOL-API]", message);
    // AbortError = timeout de 10s; retorna 504 para o frontend mostrar erro claro.
    if (message.includes("aborted") || message.includes("canceled")) {
      return json({ success: false, error: "Tempo limite excedido no banco de dados. Tente novamente em alguns segundos." }, 504);
    }
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
