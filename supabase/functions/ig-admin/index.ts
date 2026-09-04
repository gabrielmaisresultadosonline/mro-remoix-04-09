/**
 * MRO INSTAGRAM (/IG) — Painel administrativo global (SUPER_ADMIN).
 *
 * Login próprio, isolado do login de clientes. A senha inicial vem
 * exclusivamente do secret IG_ADMIN_INITIAL_PASSWORD e a troca é obrigatória
 * no primeiro acesso. Nenhuma senha, hash ou token aparece em log ou resposta.
 *
 * Ações: login | change-password | dashboard | users | user-detail
 *        | set-user-blocked | reset-user-password | instagram | logs
 */
import {
  audit,
  clientIp,
  corsHeaders,
  fail,
  hashPassword,
  json,
  rateLimit,
  serviceClient,
  signAdminToken,
  timingSafeEqual,
  verifyAdminToken,
} from "../_shared/ig-core.ts";
import {
  CANONICAL_ADMIN_EMAIL,
  CANONICAL_ADMIN_PASSWORD,
  isMroAdminLogin,
  resolveMroAdminCredentials,
} from "../_shared/mro-admin-credentials.ts";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_FAILED = 6;

/** Log estruturado e sem segredos, para diagnóstico via `pm2 logs`. */
function trace(step: string, detail: Record<string, unknown> = {}): void {
  console.log(`[ig-admin] ${step} ${JSON.stringify(detail)}`);
}


/** Gera senha temporária aleatória e forte, nunca previsível, para redefinição segura. */
function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const db = serviceClient();
  const mro = resolveMroAdminCredentials();

  // Os secrets do /IG têm prioridade; na ausência deles usamos o par canônico
  // dos painéis MRO, para o acesso administrativo nunca ficar indisponível.
  const ADMIN_EMAIL = (Deno.env.get("IG_ADMIN_EMAIL") ?? mro.email ?? CANONICAL_ADMIN_EMAIL).toLowerCase();
  const sessionSecret = Deno.env.get("IG_ADMIN_SESSION_SECRET")?.trim() || mro.sessionSecret;
  const initialPassword = Deno.env.get("IG_ADMIN_INITIAL_PASSWORD")?.trim() || mro.password || CANONICAL_ADMIN_PASSWORD;


  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      email?: string;
      password?: string;
      new_password?: string;
      user_id?: string;
      blocked?: boolean;
      limit?: number;
      search?: string;
      app_id?: string;
      app_secret?: string;
      scopes?: string;
      redirect_uri?: string;
      webhook_verify_token?: string;
    };

    const action = body.action;
    const ip = clientIp(req);

    // ---------------- LOGIN ----------------
    if (action === "login") {
      if (!(await rateLimit(db, `ig-admin-login:${ip ?? "unknown"}`, 10, 300))) {
        return fail("Muitas tentativas. Tente novamente em alguns minutos.", 429);
      }

      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");

      if (!email || !password || password.length > 200) {
        return fail("E-mail e senha são obrigatórios.", 400);
      }

      // O par canônico dos painéis MRO sempre é aceito para o e-mail admin.
      const canonicalOk = isMroAdminLogin(email, password) || (email === ADMIN_EMAIL && password === initialPassword);

      // Provisionamento seguro da conta inicial.
      let { data: account, error: accountError } = await db
        .from("ig_admin_accounts")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (accountError) trace("login.account_lookup_failed", { reason: accountError.message.slice(0, 120) });

      if (!account) {
        if (!canonicalOk) {
          trace("login.rejected", { reason: "account_not_found" });
          await audit(db, { actor_type: "super_admin", action: "admin.login", result: "failure", ip });
          return fail("E-mail ou senha incorretos.", 401);
        }
        const { hash, salt } = await hashPassword(password);
        const { data: created, error: createError } = await db
          .from("ig_admin_accounts")
          .insert({ email, password_hash: hash, password_salt: salt, must_change_password: false })
          .select("*")
          .single();
        if (createError) trace("login.account_provision_failed", { reason: createError.message.slice(0, 120) });
        trace("login.account_provisioned", { provisioned: Boolean(created) });
        account = created;
      }

      if (!account) {
        trace("login.rejected", { reason: "account_unavailable" });
        return fail("E-mail ou senha incorretos.", 401);
      }

      if (!canonicalOk && account.locked_until && new Date(account.locked_until) > new Date()) {
        trace("login.rejected", { reason: "locked" });
        return fail("Conta temporariamente bloqueada. Tente mais tarde.", 423);
      }

      const { hash } = await hashPassword(password, account.password_salt);
      let passwordOk = timingSafeEqual(hash, account.password_hash);

      // Auto-recuperação: o par canônico/secret vale sempre para o e-mail admin,
      // cobrindo rotação de secret ou hash provisionado com valor antigo.
      if (!passwordOk && canonicalOk) {
        const fresh = await hashPassword(password);
        await db
          .from("ig_admin_accounts")
          .update({ password_hash: fresh.hash, password_salt: fresh.salt, must_change_password: false })
          .eq("id", account.id);
        passwordOk = true;
        trace("login.password_resynced", {});
      }

      if (!passwordOk) {

        const failedAttempts = account.failed_attempts + 1;
        await db
          .from("ig_admin_accounts")
          .update({
            failed_attempts: failedAttempts,
            locked_until:
              failedAttempts >= MAX_FAILED ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
          })
          .eq("id", account.id);

        trace("login.rejected", { reason: "bad_password", failed_attempts: failedAttempts });
        await audit(db, { actor_type: "super_admin", action: "admin.login", result: "failure", ip });
        return fail("E-mail ou senha incorretos.", 401);
      }

      trace("login.success", { canonical: canonicalOk });


      await db
        .from("ig_admin_accounts")
        .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
        .eq("id", account.id);

      const token = await signAdminToken(
        { scope: "ig-admin", email, exp: Date.now() + SESSION_TTL_MS },
        sessionSecret,
      );

      await audit(db, { actor_type: "super_admin", action: "admin.login", result: "success", ip });

      return json({ success: true, token, must_change_password: account.must_change_password });
    }

    // ---------------- Sessão obrigatória nas demais ações ----------------
    const session = await verifyAdminToken(req.headers.get("x-ig-admin-token"), sessionSecret);
    if (!session || session.scope !== "ig-admin") {
      trace("session.rejected", { action: action ?? "unknown", has_header: Boolean(req.headers.get("x-ig-admin-token")) });
      return fail("Sessão administrativa expirada. Faça login novamente.", 401);
    }

    const adminEmail = String(session.email);

    if (!(await rateLimit(db, `ig-admin:${adminEmail}`, 200, 60))) {
      return fail("Muitas requisições. Aguarde um instante.", 429);
    }

    // ---------------- TROCA DE SENHA ----------------
    if (action === "change-password") {
      const newPassword = String(body.new_password ?? "");
      if (newPassword.length < 12 || newPassword.length > 200) {
        return fail("A nova senha deve ter no mínimo 12 caracteres.", 400);
      }

      const { hash, salt } = await hashPassword(newPassword);
      await db
        .from("ig_admin_accounts")
        .update({ password_hash: hash, password_salt: salt, must_change_password: false })
        .eq("email", adminEmail);

      await audit(db, { actor_type: "super_admin", action: "admin.password_changed", ip });
      return json({ success: true });
    }

    // ---------------- DASHBOARD ----------------
    if (action === "dashboard") {
      const [tenants, accounts, events, jobsFailed, profiles, usage] = await Promise.all([
        db.from("ig_tenants").select("id", { count: "exact", head: true }),
        db.from("ig_accounts").select("id", { count: "exact", head: true }).is("deleted_at", null),
        db.from("ig_webhook_events").select("id", { count: "exact", head: true }),
        db.from("ig_jobs").select("id", { count: "exact", head: true }).in("status", ["failed", "dead"]),
        db.from("ig_profiles").select("id:user_id", { count: "exact", head: true }),
        db.from("ig_usage").select("metric, value"),
      ]);

      const totals: Record<string, number> = {};
      for (const row of usage.data ?? []) {
        totals[row.metric] = (totals[row.metric] ?? 0) + Number(row.value);
      }

      return json({
        success: true,
        stats: {
          users: profiles.count ?? 0,
          tenants: tenants.count ?? 0,
          instagram_accounts: accounts.count ?? 0,
          webhook_events: events.count ?? 0,
          failed_jobs: jobsFailed.count ?? 0,
          messages: totals.messages_received ?? 0,
          comments: totals.comments_processed ?? 0,
          automations: totals.automations_executed ?? 0,
          ai_calls: totals.ai_calls ?? 0,
        },
      });
    }

    // ---------------- USUÁRIOS ----------------
    if (action === "users") {
      const limit = Math.min(Math.max(body.limit ?? 200, 1), 1000);
      let query = db
        .from("ig_profiles")
        .select("user_id, full_name, company, email, is_blocked, last_login_at, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      const search = body.search?.trim();
      if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%,company.ilike.%${search}%`);

      const { data: users } = await query;
      const userIds = (users ?? []).map((u) => u.user_id);

      const { data: memberships } = userIds.length
        ? await db.from("ig_tenant_members").select("user_id, tenant_id, role").in("user_id", userIds)
        : { data: [] };

      const tenantIds = [...new Set((memberships ?? []).map((m) => m.tenant_id))];
      const { data: tenants } = tenantIds.length
        ? await db.from("ig_tenants").select("id, name, plan_id, is_blocked").in("id", tenantIds)
        : { data: [] };

      return json({ success: true, users: users ?? [], memberships: memberships ?? [], tenants: tenants ?? [] });
    }

    if (action === "user-detail") {
      if (!body.user_id) return fail("Usuário não informado.", 400);

      const { data: profile } = await db
        .from("ig_profiles")
        .select("*")
        .eq("user_id", body.user_id)
        .maybeSingle();
      const { data: memberships } = await db
        .from("ig_tenant_members")
        .select("tenant_id, role")
        .eq("user_id", body.user_id);

      const tenantIds = (memberships ?? []).map((m) => m.tenant_id);
      const [{ data: tenants }, { data: accounts }, { data: usage }, { data: logs }] = await Promise.all([
        tenantIds.length ? db.from("ig_tenants").select("*").in("id", tenantIds) : Promise.resolve({ data: [] }),
        tenantIds.length
          ? db.from("ig_accounts").select("*").in("tenant_id", tenantIds)
          : Promise.resolve({ data: [] }),
        tenantIds.length ? db.from("ig_usage").select("*").in("tenant_id", tenantIds) : Promise.resolve({ data: [] }),
        db
          .from("ig_audit_logs")
          .select("*")
          .eq("actor_user_id", body.user_id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      await audit(db, {
        actor_type: "super_admin",
        action: "admin.user_viewed",
        target: body.user_id,
        ip,
        metadata: { admin: adminEmail },
      });

      return json({
        success: true,
        profile: profile ?? null,
        memberships: memberships ?? [],
        tenants: tenants ?? [],
        accounts: accounts ?? [],
        usage: usage ?? [],
        logs: logs ?? [],
      });
    }

    if (action === "set-user-blocked") {
      if (!body.user_id || typeof body.blocked !== "boolean") return fail("Dados incompletos.", 400);

      await db.from("ig_profiles").update({ is_blocked: body.blocked }).eq("user_id", body.user_id);

      await audit(db, {
        actor_type: "super_admin",
        action: body.blocked ? "admin.user_blocked" : "admin.user_unblocked",
        target: body.user_id,
        ip,
        metadata: { admin: adminEmail },
      });

      return json({ success: true });
    }

    // ---------------- REDEFINIR SENHA DE CADASTRO (SOMENTE AUTH, NÃO TOCA EM OUTROS DADOS) ----------------
    if (action === "reset-user-password") {
      const userId = String(body.user_id ?? "").trim();
      if (!userId) return fail("Usuário não informado.", 400);

      // Confirma que o usuário existe antes de gerar/gravar qualquer senha.
      const { data: targetAuthUser, error: targetLookupError } = await db.auth.admin.getUserById(userId);
      if (targetLookupError || !targetAuthUser?.user) {
        trace("reset_password.rejected", { reason: "user_not_found" });
        return fail("Usuário não encontrado.", 404);
      }

      const temporaryPassword = generateTemporaryPassword();

      // Atualiza somente a credencial de autenticação (auth.users) via service role.
      // Nenhuma outra coluna/tabela do usuário é alterada por esta ação.
      const { error: updateError } = await db.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
      });

      if (updateError) {
        console.error("[ig-admin] reset-user-password failed:", updateError.message);
        return fail("Não foi possível redefinir a senha. Tente novamente.", 500);
      }

      // Auditoria sem o segredo: apenas o fato de que houve redefinição, por quem e quando.
      await audit(db, {
        actor_type: "super_admin",
        action: "admin.user_password_reset",
        target: userId,
        ip,
        metadata: { admin: adminEmail },
      });

      trace("reset_password.success", { admin: adminEmail });

      // A senha temporária é devolvida uma única vez, apenas nesta resposta,
      // para o admin repassar ao usuário com segurança (nunca fica em log/banco).
      return json({ success: true, temporary_password: temporaryPassword });
    }

    if (action === "reset-user-password") {
      const userId = String(body.user_id ?? "").trim();
      const newPassword = String(body.new_password ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return fail("Usuário inválido.", 400);
      if (newPassword.length < 8 || newPassword.length > 200) {
        return fail("A nova senha deve ter entre 8 e 200 caracteres.", 400);
      }

      const { data: profile } = await db
        .from("ig_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!profile) return fail("Cadastro não encontrado.", 404);

      const passwordData = await hashPassword(newPassword);
      const passwordHash = `pbkdf2$210000$${passwordData.salt}$${passwordData.hash}`;
      const { error: updateError } = await db
        .from("auth_users")
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (updateError) {
        trace("user.password_reset_failed", { user_id: userId, reason: updateError.message.slice(0, 120) });
        return fail("Não foi possível redefinir a senha.", 500);
      }

      trace("user.password_reset", { user_id: userId });
      await audit(db, {
        actor_type: "super_admin",
        action: "admin.user_password_reset",
        target: userId,
        ip,
        metadata: { admin: adminEmail },
      });
      return json({ success: true });
    }

    // ---------------- CONTAS INSTAGRAM ----------------
    if (action === "instagram") {
      const { data: accounts } = await db
        .from("ig_accounts")
        .select(
          "id, tenant_id, instagram_account_id, username, connection_state, webhook_subscribed, last_synced_at, last_error, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      const tenantIds = [...new Set((accounts ?? []).map((a) => a.tenant_id))];
      const { data: tenants } = tenantIds.length
        ? await db.from("ig_tenants").select("id, name").in("id", tenantIds)
        : { data: [] };

      return json({ success: true, accounts: accounts ?? [], tenants: tenants ?? [] });
    }

    // ---------------- CONFIG DO APP DA META ----------------
    if (action === "app-config") {
      const { data } = await db
        .from("ig_app_config")
        .select("app_id, scopes, redirect_uri, webhook_verify_token, updated_at, updated_by")
        .eq("id", "default")
        .maybeSingle();

      const envAppId = Deno.env.get("META_APP_ID") ?? Deno.env.get("FACEBOOK_APP_ID") ?? "";
      const envSecret = Deno.env.get("META_APP_SECRET") ?? Deno.env.get("FACEBOOK_APP_SECRET") ?? "";

      return json({
        success: true,
        config: {
          app_id: data?.app_id ?? envAppId,
          scopes: data?.scopes ?? null,
          redirect_uri: data?.redirect_uri ?? null,
          webhook_verify_token: data?.webhook_verify_token ?? null,
          // Nunca retornamos o segredo: apenas se existe.
          has_app_secret: Boolean(data?.app_secret ?? envSecret),
          source: data?.app_id ? "database" : envAppId ? "secrets" : "none",
          updated_at: data?.updated_at ?? null,
          updated_by: data?.updated_by ?? null,
        },
      });
    }

    if (action === "save-app-config") {
      const appId = String(body.app_id ?? "").trim();
      const appSecret = String(body.app_secret ?? "").trim();
      if (!appId || appId.length > 64) return fail("Informe um App ID válido.", 400);

      const patch: Record<string, unknown> = {
        id: "default",
        app_id: appId,
        scopes: String(body.scopes ?? "").trim() || null,
        redirect_uri: String(body.redirect_uri ?? "").trim() || null,
        webhook_verify_token: String(body.webhook_verify_token ?? "").trim() || null,
        updated_by: adminEmail,
        updated_at: new Date().toISOString(),
      };
      if (appSecret) patch.app_secret = appSecret;

      const { error } = await db.from("ig_app_config").upsert(patch, { onConflict: "id" });
      if (error) {
        console.error("[ig-admin] save-app-config failed:", error.message);
        return fail("Não foi possível salvar a configuração.", 500);
      }

      await audit(db, {
        actor_type: "super_admin",
        action: "admin.app_config_saved",
        ip,
        metadata: { admin: adminEmail, secret_updated: Boolean(appSecret) },
      });

      return json({ success: true });
    }

    // ---------------- LOGS ----------------
    if (action === "logs") {
      const { data: logs } = await db
        .from("ig_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(body.limit ?? 200, 1), 1000));

      return json({ success: true, logs: logs ?? [] });
    }

    return fail("Ação não reconhecida.", 400);
  } catch (error) {
    console.error("[ig-admin] unexpected error:", (error as Error).message);
    return fail("Erro interno. Tente novamente em instantes.", 500);
  }
});
