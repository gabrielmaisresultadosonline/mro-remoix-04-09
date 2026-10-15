/**
 * IG ONLINES — monitoramento interno dos perfis do Instagram logados na extensão.
 *
 * Dois públicos no mesmo endpoint:
 *  - Extensão (sem token de admin): `ping` e `message_event`.
 *  - Painel /admin → IG Onlines (token HMAC em x-admin-token): listagem,
 *    estatísticas, avisos e relatórios.
 *
 * Motivo do desenho: a identificação vem do perfil logado no Instagram, e não
 * do login de usuário/senha da ferramenta. Assim, mesmo quando alguém burla o
 * controle de acesso, o perfil aparece aqui e é comparado com o banco MRO.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isAdminRequest } from "../_shared/require-admin.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-extension-version, x-requested-with, accept, origin",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);

/** Aceita URL, @handle ou nome puro. */
const normalizeIG = (input: unknown): string => {
  const value = String(input ?? "").trim();
  const urlMatch = value.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._]+)/i);
  const raw = urlMatch ? urlMatch[1] : value;
  return raw.replace(/^@/, "").split("/")[0].split("?")[0].split("#")[0].toLowerCase().slice(0, 60);
};

/** Navegador e sistema a partir do user agent (apenas para exibição). */
function parseAgent(ua: string): { browser: string; os: string } {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
    ? "Opera"
    : /Brave/.test(ua)
    ? "Brave"
    : /Chrome\//.test(ua)
    ? "Chrome"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Safari\//.test(ua)
    ? "Safari"
    : "Desconhecido";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
    ? "macOS"
    : /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Linux/.test(ua)
    ? "Linux"
    : "Desconhecido";
  return { browser, os };
}

type Status = "client" | "trial" | "unknown";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    /** Compara o perfil logado com os cadastros MRO e com o teste grátis. */
    async function classify(ig: string): Promise<{ status: Status; mro_username: string | null }> {
      const { data: acc } = await db
        .from("mro_tool_accounts")
        .select("user_id, instagram_username")
        .ilike("instagram_username", ig)
        .limit(1);
      if (acc?.length) {
        const { data: user } = await db
          .from("mro_tool_users")
          .select("username")
          .eq("id", acc[0].user_id)
          .maybeSingle();
        return { status: "client", mro_username: (user?.username as string) ?? null };
      }
      const { data: trial } = await db
        .from("teste002_users")
        .select("username")
        .ilike("instagram_username", ig)
        .limit(1);
      if (trial?.length) return { status: "trial", mro_username: (trial[0].username as string) ?? null };
      return { status: "unknown", mro_username: null };
    }

    // ───────────────────────── Extensão ─────────────────────────

    if (action === "ping") {
      const ig = normalizeIG(body.instagram ?? body.instagram_username);
      if (!ig || !/^[a-z0-9._]{1,60}$/.test(ig)) return json({ success: false, error: "Instagram inválido" }, 400);

      const ua = clean(body.user_agent ?? req.headers.get("user-agent"), 400);
      const { browser, os } = parseAgent(ua);
      const url = clean(body.url, 300);
      const version = clean(body.extension_version ?? req.headers.get("x-extension-version"), 40);
      const { status, mro_username } = await classify(ig);
      const now = new Date().toISOString();

      const { data: existing } = await db
        .from("ig_online_sessions")
        .select("id, total_pings, first_seen_at")
        .ilike("instagram_username", ig)
        .maybeSingle();

      let sessionId = existing?.id as string | undefined;
      if (sessionId) {
        await db
          .from("ig_online_sessions")
          .update({
            mro_username,
            status,
            flagged: status === "unknown",
            browser,
            os,
            user_agent: ua,
            ip,
            last_url: url,
            extension_version: version,
            total_pings: Number(existing?.total_pings ?? 0) + 1,
            last_seen_at: now,
          })
          .eq("id", sessionId);
      } else {
        const { data: created } = await db
          .from("ig_online_sessions")
          .insert({
            instagram_username: ig,
            mro_username,
            status,
            flagged: status === "unknown",
            browser,
            os,
            user_agent: ua,
            ip,
            last_url: url,
            extension_version: version,
            total_pings: 1,
          })
          .select("id")
          .single();
        sessionId = created?.id as string | undefined;
      }

      await db.from("ig_online_events").insert({
        session_id: sessionId ?? null,
        instagram_username: ig,
        mro_username,
        status,
        browser,
        user_agent: ua,
        ip,
        url,
      });

      // Avisos pendentes: direcionados ao perfil, a todos, ou só aos não cadastrados.
      const { data: msgs } = await db
        .from("ig_online_messages")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(50);

      const applicable = (msgs ?? []).filter((m) => {
        if (m.target_scope === "all") return true;
        if (m.target_scope === "unknown") return status === "unknown";
        return normalizeIG(m.target_instagram) === ig;
      });

      const pending: Record<string, unknown>[] = [];
      for (const m of applicable) {
        const { data: seen } = await db
          .from("ig_online_message_events")
          .select("id, created_at")
          .eq("message_id", m.id)
          .ilike("instagram_username", ig)
          .eq("event", "closed")
          .order("created_at", { ascending: false })
          .limit(1);
        const closed = seen?.[0];
        if (closed) {
          if (!m.repeat_daily) continue;
          const sameDay = new Date(closed.created_at as string).toDateString() === new Date().toDateString();
          if (sameDay) continue;
        }
        pending.push({
          id: m.id,
          title: m.title,
          body: m.body,
          image_url: m.image_url,
          buttons: m.buttons ?? [],
          blocking: m.blocking,
          lock_seconds: m.lock_seconds,
        });
        await db
          .from("ig_online_message_events")
          .insert({ message_id: m.id, instagram_username: ig, event: "delivered" });
      }

      return json({ success: true, status, mro_username, registered: status !== "unknown", messages: pending });
    }

    if (action === "message_event") {
      const ig = normalizeIG(body.instagram ?? body.instagram_username);
      const messageId = clean(body.message_id, 60);
      const event = clean(body.event, 20);
      if (!ig || !messageId || !["shown", "closed", "clicked"].includes(event))
        return json({ success: false, error: "Dados inválidos" }, 400);
      await db.from("ig_online_message_events").insert({
        message_id: messageId,
        instagram_username: ig,
        event,
        detail: clean(body.detail, 200) || null,
      });
      return json({ success: true });
    }

    // ───────────────────────── Painel admin ─────────────────────────

    if (!(await isAdminRequest(req, body))) return json({ success: false, error: "Sessão admin inválida" }, 401);

    if (action === "admin_list") {
      const search = normalizeIG(body.search);
      let query = db.from("ig_online_sessions").select("*").order("last_seen_at", { ascending: false }).limit(500);
      if (search) query = query.ilike("instagram_username", `%${search}%`);
      const { data: sessions, error } = await query;
      if (error) return json({ success: false, error: error.message }, 400);

      const onlineLimit = Date.now() - 5 * 60 * 1000;
      const rows = (sessions ?? []).map((s) => ({
        ...s,
        online: new Date(s.last_seen_at as string).getTime() >= onlineLimit,
      }));
      return json({
        success: true,
        sessions: rows,
        stats: {
          total: rows.length,
          online: rows.filter((r) => r.online).length,
          clients: rows.filter((r) => r.status === "client").length,
          trials: rows.filter((r) => r.status === "trial").length,
          unknown: rows.filter((r) => r.status === "unknown").length,
        },
      });
    }

    if (action === "admin_history") {
      const ig = normalizeIG(body.instagram);
      const { data } = await db
        .from("ig_online_events")
        .select("*")
        .ilike("instagram_username", ig)
        .order("created_at", { ascending: false })
        .limit(200);
      return json({ success: true, events: data ?? [] });
    }

    if (action === "admin_delete_session") {
      const id = clean(body.id, 60);
      await db.from("ig_online_sessions").delete().eq("id", id);
      return json({ success: true });
    }

    if (action === "admin_send_message") {
      const scope = ["one", "all", "unknown"].includes(String(body.target_scope)) ? String(body.target_scope) : "one";
      const target = scope === "one" ? normalizeIG(body.target_instagram) : null;
      if (scope === "one" && !target) return json({ success: false, error: "Informe o Instagram de destino" }, 400);
      const title = clean(body.title, 120);
      const text = clean(body.body, 2000);
      if (!title && !text) return json({ success: false, error: "Escreva o aviso" }, 400);

      const rawButtons = Array.isArray(body.buttons) ? body.buttons : [];
      const buttons = rawButtons
        .slice(0, 3)
        .map((b) => {
          const item = (b ?? {}) as Record<string, unknown>;
          return { label: clean(item.label, 60), url: clean(item.url, 400) };
        })
        .filter((b) => b.label && /^https?:\/\//i.test(b.url));

      const { data, error } = await db
        .from("ig_online_messages")
        .insert({
          target_instagram: target,
          target_scope: scope,
          title,
          body: text,
          image_url: clean(body.image_url, 500) || null,
          buttons,
          blocking: Boolean(body.blocking),
          lock_seconds: Math.max(0, Math.min(60, Number(body.lock_seconds ?? 0) || 0)),
          repeat_daily: Boolean(body.repeat_daily),
          created_by: "admin",
        })
        .select("id")
        .single();
      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, id: data?.id });
    }

    if (action === "admin_messages") {
      const { data: msgs } = await db
        .from("ig_online_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const ids = (msgs ?? []).map((m) => m.id);
      const { data: events } = ids.length
        ? await db.from("ig_online_message_events").select("message_id, event, instagram_username").in("message_id", ids)
        : { data: [] as { message_id: string; event: string; instagram_username: string }[] };

      const report = (msgs ?? []).map((m) => {
        const mine = (events ?? []).filter((e) => e.message_id === m.id);
        const uniq = (ev: string) => new Set(mine.filter((e) => e.event === ev).map((e) => e.instagram_username)).size;
        return { ...m, delivered: uniq("delivered"), shown: uniq("shown"), closed: uniq("closed"), clicked: uniq("clicked") };
      });
      return json({ success: true, messages: report });
    }

    if (action === "admin_toggle_message") {
      const id = clean(body.id, 60);
      await db.from("ig_online_messages").update({ active: Boolean(body.active) }).eq("id", id);
      return json({ success: true });
    }

    if (action === "admin_delete_message") {
      await db.from("ig_online_messages").delete().eq("id", clean(body.id, 60));
      return json({ success: true });
    }

    return json({ success: false, error: "Ação desconhecida" }, 400);
  } catch (err) {
    console.error("[ig-online-api]", err);
    return json({ success: false, error: "Erro interno" }, 500);
  }
});
