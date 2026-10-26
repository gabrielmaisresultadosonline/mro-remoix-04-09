/**
 * IG ONLINE — implementação nativa no Express + PostgreSQL da VPS.
 *
 * Por que nativo: o módulo recebe pings frequentes da extensão. Rodar no
 * Express evita cold start do Deno e grava direto no PostgreSQL do servidor,
 * sem depender de infraestrutura externa. O contrato JSON é idêntico ao da
 * função `ig-online-api`, então o painel /admin e a extensão não mudam.
 *
 * Públicos:
 *  - Extensão (sem token): ping, metrics, check_access, message_event.
 *  - Painel /admin (x-admin-token HMAC): ações admin_*.
 */
import crypto from "node:crypto";
import type { Request, Response } from "express";
import type { PoolClient } from "pg";
import { pool, adminQuery } from "../db.js";
import { hasValidAdminSession } from "../admin-session.js";

type Status = "client" | "trial" | "unknown";
type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_BLOCK_MSG =
  "Seu acesso à ferramenta MRO foi bloqueado pelo administrador. Fale com o suporte para regularizar.";
const IG_RE = /^[a-z0-9._]{1,60}$/;

// ───────────────────────── utilitários ─────────────────────────

function parseBody(body: unknown): Body {
  try {
    if (Buffer.isBuffer(body)) return JSON.parse(body.toString("utf8") || "{}") as Body;
    if (typeof body === "string") return JSON.parse(body || "{}") as Body;
    if (body && typeof body === "object") return body as Body;
  } catch {
    /* corpo inválido → objeto vazio; a validação abaixo responde 400 */
  }
  return {};
}

const clean = (v: unknown, max: number): string =>
  String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);

/** Aceita URL, @handle ou nome puro. */
function normalizeIG(input: unknown): string {
  const value = String(input ?? "").trim();
  const urlMatch = value.match(/(?:instagram\.com|instagr\.am)\/([a-zA-Z0-9._]+)/i);
  const raw = urlMatch ? urlMatch[1] : value;
  return raw.replace(/^@/, "").split("/")[0].split("?")[0].split("#")[0].toLowerCase().slice(0, 60);
}

function parseAgent(ua: string): { browser: string; os: string } {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Brave/.test(ua) ? "Brave"
    : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Desconhecido";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Desconhecido";
  return { browser, os };
}

/** Dia no horário de Brasília (YYYY-MM-DD). */
const spDay = (d: Date): string => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/** Limite simples por IP+perfil para proteger o banco de loops da extensão. */
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 20_000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

// ───────────────────────── regras de domínio ─────────────────────────

/** Compara o perfil com os cadastros MRO Ferramenta e teste grátis. */
async function classify(ig: string): Promise<{ status: Status; mro_username: string | null }> {
  const acc = await adminQuery<{ username: string | null }>(
    `SELECT u.username FROM public.mro_tool_accounts a
       LEFT JOIN public.mro_tool_users u ON u.id = a.user_id
      WHERE lower(a.instagram_username) = $1 LIMIT 1`,
    [ig],
  ).catch(() => []);
  if (acc.length) return { status: "client", mro_username: acc[0].username ?? null };
  const trial = await adminQuery<{ username: string | null }>(
    "SELECT username FROM public.teste002_users WHERE lower(instagram_username) = $1 LIMIT 1",
    [ig],
  ).catch(() => []);
  if (trial.length) return { status: "trial", mro_username: trial[0].username ?? null };
  return { status: "unknown", mro_username: null };
}

/** Estado de bloqueio — sempre lido do banco, nunca confiado ao cliente. */
async function getBlock(ig: string) {
  const rows = await adminQuery<Row>(
    "SELECT blocked, block_message, blocked_at FROM public.ig_online_sessions WHERE lower(instagram_username) = $1",
    [ig],
  );
  const r = rows[0];
  if (!r?.blocked) return { blocked: false, block_message: null as string | null, blocked_at: null as string | null };
  return { blocked: true, block_message: (r.block_message as string) || DEFAULT_BLOCK_MSG, blocked_at: iso(r.blocked_at) };
}

/** Cria o perfil se não existir (índice único em lower(instagram_username)). */
async function ensureSession(c: PoolClient, ig: string, extra: Row = {}): Promise<Row> {
  const found = await c.query("SELECT * FROM public.ig_online_sessions WHERE lower(instagram_username) = $1 FOR UPDATE", [ig]);
  if (found.rows[0]) return found.rows[0] as Row;
  const { status, mro_username } = await classify(ig);
  const ins = await c.query(
    `INSERT INTO public.ig_online_sessions (instagram_username, mro_username, status, flagged, browser, os, user_agent, ip, last_url, extension_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (lower(instagram_username)) DO UPDATE SET instagram_username = EXCLUDED.instagram_username
     RETURNING *`,
    [ig, mro_username, status, status === "unknown", extra.browser ?? "", extra.os ?? "", extra.user_agent ?? "",
      extra.ip ?? null, extra.last_url ?? null, extra.extension_version ?? null],
  );
  return ins.rows[0] as Row;
}

// ───────────────────────── ações da extensão ─────────────────────────

async function actionPing(body: Body, ip: string | null, uaHeader: string, verHeader: string) {
  const ig = normalizeIG(body.instagram ?? body.instagram_username);
  if (!ig || !IG_RE.test(ig)) return [400, { success: false, error: "Instagram inválido" }] as const;
  const ua = clean(body.user_agent ?? uaHeader, 400);
  const { browser, os } = parseAgent(ua);
  const url = clean(body.url, 300);
  const version = clean(body.extension_version ?? verHeader, 40);
  const { status, mro_username } = await classify(ig);

  await tx(async (c) => {
    const s = await ensureSession(c, ig, { browser, os, user_agent: ua, ip, last_url: url, extension_version: version });
    await c.query(
      `UPDATE public.ig_online_sessions SET mro_username=$2, status=$3, flagged=$4, browser=$5, os=$6, user_agent=$7,
         ip=$8, last_url=$9, extension_version=$10, total_pings = total_pings + 1, last_seen_at = now() WHERE id=$1`,
      [s.id, mro_username, status, status === "unknown", browser, os, ua, ip, url, version],
    );
    await c.query(
      `INSERT INTO public.ig_online_events (session_id, instagram_username, mro_username, status, browser, user_agent, ip, url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [s.id, ig, mro_username, status, browser, ua, ip, url],
    );
  });

  const block = await getBlock(ig);
  const pending: Row[] = [];
  if (!block.blocked) {
    const msgs = await adminQuery<Row>(
      "SELECT * FROM public.ig_online_messages WHERE active = true ORDER BY created_at ASC LIMIT 50",
    );
    const today = spDay(new Date());
    for (const m of msgs) {
      const scope = m.target_scope as string;
      const applies = scope === "all" || (scope === "unknown" && status === "unknown") ||
        (scope === "one" && normalizeIG(m.target_instagram) === ig);
      if (!applies) continue;
      const seen = await adminQuery<{ created_at: Date }>(
        `SELECT created_at FROM public.ig_online_message_events
          WHERE message_id=$1 AND lower(instagram_username)=$2 AND event='closed' ORDER BY created_at DESC LIMIT 1`,
        [m.id, ig],
      );
      if (seen[0] && (!m.repeat_daily || spDay(new Date(seen[0].created_at)) === today)) continue;
      pending.push({
        id: m.id, title: m.title, body: m.body, image_url: m.image_url, buttons: m.buttons ?? [],
        blocking: m.blocking, lock_seconds: m.lock_seconds,
      });
      await adminQuery(
        "INSERT INTO public.ig_online_message_events (message_id, instagram_username, event) VALUES ($1,$2,'delivered')",
        [m.id, ig],
      );
    }
  }
  return [200, { success: true, status, mro_username, registered: status !== "unknown", ...block, messages: pending }] as const;
}

async function actionMetrics(body: Body) {
  const ig = normalizeIG(body.instagram ?? body.instagram_username);
  if (!ig || !IG_RE.test(ig)) return [400, { success: false, error: "Instagram inválido" }] as const;
  // Aceita nomes alternativos e textos como "1.520", "1,5 mil", "12.3K" enviados pela extensão.
  const rawF = body.followers ?? body.followers_count ?? body.follower_count ?? body.seguidores;
  const followers = parseFollowers(rawF);
  if (followers === undefined) {
    console.warn(`[ig-online] metrics @${ig}: valor de seguidores ilegível (${String(rawF).slice(0, 40)}) — ignorado`);
  } else if (followers === null && rawF === undefined) {
    console.info(`[ig-online] metrics @${ig}: recebido sem campo de seguidores (welcome_sent=${String(body.welcome_sent ?? 0)})`);
  }
  const rawW = body.welcome_sent ?? 0;
  const welcome = Number(rawW);
  if (!Number.isInteger(welcome) || welcome < 0 || welcome > 10000)
    return [400, { success: false, error: "welcome_sent deve ser inteiro entre 0 e 10000" }] as const;
  const sessionEvent = body.session === "start" || body.session === "end" ? body.session : null;
  const requestId = clean(body.request_id, 80) || null;
  const day = spDay(new Date());

  const duplicate = await tx(async (c) => {
    if (requestId) {
      const r = await c.query(
        "INSERT INTO public.ig_online_metric_requests (request_id, instagram_username) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [requestId, ig],
      );
      if (r.rowCount === 0) return true; // já processada: não soma de novo
    }
    const s = await ensureSession(c, ig);
    await c.query(
      `UPDATE public.ig_online_sessions SET
         metrics_updated_at = now(), last_seen_at = now(),
         welcome_total = welcome_total + $2,
         followers_current = COALESCE($3, followers_current),
         followers_initial = COALESCE(followers_initial, $3),
         session_started_at = CASE WHEN $4 = 'start' THEN now() ELSE session_started_at END,
         session_ended_at = CASE WHEN $4 = 'start' THEN NULL WHEN $4 = 'end' THEN now() ELSE session_ended_at END
       WHERE id = $1`,
      [s.id, welcome, followers, sessionEvent],
    );
    const upd = await c.query(
      `UPDATE public.ig_online_metrics SET updated_at = now(), welcome_sent = welcome_sent + $3,
         followers_end = COALESCE($4, followers_end), followers_start = COALESCE(followers_start, $4)
       WHERE lower(instagram_username) = $1 AND day = $2`,
      [ig, day, welcome, followers],
    );
    if (upd.rowCount === 0) {
      await c.query(
        `INSERT INTO public.ig_online_metrics (instagram_username, day, followers_start, followers_end, welcome_sent)
         VALUES ($1,$2,$3,$3,$4)
         ON CONFLICT (lower(instagram_username), day) DO UPDATE SET
           welcome_sent = public.ig_online_metrics.welcome_sent + EXCLUDED.welcome_sent,
           followers_end = COALESCE(EXCLUDED.followers_end, public.ig_online_metrics.followers_end),
           updated_at = now()`,
        [ig, day, followers, welcome],
      );
    }
    return false;
  });
  // Limpeza leve dos ids antigos (7 dias) sem bloquear a resposta.
  if (Math.random() < 0.01)
    void adminQuery("DELETE FROM public.ig_online_metric_requests WHERE created_at < now() - interval '7 days'").catch(() => undefined);
  return [200, { success: true, day, duplicate, ...(await getBlock(ig)) }] as const;
}

async function actionCheckAccess(body: Body) {
  const ig = normalizeIG(body.instagram ?? body.instagram_username);
  if (!ig || !IG_RE.test(ig)) return [400, { success: false, error: "Instagram inválido" }] as const;
  const block = await getBlock(ig);
  return [200, { success: true, allowed: !block.blocked, ...block }] as const;
}

async function actionMessageEvent(body: Body) {
  const ig = normalizeIG(body.instagram ?? body.instagram_username);
  const messageId = clean(body.message_id, 60);
  const event = clean(body.event, 20);
  if (!ig || !IG_RE.test(ig) || !/^[0-9a-f-]{36}$/i.test(messageId) || !["shown", "closed", "clicked"].includes(event))
    return [400, { success: false, error: "Dados inválidos" }] as const;
  await adminQuery(
    "INSERT INTO public.ig_online_message_events (message_id, instagram_username, event, detail) VALUES ($1,$2,$3,$4)",
    [messageId, ig, event, clean(body.detail, 200) || null],
  );
  return [200, { success: true }] as const;
}

// ───────────────────────── ações do painel ─────────────────────────

/** BIGINT chega como string no driver pg; o painel espera números. */
const withOnline = (s: Row): Row & { online: boolean } => ({
  ...s,
  total_pings: Number(s.total_pings ?? 0),
  welcome_total: Number(s.welcome_total ?? 0),
  followers_initial: numOrNull(s.followers_initial),
  followers_current: numOrNull(s.followers_current),
  online: Date.now() - new Date(s.last_seen_at as string).getTime() < ONLINE_WINDOW_MS,
});

async function adminList(body: Body) {
  const search = normalizeIG(body.search);
  const rows = (await adminQuery<Row>(
    `SELECT * FROM public.ig_online_sessions ${search ? "WHERE instagram_username ILIKE $1" : ""}
      ORDER BY last_seen_at DESC LIMIT 500`,
    search ? [`%${search}%`] : [],
  )).map(withOnline);
  return [200, {
    success: true, sessions: rows,
    stats: {
      total: rows.length, online: rows.filter((r) => r.online).length,
      clients: rows.filter((r) => r.status === "client").length,
      trials: rows.filter((r) => r.status === "trial").length,
      unknown: rows.filter((r) => r.status === "unknown").length,
    },
  }] as const;
}

async function adminMetrics(body: Body) {
  const days = [1, 7, 30, 90, 365].includes(Number(body.days)) ? Number(body.days) : 30;
  const sinceDay = spDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const sessions = await adminQuery<Row>("SELECT * FROM public.ig_online_sessions ORDER BY last_seen_at DESC LIMIT 1000");
  const metrics = await adminQuery<Row>(
    "SELECT instagram_username, to_char(day,'YYYY-MM-DD') AS day, followers_start, followers_end, welcome_sent FROM public.ig_online_metrics WHERE day >= $1 ORDER BY day ASC LIMIT 20000",
    [sinceDay],
  );
  const byIg = new Map<string, { growth: number | null; welcome: number; days: number }>();
  const series = new Map<string, { growth: number; welcome: number }>();
  const lastF = new Map<string, number>();
  for (const m of metrics) {
    const key = String(m.instagram_username).toLowerCase();
    const day = String(m.day);
    const fs = numOrNull(m.followers_start), fe = numOrNull(m.followers_end);
    const g = fs !== null && fe !== null ? fe - fs : null;
    const cur = byIg.get(key) ?? { growth: null, welcome: 0, days: 0 };
    if (g !== null) cur.growth = (cur.growth ?? 0) + g;
    cur.welcome += Number(m.welcome_sent ?? 0);
    cur.days += 1;
    byIg.set(key, cur);
    const s = series.get(day) ?? { growth: 0, welcome: 0 };
    s.welcome += Number(m.welcome_sent ?? 0);
    if (g !== null) s.growth += g;
    series.set(day, s);
    if (fe !== null) lastF.set(`${day}|${key}`, fe);
  }
  const profiles = new Set(metrics.map((m) => String(m.instagram_username).toLowerCase()));
  const known = new Map<string, number>();
  const outSeries = [...series.keys()].sort().map((d) => {
    for (const p of profiles) { const v = lastF.get(`${d}|${p}`); if (v !== undefined) known.set(p, v); }
    const s = series.get(d)!;
    return { day: d, followers: known.size ? [...known.values()].reduce((a, b) => a + b, 0) : null, growth: s.growth, welcome: s.welcome };
  });
  const rows = sessions.map((s) => {
    const agg = byIg.get(String(s.instagram_username).toLowerCase());
    const fi = numOrNull(s.followers_initial), fc = numOrNull(s.followers_current);
    return {
      id: s.id, instagram_username: s.instagram_username, status: s.status,
      followers_initial: fi, followers_current: fc, followers_diff: fi !== null && fc !== null ? fc - fi : null,
      period_growth: agg?.growth ?? null,
      daily_growth: agg && agg.growth !== null && agg.days ? Math.round((agg.growth / agg.days) * 10) / 10 : null,
      welcome_total: Number(s.welcome_total ?? 0), welcome_period: agg?.welcome ?? 0,
      last_seen_at: iso(s.last_seen_at), session_started_at: iso(s.session_started_at),
      session_ended_at: iso(s.session_ended_at), metrics_updated_at: iso(s.metrics_updated_at),
      blocked: Boolean(s.blocked), block_message: s.block_message ?? null, blocked_at: iso(s.blocked_at),
      online: Date.now() - new Date(s.last_seen_at as string).getTime() < ONLINE_WINDOW_MS,
    };
  });
  const withF = rows.filter((r) => r.followers_current !== null);
  const lastUpdate = rows.reduce<string | null>((a, r) => (r.metrics_updated_at && (!a || r.metrics_updated_at > a) ? r.metrics_updated_at : a), null);
  return [200, {
    success: true, days, rows, series: outSeries,
    summary: {
      profiles: rows.length,
      followers_total: withF.length ? withF.reduce((a, r) => a + Number(r.followers_current), 0) : null,
      growth_period: rows.some((r) => r.period_growth !== null) ? rows.reduce((a, r) => a + Number(r.period_growth ?? 0), 0) : null,
      welcome_period: rows.reduce((a, r) => a + r.welcome_period, 0),
      welcome_total: rows.reduce((a, r) => a + r.welcome_total, 0),
      active_recent: rows.filter((r) => r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < 86_400_000).length,
      online: rows.filter((r) => r.online).length,
      last_update: lastUpdate,
    },
  }] as const;
}

async function adminSetBlock(body: Body) {
  const ig = normalizeIG(body.instagram);
  if (!ig || !IG_RE.test(ig)) return [400, { success: false, error: "Informe o perfil" }] as const;
  const blocked = Boolean(body.blocked);
  const message = clean(body.block_message, 1000) || null;
  const out = await tx(async (c) => {
    const cur = await c.query("SELECT blocked FROM public.ig_online_sessions WHERE lower(instagram_username)=$1 FOR UPDATE", [ig]);
    if (!cur.rows[0]) return null;
    const wasBlocked = Boolean(cur.rows[0].blocked);
    const r = blocked
      ? await c.query(
        `UPDATE public.ig_online_sessions SET blocked = true, block_message = $2,
           blocked_at = CASE WHEN blocked THEN blocked_at ELSE now() END
         WHERE lower(instagram_username) = $1 RETURNING instagram_username, blocked, block_message, blocked_at, unblocked_at`,
        [ig, message])
      : await c.query(
        `UPDATE public.ig_online_sessions SET blocked = false, unblocked_at = now()
         WHERE lower(instagram_username) = $1 RETURNING instagram_username, blocked, block_message, blocked_at, unblocked_at`,
        [ig]);
    const action = blocked ? (wasBlocked ? "message_updated" : "blocked") : "unblocked";
    await c.query(
      "INSERT INTO public.ig_online_block_history (instagram_username, action, block_message, admin_email) VALUES ($1,$2,$3,'admin')",
      [ig, action, blocked ? message : null],
    );
    return r.rows[0];
  });
  if (!out) return [404, { success: false, error: "Perfil não encontrado" }] as const;
  return [200, { success: true, profile: out }] as const;
}

async function adminProfileDetail(body: Body) {
  const ig = normalizeIG(body.instagram);
  const [session] = await adminQuery<Row>("SELECT * FROM public.ig_online_sessions WHERE lower(instagram_username)=$1", [ig]);
  if (!session) return [404, { success: false, error: "Perfil não encontrado" }] as const;
  const [metrics, events, history] = await Promise.all([
    adminQuery<Row>("SELECT to_char(day,'YYYY-MM-DD') AS day, followers_start, followers_end, welcome_sent, updated_at FROM public.ig_online_metrics WHERE lower(instagram_username)=$1 ORDER BY day DESC LIMIT 365", [ig]),
    adminQuery<Row>("SELECT created_at, browser, ip, url FROM public.ig_online_events WHERE lower(instagram_username)=$1 ORDER BY created_at DESC LIMIT 100", [ig]),
    adminQuery<Row>("SELECT action, block_message, admin_email, created_at FROM public.ig_online_block_history WHERE lower(instagram_username)=$1 ORDER BY created_at DESC LIMIT 100", [ig]).catch(() => []),
  ]);
  return [200, {
    success: true, session: withOnline(session),
    metrics: metrics.map((m) => ({ ...m, followers_start: numOrNull(m.followers_start), followers_end: numOrNull(m.followers_end), welcome_sent: Number(m.welcome_sent ?? 0) })),
    events, block_history: history, default_block_message: DEFAULT_BLOCK_MSG,
  }] as const;
}

async function adminSendMessage(body: Body) {
  const scope = ["one", "all", "unknown"].includes(String(body.target_scope)) ? String(body.target_scope) : "one";
  const target = scope === "one" ? normalizeIG(body.target_instagram) : null;
  if (scope === "one" && !target) return [400, { success: false, error: "Informe o Instagram de destino" }] as const;
  const title = clean(body.title, 120);
  const text = clean(body.body, 2000);
  if (!title && !text) return [400, { success: false, error: "Escreva o aviso" }] as const;
  const buttons = (Array.isArray(body.buttons) ? body.buttons : []).slice(0, 3)
    .map((b) => { const i = (b ?? {}) as Row; return { label: clean(i.label, 60), url: clean(i.url, 400) }; })
    .filter((b) => b.label && /^https?:\/\//i.test(b.url));
  const image = clean(body.image_url, 500);
  const [row] = await adminQuery<Row>(
    `INSERT INTO public.ig_online_messages (target_instagram, target_scope, title, body, image_url, buttons, blocking, lock_seconds, repeat_daily, created_by)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,'admin') RETURNING id`,
    [target, scope, title, text, /^https?:\/\//i.test(image) ? image : null, JSON.stringify(buttons), Boolean(body.blocking),
      Math.max(0, Math.min(60, Number(body.lock_seconds ?? 0) || 0)), Boolean(body.repeat_daily)],
  );
  return [200, { success: true, id: row?.id }] as const;
}

async function adminMessages() {
  const msgs = await adminQuery<Row>("SELECT * FROM public.ig_online_messages ORDER BY created_at DESC LIMIT 100");
  const ids = msgs.map((m) => m.id);
  const events = ids.length
    ? await adminQuery<Row>("SELECT message_id, event, lower(instagram_username) AS ig FROM public.ig_online_message_events WHERE message_id = ANY($1::uuid[])", [ids])
    : [];
  return [200, {
    success: true,
    messages: msgs.map((m) => {
      const mine = events.filter((e) => e.message_id === m.id);
      const uniq = (ev: string) => new Set(mine.filter((e) => e.event === ev).map((e) => e.ig)).size;
      return { ...m, delivered: uniq("delivered"), shown: uniq("shown"), closed: uniq("closed"), clicked: uniq("clicked") };
    }),
  }] as const;
}

// ───────────────────────── roteamento ─────────────────────────

const EXTENSION_ACTIONS = new Set(["ping", "metrics", "check_access", "message_event"]);

export async function handleNativeIgOnline(req: Request, res: Response): Promise<boolean> {
  if (req.method !== "POST") return false;
  const requestId = req.header("cf-ray") ?? crypto.randomUUID();
  const body = parseBody(req.body);
  const action = String(body.action ?? "");
  const ip = req.header("cf-connecting-ip") || req.header("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || null;
  res.setHeader("X-MRO-Handler", "ig-online-native");
  res.setHeader("Cache-Control", "no-store");

  try {
    let result: readonly [number, unknown];
    if (EXTENSION_ACTIONS.has(action)) {
      const igKey = normalizeIG(body.instagram ?? body.instagram_username);
      if (rateLimited(`${ip}|${igKey}`)) {
        res.status(429).json({ success: false, error: "Muitas requisições. Aguarde um minuto." });
        return true;
      }
      const ua = req.header("user-agent") ?? "";
      const ver = req.header("x-extension-version") ?? "";
      result = action === "ping" ? await actionPing(body, ip, ua, ver)
        : action === "metrics" ? await actionMetrics(body)
        : action === "check_access" ? await actionCheckAccess(body)
        : await actionMessageEvent(body);
    } else {
      if (!hasValidAdminSession(req)) {
        res.status(401).json({ success: false, error: "Sessão admin inválida" });
        return true;
      }
      switch (action) {
        case "admin_list": result = await adminList(body); break;
        case "admin_metrics": result = await adminMetrics(body); break;
        case "admin_set_block": result = await adminSetBlock(body); break;
        case "admin_profile_detail": result = await adminProfileDetail(body); break;
        case "admin_history": {
          const ig = normalizeIG(body.instagram);
          const events = await adminQuery<Row>("SELECT * FROM public.ig_online_events WHERE lower(instagram_username)=$1 ORDER BY created_at DESC LIMIT 200", [ig]);
          result = [200, { success: true, events }];
          break;
        }
        case "admin_delete_session":
          await adminQuery("DELETE FROM public.ig_online_sessions WHERE id = $1::uuid", [clean(body.id, 60)]);
          result = [200, { success: true }];
          break;
        case "admin_send_message": result = await adminSendMessage(body); break;
        case "admin_messages": result = await adminMessages(); break;
        case "admin_toggle_message":
          await adminQuery("UPDATE public.ig_online_messages SET active = $2 WHERE id = $1::uuid", [clean(body.id, 60), Boolean(body.active)]);
          result = [200, { success: true }];
          break;
        case "admin_delete_message":
          await adminQuery("DELETE FROM public.ig_online_messages WHERE id = $1::uuid", [clean(body.id, 60)]);
          result = [200, { success: true }];
          break;
        default:
          result = [400, { success: false, error: "Ação desconhecida" }];
      }
    }
    res.status(result[0]).json(result[1]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    console.error(`[ig-online:${requestId}] action=${action} falhou: ${message}`);
    res.status(500).json({ success: false, error: "Erro interno", request_id: requestId });
  }
  return true;
}
