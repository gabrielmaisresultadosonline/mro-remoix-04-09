import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const log = (step: string, details?: unknown) => {
  console.log(`[ZAPMRO-API] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

/** SHA-256 hashing (Web Crypto) — same standard used elsewhere in the project. */
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface ZapmroUserRow {
  id: string;
  username: string;
  email: string | null;
  name: string | null;
  is_active: boolean | null;
  days_remaining: number | null;
  expires_at: string | null;
  password_hash: string | null;
  last_access: string | null;
  whatsapp: string | null;
  whatsapp_limit: number | null;
  registered_numbers: string[] | null;
  created_at: string;
}


/** Computes whether a user still has valid access. */
function computeAccess(user: ZapmroUserRow): { active: boolean; reason: string | null } {
  if (user.is_active === false) return { active: false, reason: "Acesso desativado" };
  if (user.expires_at && new Date(user.expires_at).getTime() < Date.now()) {
    return { active: false, reason: "Acesso expirado" };
  }
  if (typeof user.days_remaining === "number" && user.days_remaining <= 0) {
    return { active: false, reason: "Acesso expirado" };
  }
  return { active: true, reason: null };
}

function publicUser(user: ZapmroUserRow) {
  const { active, reason } = computeAccess(user);
  
  // Determinando o tipo de plano baseado nos dias restantes
  let planType = 'mensal';
  const days = user.days_remaining ?? 0;
  const isVitalicio = days >= 3650 || (!user.expires_at && days > 3650);
  
  if (isVitalicio) {
    planType = 'vitalicio';
  } else if (days > 185) {
    planType = 'anual';
  } else if (days > 31) {
    planType = 'semestral';
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    is_active: active,
    access_denied_reason: reason,
    days_remaining: user.days_remaining ?? 0,
    plan_type: planType,
    expires_at: user.expires_at,
    last_access: user.last_access,
    whatsapp: user.whatsapp,
    whatsapp_limit: user.whatsapp_limit ?? 1,
    registered_numbers: user.registered_numbers || [],
    created_at: user.created_at,
  };
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resilient body parsing (some clients/extensions send text/plain).
    const raw = await req.text();
    let body: Record<string, any> = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ success: false, error: "Corpo da requisição inválido" }, 400);
    }

    // Executa a sincronização de dias antes de qualquer ação
    await supabase.rpc('sync_zapmro_days');

    const action = String(body.action || "");
    log("Request", { action });

    /** Client IP from proxy headers. */
    const clientIp =
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    /** Checks if an IP is blocked (globally or for that username). */
    async function isIpBlocked(username: string, ip: string) {
      const { data } = await supabase
        .from("zapmro_blocked_ips")
        .select("id")
        .eq("ip", ip)
        .or(`username.is.null,username.eq.${username}`)
        .limit(1);
      return !!(data && data.length);
    }

    /** Creates/updates the session row for a user + IP pair. */
    async function touchSession(user: ZapmroUserRow, ip: string, ua: string) {
      const nowIso = new Date().toISOString();
      const { data: existing } = await supabase
        .from("zapmro_user_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("ip", ip)
        .maybeSingle();

      const deviceLabel = /mobile|android|iphone/i.test(ua)
        ? "Mobile"
        : /chrome/i.test(ua)
        ? "Chrome / Desktop"
        : "Desktop";

      if (existing) {
        await supabase
          .from("zapmro_user_sessions")
          .update({ last_seen: nowIso, is_active: true, revoked_at: null, user_agent: ua, device_label: deviceLabel })
          .eq("id", existing.id);
      } else {
        await supabase.from("zapmro_user_sessions").insert({
          user_id: user.id,
          username: user.username,
          ip,
          user_agent: ua,
          device_label: deviceLabel,
          is_active: true,
          first_seen: nowIso,
          last_seen: nowIso,
        });
      }
    }

    // ---------------------------------------------------------------
    // PUBLIC: login (username OR email + senha)
    // ---------------------------------------------------------------
    if (action === "login") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (!identifier || !password) {
        return json({ success: false, error: "Usuário/email e senha são obrigatórios" }, 400);
      }
      if (identifier.length > 255 || password.length > 255) {
        return json({ success: false, error: "Credenciais inválidas" }, 400);
      }

      const { data: users } = await supabase
        .from("zapmro_users")
        .select("*")
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .limit(1);

      const user = (users?.[0] || null) as ZapmroUserRow | null;
      if (!user || !user.password_hash) {
        return json({ success: false, error: "Usuário ou senha incorretos" }, 200);
      }

      const hash = await sha256(password);
      if (hash !== user.password_hash) {
        return json({ success: false, error: "Usuário ou senha incorretos" }, 200);
      }

      const { active, reason } = computeAccess(user);
      if (!active) {
        // Se o acesso expirou, revoga todas as sessões ativas do usuário
        await supabase
          .from("zapmro_user_sessions")
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq("user_id", user.id);
        
        return json({ success: false, error: reason, needs_renewal: true }, 200);
      }

      if (await isIpBlocked(user.username, clientIp)) {
        return json({ success: false, error: "IP bloqueado", ip_blocked: true }, 200);
      }

      await supabase
        .from("zapmro_users")
        .update({ last_access: new Date().toISOString() })
        .eq("id", user.id);

      await touchSession(user, clientIp, userAgent);

      return json({ success: true, user: publicUser(user), ip: clientIp });
    }

    // ---------------------------------------------------------------
    // PUBLIC: verify_user (checagem de acesso sem senha)
    // ---------------------------------------------------------------
    if (action === "verify_user") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      if (!identifier) return json({ success: false, error: "Usuário ou email é obrigatório" }, 400);

      const { data: users } = await supabase
        .from("zapmro_users")
        .select("*")
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .limit(1);

      const user = (users?.[0] || null) as ZapmroUserRow | null;
      if (!user) return json({ success: false, error: "Usuário não encontrado" }, 200);

      const { active, reason } = computeAccess(user);
      if (!active) {
        // Se o acesso expirou durante a verificação, desloga o usuário revogando sessões
        await supabase
          .from("zapmro_user_sessions")
          .update({ is_active: false, revoked_at: new Date().toISOString() })
          .eq("user_id", user.id);
          
        return json({ success: false, error: reason, needs_renewal: true, user: publicUser(user) }, 200);
      }

      return json({ success: true, user: publicUser(user) });
    }

    // ---------------------------------------------------------------
    // PUBLIC: avisos ativos (tutoriais dos alunos + ferramenta externa)
    // ---------------------------------------------------------------
    if (action === "get_announcements") {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("zapmro_announcements")
        .select("*")
        .eq("is_active", true)
        .or(`start_date.is.null,start_date.lte.${nowIso}`)
        .order("created_at", { ascending: false });

      if (error) return json({ success: false, error: error.message }, 500);

      const announcements = (data || []).filter(
        (a: any) => !a.end_date || new Date(a.end_date).getTime() > Date.now(),
      );

      return json({ success: true, announcements });
    }

    // ---------------------------------------------------------------
    // ADMIN: usuários
    // ---------------------------------------------------------------
    if (action === "list_users") {
      const { data, error } = await supabase
        .from("zapmro_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return json({ success: false, error: error.message }, 500);

      // Senha padrão = usuário: se só existe o hash, confirma se ele corresponde ao
      // usuário e devolve a senha em texto para o admin copiar o acesso completo.
      const users = await Promise.all((data || []).map(async (u: any) => {
        const { password_hash, ...rest } = u;
        let plain: string | null = u.password_plain ? String(u.password_plain) : null;
        if (!plain && password_hash && u.username) {
          const uname = String(u.username).trim();
          for (const candidate of new Set([uname, uname.toLowerCase()])) {
            if ((await sha256(candidate)) === password_hash) { plain = candidate; break; }
          }
        }
        return { ...rest, password_plain: plain, has_password: !!password_hash || !!plain };
      }));

      return json({ success: true, users });
    }

    if (action === "upsert_user") {
      const username = String(body.username || "").trim().toLowerCase();
      if (!username) return json({ success: false, error: "Usuário é obrigatório" }, 400);

      const payload: Record<string, unknown> = {
        username,
        email: body.email ? String(body.email).trim().toLowerCase() : null,
        name: body.name ? String(body.name).trim() : null,
        whatsapp: body.whatsapp ? String(body.whatsapp).trim() : null,
        whatsapp_limit: body.whatsapp_limit !== undefined ? Number(body.whatsapp_limit) : 1,
      };

      if (body.is_active !== undefined) payload.is_active = !!body.is_active;
      if (body.days_remaining !== undefined && body.days_remaining !== null && body.days_remaining !== "") {
        payload.days_remaining = Number(body.days_remaining);
      }
      if (body.expires_at !== undefined) payload.expires_at = body.expires_at || null;
      if (body.password) {
        payload.password_hash = await sha256(String(body.password));
        // Cópia visível para o admin conseguir reenviar/copiar o acesso do cliente.
        payload.password_plain = String(body.password);
      }

      const { data: existing } = await supabase
        .from("zapmro_users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      const query = existing
        ? supabase.from("zapmro_users").update(payload).eq("id", existing.id)
        : supabase.from("zapmro_users").insert(payload);

      const { error } = await query;
      if (error) return json({ success: false, error: error.message }, 500);

      return json({ success: true });
    }

    // Importação em massa (colar lista exportada).
    if (action === "bulk_import_users") {
      const items = Array.isArray(body.users) ? body.users : [];
      if (!items.length) return json({ success: false, error: "Lista vazia" }, 400);

      const errors: string[] = [];
      let created = 0;
      let updated = 0;

      const normalized = items
        .map((it: any) => ({
          username: String(it?.username || "").trim().toLowerCase(),
          password: String(it?.password || "").trim(),
          days_remaining: Math.min(Number(it?.days_remaining) || 0, 999999),
          is_active: it?.is_active !== false,
        }))
        .filter((it: any) => it.username);

      if (!normalized.length) return json({ success: false, error: "Nenhum usuário válido" }, 400);

      const usernames = normalized.map((u: any) => u.username);
      const { data: existingRows } = await supabase
        .from("zapmro_users")
        .select("id, username")
        .in("username", usernames);

      const existingMap = new Map<string, string>();
      (existingRows || []).forEach((r: any) => existingMap.set(r.username, r.id));

      for (const item of normalized) {
        const payload: Record<string, unknown> = {
          username: item.username,
          days_remaining: item.days_remaining,
          is_active: item.is_active,
        };
        if (item.password) {
          payload.password_hash = await sha256(item.password);
          payload.password_plain = item.password;
        }

        const existingId = existingMap.get(item.username);
        const { error } = existingId
          ? await supabase.from("zapmro_users").update(payload).eq("id", existingId)
          : await supabase.from("zapmro_users").insert(payload);

        if (error) {
          errors.push(`${item.username}: ${error.message}`);
        } else if (existingId) {
          updated++;
        } else {
          created++;
        }
      }

      return json({ success: true, created, updated, errors });
    }

    /**
     * Vincula emails e senhas já cadastrados na área de acessos (created_accesses)
     * aos usuários do ZAPMRO, permitindo copiar/reenviar o acesso.
     */
    if (action === "sync_credentials") {
      const { data: accesses } = await supabase
        .from("created_accesses")
        .select("username, customer_email, password")
        .order("created_at", { ascending: false });

      const emailBy = new Map<string, string>();
      const passBy = new Map<string, string>();
      for (const row of accesses || []) {
        const u = String((row as any).username || "").trim().toLowerCase();
        const e = String((row as any).customer_email || "").trim().toLowerCase();
        const p = String((row as any).password || "").trim();
        if (!u) continue;
        if (e && !emailBy.has(u)) emailBy.set(u, e);
        if (p && !passBy.has(u)) passBy.set(u, p);
      }

      const { data: allUsers } = await supabase
        .from("zapmro_users")
        .select("id, username, email, password_plain");

      let updated = 0;
      let passwords = 0;
      for (const u of (allUsers || []) as any[]) {
        const key = String(u.username || "").trim().toLowerCase();
        const patch: Record<string, unknown> = {};
        const email = emailBy.get(key);
        if (email && !u.email) patch.email = email;
        const password = passBy.get(key);
        if (password && !u.password_plain) {
          patch.password_plain = password;
          patch.password_hash = await sha256(password);
        }
        if (!Object.keys(patch).length) continue;
        const { error } = await supabase.from("zapmro_users").update(patch).eq("id", u.id);
        if (!error) {
          updated += 1;
          if (patch.password_plain) passwords += 1;
        }
      }

      return json({ success: true, updated, passwords, total: (allUsers || []).length });
    }

    /**
     * Torna todos os usuários atuais vitalícios (999999 dias e limite ilimitado).
     */
    if (action === "make_all_lifetime") {
      const { error } = await supabase
        .from("zapmro_users")
        .update({ 
          days_remaining: 999999,
          whatsapp_limit: -1 
        })
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Filtro dummy para garantir execução

      if (error) return json({ success: false, error: error.message }, 500);

      return json({ success: true });
    }


    /** Reenvia o acesso do cliente por email (template oficial de boas-vindas). */
    if (action === "send_access") {
      const id = String(body.id || "");
      if (!id) return json({ success: false, error: "ID é obrigatório" }, 400);

      const { data: user } = await supabase
        .from("zapmro_users")
        .select("id, username, email, password_plain, days_remaining")
        .eq("id", id)
        .maybeSingle();

      if (!user) return json({ success: false, error: "Usuário não encontrado" }, 404);
      if (!(user as any).email) return json({ success: false, error: "Usuário sem email cadastrado" }, 400);
      if (!(user as any).password_plain) {
        return json({ success: false, error: "Senha não disponível — edite o usuário e defina uma nova senha" }, 400);
      }

      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          email: (user as any).email,
          username: (user as any).username,
          password: (user as any).password_plain,
          daysRemaining: (user as any).days_remaining,
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.success === false) {
        return json({ success: false, error: result?.error || "Falha ao enviar email" }, 500);
      }

      return json({ success: true, email: (user as any).email });
    }


    if (action === "delete_user") {
      if (!body.id) return json({ success: false, error: "ID é obrigatório" }, 400);
      const { error } = await supabase.from("zapmro_users").delete().eq("id", body.id);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "remove_whatsapp") {
      const id = String(body.id || "");
      const number = String(body.number || "").trim();
      if (!id || !number) return json({ success: false, error: "ID e número são obrigatórios" }, 400);

      const { data: user } = await supabase.from("zapmro_users").select("registered_numbers").eq("id", id).maybeSingle();
      if (!user) return json({ success: false, error: "Usuário não encontrado" }, 404);

      const registered = user.registered_numbers || [];
      const updated = registered.filter((n: string) => n !== number);

      const { error } = await supabase.from("zapmro_users").update({ registered_numbers: updated }).eq("id", id);
      if (error) return json({ success: false, error: error.message }, 500);

      return json({ success: true });
    }

    // ---------------------------------------------------------------
    // ADMIN: avisos
    // ---------------------------------------------------------------
    if (action === "list_announcements") {
      const { data, error } = await supabase
        .from("zapmro_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, announcements: data || [] });
    }

    if (action === "save_announcement") {
      const title = String(body.title || "").trim();
      if (!title) return json({ success: false, error: "Título é obrigatório" }, 400);

      const payload = {
        title,
        content: body.content ? String(body.content) : null,
        image_url: body.image_url || null,
        video_url: body.video_url || null,
        is_active: body.is_active !== false,
        is_blocking: !!body.is_blocking,
        display_duration: Number(body.display_duration || 0),
        end_date: body.end_date || null,
      };

      const query = body.id
        ? supabase.from("zapmro_announcements").update(payload).eq("id", body.id)
        : supabase.from("zapmro_announcements").insert(payload);

      const { error } = await query;
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "delete_announcement") {
      if (!body.id) return json({ success: false, error: "ID é obrigatório" }, 400);
      const { error } = await supabase.from("zapmro_announcements").delete().eq("id", body.id);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    // ---------------------------------------------------------------
    // PUBLIC: heartbeat (mantém sessão "online" e valida revogação)
    // ---------------------------------------------------------------
    if (action === "heartbeat") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      if (!identifier) return json({ success: false, error: "Usuário é obrigatório" }, 400);

      const { data: users } = await supabase
        .from("zapmro_users")
        .select("*")
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .limit(1);

      const user = (users?.[0] || null) as ZapmroUserRow | null;
      if (!user) return json({ success: false, error: "Usuário não encontrado" }, 200);

      if (await isIpBlocked(user.username, clientIp)) {
        return json({ success: false, ip_blocked: true, error: "IP bloqueado" }, 200);
      }

      const { data: session } = await supabase
        .from("zapmro_user_sessions")
        .select("id, is_active")
        .eq("user_id", user.id)
        .eq("ip", clientIp)
        .maybeSingle();

      if (session && session.is_active === false) {
        return json({ success: false, session_revoked: true, error: "Sessão encerrada" }, 200);
      }

      await touchSession(user, clientIp, userAgent);

      const { active, reason } = computeAccess(user);
      return json({ success: active, error: reason, user: publicUser(user) });
    }

    // ---------------------------------------------------------------
    // PUBLIC: register_whatsapp (vincula um número à conta respeitando o limite)
    // ---------------------------------------------------------------
    if (action === "register_whatsapp") {
      const identifier = String(body.username || body.email || body.identifier || "").trim().toLowerCase();
      const number = String(body.number || "").trim().replace(/\D/g, "");

      if (!identifier || !number) {
        return json({ success: false, error: "Usuário e número são obrigatórios" }, 400);
      }

      const { data: users } = await supabase
        .from("zapmro_users")
        .select("*")
        .or(`username.eq.${identifier},email.eq.${identifier}`)
        .limit(1);

      const user = (users?.[0] || null) as ZapmroUserRow | null;
      if (!user) return json({ success: false, error: "Usuário não encontrado" }, 200);

      const { active, reason } = computeAccess(user);
      if (!active) return json({ success: false, error: reason }, 200);

      const days = user.days_remaining ?? 0;
      const isVitalicio = days >= 3650 || (!user.expires_at && days > 3650);
      const limit = isVitalicio ? -1 : (user.whatsapp_limit ?? 1);
      const registered = user.registered_numbers || [];

      if (registered.includes(number)) {
        return json({ success: true, message: "Número já registrado", user: publicUser(user) });
      }

      if (limit !== -1 && registered.length >= limit) {
        return json({ success: false, error: "Limite de números atingido", limit }, 200);
      }

      const { error } = await supabase
        .from("zapmro_users")
        .update({ registered_numbers: [...registered, number] })
        .eq("id", user.id);

      if (error) return json({ success: false, error: error.message }, 500);

      return json({ success: true, message: "Número registrado com sucesso", user: publicUser({...user, registered_numbers: [...registered, number]}) });
    }


    // ---------------------------------------------------------------
    // ADMIN: sessões / IPs
    // ---------------------------------------------------------------
    if (action === "list_sessions") {
      const { data: sessions, error } = await supabase
        .from("zapmro_user_sessions")
        .select("*")
        .order("last_seen", { ascending: false });
      if (error) return json({ success: false, error: error.message }, 500);

      const { data: blocked } = await supabase
        .from("zapmro_blocked_ips")
        .select("*")
        .order("created_at", { ascending: false });

      return json({ success: true, sessions: sessions || [], blocked_ips: blocked || [] });
    }

    if (action === "revoke_session") {
      if (!body.id) return json({ success: false, error: "ID é obrigatório" }, 400);
      const { error } = await supabase
        .from("zapmro_user_sessions")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", body.id);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "revoke_all_sessions") {
      const username = String(body.username || "").trim().toLowerCase();
      if (!username) return json({ success: false, error: "Usuário é obrigatório" }, 400);
      const { error } = await supabase
        .from("zapmro_user_sessions")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("username", username);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    if (action === "block_ip") {
      const ip = String(body.ip || "").trim();
      if (!ip) return json({ success: false, error: "IP é obrigatório" }, 400);
      const username = body.username ? String(body.username).trim().toLowerCase() : null;

      const { error } = await supabase.from("zapmro_blocked_ips").insert({
        ip,
        username,
        reason: body.reason ? String(body.reason) : null,
      });
      if (error) return json({ success: false, error: error.message }, 500);

      let revoke = supabase
        .from("zapmro_user_sessions")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("ip", ip);
      if (username) revoke = revoke.eq("username", username);
      await revoke;

      return json({ success: true });
    }

    if (action === "unblock_ip") {
      const ip = String(body.ip || "").trim();
      if (!ip) return json({ success: false, error: "IP é obrigatório" }, 400);
      let query = supabase.from("zapmro_blocked_ips").delete().eq("ip", ip);
      if (body.username) query = query.eq("username", String(body.username).trim().toLowerCase());
      const { error } = await query;
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (error) {
    log("Error", { error: error instanceof Error ? error.message : "Unknown" });
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
