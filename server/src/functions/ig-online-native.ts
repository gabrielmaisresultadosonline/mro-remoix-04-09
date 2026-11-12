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
import { loadBaselines, recordProfileReading, ownedInstagrams } from "./ig-profile-baseline.js";
import { authenticateMroMetrics } from "./mro-tool-login-native.js";
import { adminGallery, adminGalleryDelete, galleryUpload, handleGalleryGet, ownedGalleryImages } from "./ig-online-gallery.js";
import { creativesForAccounts, recordCreative } from "./ig-online-creatives.js";

const PUBLIC_BASE = (process.env.PUBLIC_API_URL || "https://api.maisresultadosonline.com.br").replace(/\/$/, "") + "/functions/v1/ig-online-api";

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

/** null = ausente; undefined = ilegível. */
export function parseFollowers(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 && raw <= 1e10 ? Math.round(raw) : undefined;
  let t = String(raw).trim().toLowerCase().replace(/seguidores|followers/g, "").replace(/\s+/g, " ").trim();
  let mult = 1;
  const m = t.match(/(k|mil|m|mi|milh(?:ão|ões|ao|oes)?|b)$/);
  if (m) {
    const u = m[1];
    mult = u === "k" || u === "mil" ? 1e3 : u === "b" ? 1e9 : 1e6;
    t = t.slice(0, -u.length).trim();
    t = t.replace(",", ".");
  } else {
    t = t.replace(/[.,\s]/g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined;
  const n = Math.round(Number(t) * mult);
  return n >= 0 && n <= 1e10 ? n : undefined;
}

const ACTIVITY_COUNTERS = [
  { key: "likes_sent", aliases: ["likes_sent", "likes", "curtidas"] },
  { key: "follows_sent", aliases: ["follows_sent", "followed", "followed_count", "seguidos", "seguiu"] },
  { key: "unfollows_sent", aliases: ["unfollows_sent", "unfollowed", "deixou_de_seguir"] },
  { key: "ai_replies_sent", aliases: ["ai_replies_sent", "ai_replies", "respostas_ia"] },
  { key: "ai_people_replied", aliases: ["ai_people_replied", "ai_people", "pessoas_respondidas_ia"] },
  { key: "mass_sent", aliases: ["mass_sent", "mass_messages", "mensagens_massa"] },
] as const;

export function readIncrements(body: Body) {
  const output: Record<string, number> = {};
  for (const counter of ACTIVITY_COUNTERS) {
    const alias = counter.aliases.find(key => body[key] !== undefined);
    const value = Number(alias ? body[alias] : 0);
    if (!Number.isInteger(value) || value < 0 || value > 100000) {
      return { error: `${counter.key} deve ser inteiro entre 0 e 100000` };
    }
    output[counter.key] = value;
  }
  return { counters: output };
}

async function actionMetrics(body: Body) {
  const ig = normalizeIG(body.instagram ?? body.instagram_username);
  if (!ig || !IG_RE.test(ig)) return [400, { success: false, error: "Instagram inválido" }] as const;
  const rawF = body.followers ?? body.followers_count ?? body.follower_count ?? body.seguidores;
  const parsedF = parseFollowers(rawF);
  const followers = parsedF ?? null;
  if (parsedF === undefined) {
    console.warn(`[ig-online] metrics @${ig}: valor de seguidores ilegível (${String(rawF).slice(0, 40)}) — ignorado`);
  }
  const following = parseFollowers(body.following ?? body.following_count ?? body.seguindo) ?? null;
  const posts = parseFollowers(body.posts ?? body.posts_count ?? body.media_count ?? body.publicacoes) ?? null;
  const gained = Number(body.followers_gained ?? body.new_followers ?? body.seguidores_ganhos ?? 0);
  if (!Number.isInteger(gained) || gained < 0 || gained > 100000)
    return [400, { success: false, error: "followers_gained deve ser inteiro entre 0 e 100000" }] as const;
  const welcome = Number(body.welcome_sent ?? 0);
  if (!Number.isInteger(welcome) || welcome < 0 || welcome > 10000)
    return [400, { success: false, error: "welcome_sent deve ser inteiro entre 0 e 10000" }] as const;
  const parsedCounters = readIncrements(body);
  if (parsedCounters.error) return [400, { success: false, error: parsedCounters.error }] as const;
  const a = parsedCounters.counters!;
  const fields = Object.keys(body).filter((k) => k !== "action").sort().join(",").slice(0, 300);
  console.info(`[ig-online] metrics @${ig}: campos=${fields} followers=${followers ?? "-"} gained=${gained} welcome=${welcome} likes=${a.likes_sent} follows=${a.follows_sent} unfollows=${a.unfollows_sent} ai=${a.ai_replies_sent}/${a.ai_people_replied} mass=${a.mass_sent}`);
  const sessionEvent = body.session === "start" || body.session === "end" ? body.session : null;
  const requestId = clean(body.request_id, 80) || null;
  const day = spDay(new Date());

  const duplicate = await tx(async (c) => {
    if (requestId) {
      const r = await c.query(
        "INSERT INTO public.ig_online_metric_requests (request_id, instagram_username) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [requestId, ig],
      );
      if (r.rowCount === 0) return true;
    }
    const s = await ensureSession(c, ig);
    await c.query(
      `UPDATE public.ig_online_sessions SET
         metrics_updated_at = now(), last_seen_at = now(), welcome_total = welcome_total + $2,
         followers_current = COALESCE($3, followers_current), followers_initial = COALESCE(followers_initial, $3),
         session_started_at = CASE WHEN $4 = 'start' THEN now() ELSE session_started_at END,
         session_ended_at = CASE WHEN $4 = 'start' THEN NULL WHEN $4 = 'end' THEN now() ELSE session_ended_at END,
         followers_gained_total = followers_gained_total + $5, last_metrics_fields = $6,
         likes_total = likes_total + $7, follows_total = follows_total + $8,
         unfollows_total = unfollows_total + $9, ai_replies_total = ai_replies_total + $10,
         ai_people_total = ai_people_total + $11, mass_sent_total = mass_sent_total + $12
       WHERE id = $1`,
      [s.id, welcome, followers, sessionEvent, gained, fields, a.likes_sent, a.follows_sent, a.unfollows_sent, a.ai_replies_sent, a.ai_people_replied, a.mass_sent],
    );
    const values = [ig, day, welcome, followers, gained, a.likes_sent, a.follows_sent, a.unfollows_sent, a.ai_replies_sent, a.ai_people_replied, a.mass_sent];
    const upd = await c.query(
      `UPDATE public.ig_online_metrics SET updated_at = now(), welcome_sent = welcome_sent + $3,
         followers_end = COALESCE($4, followers_end), followers_start = COALESCE(followers_start, $4),
         followers_gained = followers_gained + $5, likes_sent = likes_sent + $6,
         follows_sent = follows_sent + $7, unfollows_sent = unfollows_sent + $8,
         ai_replies_sent = ai_replies_sent + $9, ai_people_replied = ai_people_replied + $10,
         mass_sent = mass_sent + $11
       WHERE lower(instagram_username) = $1 AND day = $2`, values,
    );
    if (upd.rowCount === 0) {
      await c.query(
        `INSERT INTO public.ig_online_metrics
          (instagram_username, day, followers_start, followers_end, welcome_sent, followers_gained,
           likes_sent, follows_sent, unfollows_sent, ai_replies_sent, ai_people_replied, mass_sent)
         VALUES ($1,$2,$4,$4,$3,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (lower(instagram_username), day) DO UPDATE SET
           welcome_sent = public.ig_online_metrics.welcome_sent + EXCLUDED.welcome_sent,
           followers_gained = public.ig_online_metrics.followers_gained + EXCLUDED.followers_gained,
           followers_end = COALESCE(EXCLUDED.followers_end, public.ig_online_metrics.followers_end),
           likes_sent = public.ig_online_metrics.likes_sent + EXCLUDED.likes_sent,
           follows_sent = public.ig_online_metrics.follows_sent + EXCLUDED.follows_sent,
           unfollows_sent = public.ig_online_metrics.unfollows_sent + EXCLUDED.unfollows_sent,
           ai_replies_sent = public.ig_online_metrics.ai_replies_sent + EXCLUDED.ai_replies_sent,
           ai_people_replied = public.ig_online_metrics.ai_people_replied + EXCLUDED.ai_people_replied,
           mass_sent = public.ig_online_metrics.mass_sent + EXCLUDED.mass_sent,
           updated_at = now()`, values,
      );
    }
    return false;
  });
  if (!duplicate && followers !== null) {
    try { await recordProfileReading(ig, null, { followers, following, posts }, "extensao"); }
    catch (err) { console.warn(`[ig-online] baseline @${ig} não gravada`, (err as Error).message); }
  }
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

/** Boas-vindas e massa têm históricos separados; cada destinatário conta uma vez por tipo. */
async function actionOutreachEvent(body: Body) {
  const ig = normalizeIG(body.instagram ?? body.instagram_username);
  const rawKind = clean(body.kind ?? body.type ?? body.tipo, 30).toLowerCase();
  const kind = ["welcome", "boas_vindas", "boas-vindas"].includes(rawKind) ? "welcome"
    : ["mass", "massa", "bulk"].includes(rawKind) ? "mass" : null;
  const recipient = normalizeIG(body.recipient ?? body.recipient_username ?? body.destinatario);
  const eventId = clean(body.event_id ?? body.request_id, 100) || null;
  const campaignId = clean(body.campaign_id ?? body.campanha_id, 100) || null;
  if (!IG_RE.test(ig) || !kind || !/^[a-z0-9._-]{1,60}$/.test(recipient)) {
    return [400, { success: false, error: "Informe instagram, kind (welcome/mass) e recipient válidos" }] as const;
  }
  const sentAt = body.sent_at ? new Date(String(body.sent_at)) : new Date();
  if (!Number.isFinite(sentAt.getTime())) return [400, { success: false, error: "sent_at inválido" }] as const;
  const result = await tx(async (c) => {
    const inserted = await c.query(
      `INSERT INTO public.ig_online_outreach (event_id, instagram_username, kind, recipient, campaign_id, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
      [eventId, ig, kind, recipient, campaignId, sentAt.toISOString()],
    );
    if (!inserted.rowCount) return { duplicate: true, already_sent: true };
    const s = await ensureSession(c, ig);
    const totalColumn = kind === "welcome" ? "welcome_total" : "mass_sent_total";
    const dayColumn = kind === "welcome" ? "welcome_sent" : "mass_sent";
    await c.query(
      `UPDATE public.ig_online_sessions SET ${totalColumn} = ${totalColumn} + 1,
         metrics_updated_at = now(), last_seen_at = now() WHERE id = $1`, [s.id],
    );
    await c.query(
      `INSERT INTO public.ig_online_metrics (instagram_username, day, ${dayColumn})
       VALUES ($1, ($3::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date, 1)
       ON CONFLICT (lower(instagram_username), day) DO UPDATE SET
         ${dayColumn} = public.ig_online_metrics.${dayColumn} + 1, updated_at = now()`,
      [ig, kind, sentAt.toISOString()],
    );
    return { duplicate: false, already_sent: false, id: inserted.rows[0].id };
  });
  console.info(`[ig-online] outreach @${ig} kind=${kind} recipient=${recipient} duplicate=${result.duplicate}`);
  return [200, { success: true, kind, recipient, sent_at: sentAt.toISOString(), ...result }] as const;
}

/** A extensão consulta antes de enviar e traz o histórico local de volta após reinstalar. */
async function actionOutreachHistory(body: Body) {
  const ig = normalizeIG(body.instagram ?? body.instagram_username);
  if (!IG_RE.test(ig)) return [400, { success: false, error: "Instagram inválido" }] as const;
  const limit = Math.max(1, Math.min(5000, Math.trunc(Number(body.limit ?? 5000) || 5000)));
  const rows = await adminQuery<Row>(
    `SELECT kind, recipient, campaign_id, sent_at FROM public.ig_online_outreach
      WHERE lower(instagram_username)=$1 ORDER BY sent_at DESC LIMIT $2`, [ig, limit],
  );
  return [200, {
    success: true, instagram_username: ig, items: rows,
    recipients: {
      welcome: rows.filter(r => r.kind === "welcome").map(r => r.recipient),
      mass: rows.filter(r => r.kind === "mass").map(r => r.recipient),
    },
  }] as const;
}

// ───────────────────────── ações do painel ─────────────────────────

/** BIGINT chega como string no driver pg; o painel espera números. */
const withOnline = (s: Row): Row & { online: boolean } => ({
  ...s,
  total_pings: Number(s.total_pings ?? 0),
  welcome_total: Number(s.welcome_total ?? 0),
  likes_total: Number(s.likes_total ?? 0), follows_total: Number(s.follows_total ?? 0),
  unfollows_total: Number(s.unfollows_total ?? 0), ai_replies_total: Number(s.ai_replies_total ?? 0),
  ai_people_total: Number(s.ai_people_total ?? 0), mass_sent_total: Number(s.mass_sent_total ?? 0),
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
    `SELECT instagram_username, to_char(day,'YYYY-MM-DD') AS day, followers_start, followers_end,
       welcome_sent, followers_gained, likes_sent, follows_sent, unfollows_sent,
       ai_replies_sent, ai_people_replied, mass_sent
       FROM public.ig_online_metrics WHERE day >= $1 ORDER BY day ASC LIMIT 20000`, [sinceDay],
  );
  type Activity = { likes: number; follows: number; unfollows: number; aiReplies: number; aiPeople: number; mass: number };
  const zeroActivity = (): Activity => ({ likes: 0, follows: 0, unfollows: 0, aiReplies: 0, aiPeople: 0, mass: 0 });
  const addActivity = (target: Activity, row: Row) => {
    target.likes += Number(row.likes_sent ?? 0); target.follows += Number(row.follows_sent ?? 0);
    target.unfollows += Number(row.unfollows_sent ?? 0); target.aiReplies += Number(row.ai_replies_sent ?? 0);
    target.aiPeople += Number(row.ai_people_replied ?? 0); target.mass += Number(row.mass_sent ?? 0);
  };
  const byIg = new Map<string, { growth: number | null; welcome: number; days: number } & Activity>();
  const series = new Map<string, { growth: number; welcome: number } & Activity>();
  const lastF = new Map<string, number>();
  for (const m of metrics) {
    const key = String(m.instagram_username).toLowerCase();
    const day = String(m.day);
    const fs = numOrNull(m.followers_start), fe = numOrNull(m.followers_end);
    const gainedDay = Number(m.followers_gained ?? 0);
    const diff = fs !== null && fe !== null ? fe - fs : null;
    const g = diff !== null && diff !== 0 ? diff : gainedDay > 0 ? gainedDay : diff;
    const cur = byIg.get(key) ?? { growth: null, welcome: 0, days: 0, ...zeroActivity() };
    if (g !== null) cur.growth = (cur.growth ?? 0) + g;
    cur.welcome += Number(m.welcome_sent ?? 0); cur.days += 1; addActivity(cur, m); byIg.set(key, cur);
    const point = series.get(day) ?? { growth: 0, welcome: 0, ...zeroActivity() };
    point.welcome += Number(m.welcome_sent ?? 0); if (g !== null) point.growth += g;
    addActivity(point, m); series.set(day, point);
    if (fe !== null) lastF.set(`${day}|${key}`, fe);
  }
  const profiles = new Set(metrics.map((m) => String(m.instagram_username).toLowerCase()));
  const known = new Map<string, number>();
  const outSeries = [...series.keys()].sort().map((day) => {
    for (const profile of profiles) { const value = lastF.get(`${day}|${profile}`); if (value !== undefined) known.set(profile, value); }
    return { day, followers: known.size ? [...known.values()].reduce((a, b) => a + b, 0) : null, ...series.get(day)! };
  });
  const baselines = await loadBaselines(sessions.map((s) => String(s.instagram_username))).catch(() => new Map());
  const creativeCounts = await adminQuery<Row>(
    `SELECT lower(instagram_username) AS instagram_username, count(*)::int AS total,
       count(*) FILTER (WHERE status='scheduled')::int AS scheduled,
       count(*) FILTER (WHERE status='published')::int AS published
       FROM public.ig_online_creatives GROUP BY lower(instagram_username)`,
  ).catch(() => []);
  const rows = sessions.map((s) => {
    const key = String(s.instagram_username).toLowerCase();
    const agg = byIg.get(key);
    const b = baselines.get(key);
    const creative = creativeCounts.find(c => c.instagram_username === key);
    const fi = b?.initial_followers ?? numOrNull(s.followers_initial);
    const fc = numOrNull(s.followers_current) ?? b?.current_followers ?? null;
    return {
      id: s.id, instagram_username: s.instagram_username, status: s.status,
      followers_initial: fi, followers_current: fc,
      initial_source: b?.initial_source ?? (fi !== null ? "extensao" : null), initial_captured_at: b?.initial_captured_at ?? null,
      following_initial: b?.initial_following ?? null, following_current: b?.current_following ?? null,
      posts_initial: b?.initial_posts ?? null, posts_current: b?.current_posts ?? null,
      followers_gained_total: Number(s.followers_gained_total ?? 0), last_metrics_fields: s.last_metrics_fields ?? null,
      followers_diff: fi !== null && fc !== null && fc !== fi ? fc - fi : Number(s.followers_gained_total ?? 0) > 0 ? Number(s.followers_gained_total) : fi !== null && fc !== null ? 0 : null,
      period_growth: agg?.growth ?? null,
      daily_growth: agg && agg.growth !== null && agg.days ? Math.round((agg.growth / agg.days) * 10) / 10 : null,
      welcome_total: Number(s.welcome_total ?? 0), welcome_period: agg?.welcome ?? 0,
      likes_total: Number(s.likes_total ?? 0), likes_period: agg?.likes ?? 0,
      follows_total: Number(s.follows_total ?? 0), follows_period: agg?.follows ?? 0,
      unfollows_total: Number(s.unfollows_total ?? 0), unfollows_period: agg?.unfollows ?? 0,
      ai_replies_total: Number(s.ai_replies_total ?? 0), ai_replies_period: agg?.aiReplies ?? 0,
      ai_people_total: Number(s.ai_people_total ?? 0), ai_people_period: agg?.aiPeople ?? 0,
      mass_sent_total: Number(s.mass_sent_total ?? 0), mass_sent_period: agg?.mass ?? 0,
      creatives_total: Number(creative?.total ?? 0), creatives_scheduled: Number(creative?.scheduled ?? 0), creatives_published: Number(creative?.published ?? 0),
      last_seen_at: iso(s.last_seen_at), session_started_at: iso(s.session_started_at), session_ended_at: iso(s.session_ended_at), metrics_updated_at: iso(s.metrics_updated_at),
      blocked: Boolean(s.blocked), block_message: s.block_message ?? null, blocked_at: iso(s.blocked_at),
      online: Date.now() - new Date(s.last_seen_at as string).getTime() < ONLINE_WINDOW_MS,
    };
  });
  const withF = rows.filter((r) => r.followers_current !== null);
  const lastUpdate = rows.reduce<string | null>((a, r) => (r.metrics_updated_at && (!a || r.metrics_updated_at > a) ? r.metrics_updated_at : a), null);
  const sum = (key: keyof typeof rows[number]) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  return [200, {
    success: true, days, rows, series: outSeries,
    summary: {
      profiles: rows.length, followers_total: withF.length ? withF.reduce((a, r) => a + Number(r.followers_current), 0) : null,
      growth_period: rows.some((r) => r.period_growth !== null) ? rows.reduce((a, r) => a + Number(r.period_growth ?? 0), 0) : null,
      welcome_period: sum("welcome_period"), welcome_total: sum("welcome_total"),
      likes_period: sum("likes_period"), likes_total: sum("likes_total"),
      follows_period: sum("follows_period"), follows_total: sum("follows_total"),
      unfollows_period: sum("unfollows_period"), unfollows_total: sum("unfollows_total"),
      ai_replies_period: sum("ai_replies_period"), ai_replies_total: sum("ai_replies_total"),
      ai_people_period: sum("ai_people_period"), ai_people_total: sum("ai_people_total"),
      mass_sent_period: sum("mass_sent_period"), mass_sent_total: sum("mass_sent_total"),
      creatives_total: sum("creatives_total"), creatives_scheduled: sum("creatives_scheduled"), creatives_published: sum("creatives_published"),
      active_recent: rows.filter((r) => r.last_seen_at && Date.now() - new Date(r.last_seen_at).getTime() < 86_400_000).length,
      online: rows.filter((r) => r.online).length, last_update: lastUpdate,
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
  const [metrics, events, history, outreach, creatives] = await Promise.all([
    adminQuery<Row>(`SELECT to_char(day,'YYYY-MM-DD') AS day, followers_start, followers_end, welcome_sent,
      likes_sent, follows_sent, unfollows_sent, ai_replies_sent, ai_people_replied, mass_sent, updated_at
      FROM public.ig_online_metrics WHERE lower(instagram_username)=$1 ORDER BY day DESC LIMIT 365`, [ig]),
    adminQuery<Row>("SELECT created_at, browser, ip, url FROM public.ig_online_events WHERE lower(instagram_username)=$1 ORDER BY created_at DESC LIMIT 100", [ig]),
    adminQuery<Row>("SELECT action, block_message, admin_email, created_at FROM public.ig_online_block_history WHERE lower(instagram_username)=$1 ORDER BY created_at DESC LIMIT 100", [ig]).catch(() => []),
    adminQuery<Row>("SELECT kind, recipient, campaign_id, sent_at FROM public.ig_online_outreach WHERE lower(instagram_username)=$1 ORDER BY sent_at DESC LIMIT 500", [ig]),
    creativesForAccounts([ig], await ownedGalleryImages([ig], PUBLIC_BASE)),
  ]);
  return [200, {
    success: true, session: withOnline(session),
    metrics: metrics.map((m) => ({
      ...m, followers_start: numOrNull(m.followers_start), followers_end: numOrNull(m.followers_end),
      welcome_sent: Number(m.welcome_sent ?? 0), likes_sent: Number(m.likes_sent ?? 0), follows_sent: Number(m.follows_sent ?? 0),
      unfollows_sent: Number(m.unfollows_sent ?? 0), ai_replies_sent: Number(m.ai_replies_sent ?? 0),
      ai_people_replied: Number(m.ai_people_replied ?? 0), mass_sent: Number(m.mass_sent ?? 0),
    })),
    events, block_history: history, outreach, creatives, default_block_message: DEFAULT_BLOCK_MSG,
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

const EXTENSION_ACTIONS = new Set(["ping", "metrics", "check_access", "message_event", "gallery_upload", "outreach_event", "outreach_history", "creative_event"]);

async function userMetrics(body: Body) {
  const requested = Array.isArray(body.instagrams) ? body.instagrams : [];
  if (requested.length > 100 || requested.some((ig) => typeof ig !== 'string' || !IG_RE.test(normalizeIG(ig)))) {
    return [400, { success: false, error: 'Perfis inválidos' }] as const;
  }
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    return [401, { success: false, error: 'Acesso MRO necessário' }] as const;
  }
  const username = await authenticateMroMetrics(body.username, body.password);
  if (!username) return [401, { success: false, error: 'Sessão MRO inválida ou expirada' }] as const;
  const owned = await ownedInstagrams(username, requested.map(normalizeIG));
  const keys = [...owned];
  if (!keys.length) return [200, { success: true, profiles: [] }] as const;
  const [baselines, sessions, metrics, images] = await Promise.all([
    loadBaselines(keys),
    adminQuery<Row>(`SELECT instagram_username, followers_current, welcome_total, likes_total, follows_total,
      unfollows_total, ai_replies_total, ai_people_total, mass_sent_total, last_seen_at, metrics_updated_at
      FROM public.ig_online_sessions WHERE lower(instagram_username) = ANY($1::text[])`, [keys]),
    adminQuery<Row>(`SELECT instagram_username, to_char(day,'YYYY-MM-DD') AS day, followers_end, welcome_sent,
      likes_sent, follows_sent, unfollows_sent, ai_replies_sent, ai_people_replied, mass_sent
      FROM public.ig_online_metrics WHERE lower(instagram_username) = ANY($1::text[])
      AND day >= current_date - 365 ORDER BY day ASC`, [keys]),
    ownedGalleryImages(keys, PUBLIC_BASE),
  ]);
  const creatives = await creativesForAccounts(keys, images);
  return [200, { success: true, profiles: keys.map((ig) => {
    const baseline = baselines.get(ig);
    const s = sessions.find((row) => normalizeIG(row.instagram_username) === ig);
    return {
      instagram_username: ig,
      images: images.filter(image => normalizeIG(image.instagram_username) === ig),
      creatives: creatives.filter(creative => normalizeIG(creative.instagram_username) === ig),
      initial_followers: baseline?.initial_followers ?? null,
      initial_captured_at: baseline?.initial_captured_at ?? null,
      current_followers: baseline?.current_followers ?? numOrNull(s?.followers_current),
      welcome_total: Number(s?.welcome_total ?? 0), likes_total: Number(s?.likes_total ?? 0),
      follows_total: Number(s?.follows_total ?? 0), unfollows_total: Number(s?.unfollows_total ?? 0),
      ai_replies_total: Number(s?.ai_replies_total ?? 0), ai_people_total: Number(s?.ai_people_total ?? 0),
      mass_sent_total: Number(s?.mass_sent_total ?? 0),
      last_seen_at: iso(s?.last_seen_at), metrics_updated_at: baseline?.current_updated_at ?? iso(s?.metrics_updated_at),
      online: Boolean(s?.last_seen_at && Date.now() - new Date(String(s.last_seen_at)).getTime() < ONLINE_WINDOW_MS),
      metrics: metrics.filter((m) => normalizeIG(m.instagram_username) === ig).map((m) => ({
        day: m.day, followers_end: numOrNull(m.followers_end), welcome_sent: Number(m.welcome_sent ?? 0),
        likes_sent: Number(m.likes_sent ?? 0), follows_sent: Number(m.follows_sent ?? 0), unfollows_sent: Number(m.unfollows_sent ?? 0),
        ai_replies_sent: Number(m.ai_replies_sent ?? 0), ai_people_replied: Number(m.ai_people_replied ?? 0), mass_sent: Number(m.mass_sent ?? 0),
      })),
    };
  }) }] as const;
}

export async function handleNativeIgOnline(req: Request, res: Response): Promise<boolean> {
  if (req.method === "GET") {
    try { return await handleGalleryGet(req, res, PUBLIC_BASE); } catch (e) {
      console.error("[ig-gallery] GET falhou:", e instanceof Error ? e.message : e);
      res.status(500).json({ success: false, error: "Erro interno" }); return true;
    }
  }
  if (req.method !== "POST") return false;
  const requestId = req.header("cf-ray") ?? crypto.randomUUID();
  const body = parseBody(req.body);
  const action = String(body.action ?? "");
  const ip = req.header("cf-connecting-ip") || req.header("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || null;
  res.setHeader("X-MRO-Handler", "ig-online-native");
  res.setHeader("Cache-Control", "no-store");

  try {
    let result: readonly [number, unknown];
    if (action === 'user_metrics') {
      if (rateLimited(`${ip}|user-metrics`, 30)) {
        res.status(429).json({ success: false, error: 'Aguarde antes de atualizar.' });
        return true;
      }
      result = await userMetrics(body);
    } else if (EXTENSION_ACTIONS.has(action)) {
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
        : action === "outreach_event" ? await actionOutreachEvent(body)
        : action === "outreach_history" ? await actionOutreachHistory(body)
        : action === "creative_event" ? await recordCreative(body, igKey)
        : action === "gallery_upload" ? (IG_RE.test(igKey) ? await galleryUpload(igKey, body) : [400, { success: false, error: "Instagram inválido" }] as const)
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
        case "admin_gallery": result = await adminGallery(body, PUBLIC_BASE); break;
        case "admin_gallery_delete": result = await adminGalleryDelete(body); break;
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
