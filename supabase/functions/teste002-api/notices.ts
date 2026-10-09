// Avisos diários agendados para usuários do teste grátis (exibidos pela extensão em tela cheia).
import { teste002Info, type Teste002Row } from "../_shared/teste002.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export interface NoticeRow {
  id: string; title: string; message: string; image_url: string; youtube_url: string;
  buttons: { label: string; url: string }[]; lock_seconds: number; schedule_times: string[];
  repeat_daily: boolean; target: string; start_date: string | null; end_date: string | null; is_active: boolean; created_at: string;
}

const TARGETS = ["all", "active", "expired", "not_started"];

/** Data (AAAA-MM-DD) e hora (HH:MM) atuais em São Paulo. */
function spNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}` };
}

const youtubeEmbed = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : "";
};

export function sanitizeNotice(raw: unknown): { value: Record<string, unknown> } | { error: string } {
  const n = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const title = str(n.title, 160);
  if (!title) return { error: "Informe o título do aviso." };
  const https = (v: string) => !v || /^https:\/\//i.test(v);
  const image_url = str(n.image_url, 800), youtube_url = str(n.youtube_url, 400);
  if (!https(image_url) || !https(youtube_url)) return { error: "Imagem e vídeo precisam de links https://" };
  const buttons = (Array.isArray(n.buttons) ? n.buttons : []).slice(0, 3)
    .map((b) => ({ label: str((b as Record<string, unknown>)?.label, 60), url: str((b as Record<string, unknown>)?.url, 800) }))
    .filter((b) => b.label && b.url);
  if (buttons.some((b) => !https(b.url))) return { error: "Os links dos botões precisam começar com https://" };
  const times = (Array.isArray(n.schedule_times) ? n.schedule_times : String(n.schedule_times ?? "").split(","))
    .map((t) => String(t).trim()).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t));
  const target = TARGETS.includes(String(n.target)) ? String(n.target) : "all";
  const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);
  return {
    value: {
      title, message: str(n.message, 4000), image_url, youtube_url, buttons,
      lock_seconds: Math.min(120, Math.max(0, Math.floor(Number(n.lock_seconds) || 0))),
      schedule_times: times.length ? [...new Set(times)].sort() : ["09:00"],
      repeat_daily: n.repeat_daily !== false, target, start_date: date(n.start_date), end_date: date(n.end_date),
      is_active: n.is_active !== false,
    },
  };
}

function matchesTarget(target: string, row: Teste002Row) {
  const t = teste002Info(row);
  if (target === "active") return t.started && !t.expired;
  if (target === "expired") return t.expired;
  if (target === "not_started") return !t.started;
  return true;
}

/** Avisos que devem aparecer agora: o último horário do dia já passou e o usuário ainda não fechou nesse horário. */
export async function dueNotices(db: Db, row: Teste002Row) {
  const { date, time } = spNow();
  const { data: notices } = await db.from("teste002_notices").select("*").eq("is_active", true);
  const list = ((notices ?? []) as NoticeRow[]).filter((n) =>
    matchesTarget(n.target, row) && (!n.start_date || n.start_date <= date) && (!n.end_date || n.end_date >= date));
  if (!list.length) return [];
  const { data: closed } = await db.from("teste002_notice_events").select("notice_id, slot_key")
    .eq("user_id", row.id).eq("event", "closed").in("notice_id", list.map((n) => n.id));
  const closedSet = new Set(((closed ?? []) as { notice_id: string; slot_key: string }[]).map((c) => `${c.notice_id}|${c.slot_key}`));
  const closedAny = new Set(((closed ?? []) as { notice_id: string }[]).map((c) => c.notice_id));
  const out = [];
  for (const n of list) {
    const passed = (n.schedule_times ?? []).filter((t) => t <= time).sort();
    if (!passed.length) continue;
    const slot_key = `${date}T${passed[passed.length - 1]}`;
    if (n.repeat_daily ? closedSet.has(`${n.id}|${slot_key}`) : closedAny.has(n.id)) continue;
    out.push({
      id: n.id, slot_key, title: n.title, message: n.message, image_url: n.image_url || null,
      youtube_url: n.youtube_url || null, youtube_embed_url: n.youtube_url ? youtubeEmbed(n.youtube_url) || null : null,
      buttons: n.buttons ?? [], lock_seconds: n.lock_seconds ?? 0,
      display: { position: "center", overlay: true, size: "large", block_close_seconds: n.lock_seconds ?? 0 },
    });
  }
  return out;
}

interface EventRow { notice_id: string; user_id: string; event: string; slot_key: string; created_at: string }
interface UserLite { id: string; last_extension_access: string | null; last_browser_access: string | null }

/** Relatório: por aviso (quem viu / não viu / cliques) e por usuário (lidos, último fechamento). */
export function buildReport(users: UserLite[], notices: NoticeRow[], events: EventRow[]) {
  const byNotice: Record<string, { seen_users: string[]; shown: number; closed: number; clicks: number }> = {};
  const byUser: Record<string, { read_notices: number; closed_total: number; clicks: number; last_closed_at: string | null }> = {};
  for (const n of notices) byNotice[n.id] = { seen_users: [], shown: 0, closed: 0, clicks: 0 };
  const seen = new Set<string>();
  for (const e of events) {
    const bn = byNotice[e.notice_id];
    const bu = (byUser[e.user_id] ??= { read_notices: 0, closed_total: 0, clicks: 0, last_closed_at: null });
    if (e.event === "shown" && bn) bn.shown++;
    if (e.event === "click") { if (bn) bn.clicks++; bu.clicks++; }
    if (e.event === "closed") {
      if (bn) bn.closed++;
      bu.closed_total++;
      if (!bu.last_closed_at || e.created_at > bu.last_closed_at) bu.last_closed_at = e.created_at;
      const k = `${e.notice_id}|${e.user_id}`;
      if (!seen.has(k)) { seen.add(k); bu.read_notices++; if (bn) bn.seen_users.push(e.user_id); }
    }
  }
  const activeLimit = Date.now() - 48 * 36e5;
  const active = users.filter((u) => [u.last_extension_access, u.last_browser_access].some((d) => d && Date.parse(d) > activeLimit)).length;
  return {
    by_notice: Object.fromEntries(Object.entries(byNotice).map(([id, v]) => [id, { ...v, seen: v.seen_users.length, not_seen: users.length - v.seen_users.length }])),
    by_user: byUser,
    extension_active: active,
    extension_inactive: users.length - active,
    active_window_hours: 48,
  };
}
