/**
 * Referência inicial única por perfil do Instagram.
 *
 * - /instagram/painel (user-cloud-storage) e /admin → IG Onlines → Métricas
 *   leem a MESMA linha de `ig_profile_baselines`.
 * - initial_* é gravado uma única vez, pela primeira leitura válida (extensão
 *   MRO ou print analisado) e nunca mais é sobrescrito — nem por prints novos.
 * - current_* guarda a última leitura recebida da extensão.
 * - O INSERT ... ON CONFLICT é atômico: leituras simultâneas não duplicam nem
 *   trocam a referência inicial.
 */
import { adminQuery } from "../db.js";

export interface ProfileReading {
  followers: number | null;
  following: number | null;
  posts: number | null;
  date?: string | null;
}

export interface BaselineRow {
  instagram_username: string;
  initial_followers: number | null;
  initial_following: number | null;
  initial_posts: number | null;
  initial_source: string | null;
  initial_captured_at: string | null;
  current_followers: number | null;
  current_following: number | null;
  current_posts: number | null;
  current_source: string | null;
  current_updated_at: string | null;
}

type Session = Record<string, unknown>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1e10 ? Math.round(n) : null;
};
const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export const normalizeIg = (v: unknown): string =>
  String(v ?? "").trim().toLowerCase().replace(/^@/, "").slice(0, 60);

function toBaselineRow(r: Record<string, unknown>): BaselineRow {
  return {
    instagram_username: String(r.instagram_username ?? ""),
    initial_followers: num(r.initial_followers),
    initial_following: num(r.initial_following),
    initial_posts: num(r.initial_posts),
    initial_source: (r.initial_source as string) ?? null,
    initial_captured_at: iso(r.initial_captured_at),
    current_followers: num(r.current_followers),
    current_following: num(r.current_following),
    current_posts: num(r.current_posts),
    current_source: (r.current_source as string) ?? null,
    current_updated_at: iso(r.current_updated_at),
  };
}

// ───────────────────────── regras puras (testáveis) ─────────────────────────

/** Snapshot com seguidores > 0 (placeholders de cadastro vêm com 0). */
function realSnapshot(v: unknown): ProfileReading | null {
  const s = obj(v);
  const followers = num(s.followers);
  if (followers === null || followers <= 0) return null;
  return { followers, following: num(s.following), posts: num(s.posts), date: iso(s.date) };
}

/**
 * Leitura inicial vinda do print já analisado no painel: o snapshot real mais
 * antigo do perfil. Sem print analisado → null (placeholder não vira referência).
 */
export function printBaselineCandidate(session: Session): ProfileReading | null {
  const profile = obj(session.profile);
  if (profile.dataSource !== "screenshot" || profile.needsScreenshotAnalysis === true) return null;
  const history = Array.isArray(session.growthHistory) ? session.growthHistory : [];
  const candidates = [realSnapshot(session.initialSnapshot), ...history.map(realSnapshot)]
    .filter((c): c is ProfileReading => c !== null);
  if (candidates.length) {
    return candidates.reduce((a, b) => ((b.date ?? "9") < (a.date ?? "9") ? b : a));
  }
  const followers = num(profile.followers);
  if (followers === null || followers <= 0) return null;
  return { followers, following: num(profile.following), posts: num(profile.posts), date: null };
}

function lastPrintAt(session: Session): string | null {
  const history = Array.isArray(session.screenshotHistory) ? session.screenshotHistory : [];
  return history.map((h) => iso(obj(h).uploadedAt)).filter(Boolean).sort().pop() ?? null;
}

/**
 * Aplica a referência central ao perfil salvo no painel.
 * - initialSnapshot passa a ser SEMPRE a referência inicial central.
 * - Com `withCurrent`, a última leitura da extensão preenche seguidores/seguindo/
 *   posts (quando é mais nova que o último print) e entra no histórico.
 */
export function applyBaselineToSession(session: Session, b: BaselineRow | undefined, withCurrent: boolean): Session {
  if (!b) return session;
  let out: Session = session;
  if (b.initial_followers !== null) {
    const prev = obj(session.initialSnapshot);
    out = {
      ...out,
      initialSnapshot: {
        avgLikes: num(prev.avgLikes) ?? 0,
        avgComments: num(prev.avgComments) ?? 0,
        engagement: typeof prev.engagement === "number" ? prev.engagement : 0,
        ...prev,
        date: b.initial_captured_at ?? iso(prev.date) ?? new Date().toISOString(),
        followers: b.initial_followers,
        following: b.initial_following ?? num(prev.following) ?? 0,
        posts: b.initial_posts ?? num(prev.posts) ?? 0,
      },
    };
  }
  if (!withCurrent || b.current_followers === null || !b.current_updated_at) return out;
  const printAt = lastPrintAt(session);
  if (printAt && printAt > b.current_updated_at) return out; // print mais novo vale como atual
  const profile = obj(out.profile);
  out = {
    ...out,
    profile: {
      ...profile,
      followers: b.current_followers,
      following: b.current_following ?? profile.following ?? 0,
      posts: b.current_posts ?? profile.posts ?? 0,
    },
  };
  const history = Array.isArray(out.growthHistory) ? [...out.growthHistory] : [];
  const last = obj(history[history.length - 1]);
  const lastDate = iso(last.date);
  if (num(last.followers) !== b.current_followers && (!lastDate || lastDate < b.current_updated_at)) {
    history.push({
      date: b.current_updated_at,
      followers: b.current_followers,
      following: b.current_following ?? num(last.following) ?? 0,
      posts: b.current_posts ?? num(last.posts) ?? 0,
      avgLikes: num(last.avgLikes) ?? 0,
      avgComments: num(last.avgComments) ?? 0,
      engagement: typeof last.engagement === "number" ? last.engagement : 0,
    });
    out = { ...out, growthHistory: history };
  }
  return out;
}

// ───────────────────────── banco ─────────────────────────

/**
 * Registra uma leitura. `initial` só é usado se o perfil ainda não tem
 * referência; `current` (se houver) vira a última leitura.
 */
export async function recordProfileReading(
  igRaw: string,
  initial: ProfileReading | null,
  current: ProfileReading | null,
  source: "extensao" | "print",
): Promise<void> {
  const ig = normalizeIg(igRaw);
  if (!ig) return;
  const init = initial ?? current;
  if (!init || init.followers === null) return;
  await adminQuery(
    `INSERT INTO public.ig_profile_baselines AS b
       (instagram_username, initial_followers, initial_following, initial_posts, initial_source, initial_captured_at,
        current_followers, current_following, current_posts, current_source, current_updated_at)
     VALUES ($1, $2::int, $3::int, $4::int, $5, COALESCE($6::timestamptz, now()),
             $7::int, $8::int, $9::int, CASE WHEN $7::int IS NULL THEN NULL ELSE $5 END,
             CASE WHEN $7::int IS NULL THEN NULL ELSE now() END)
     ON CONFLICT (lower(instagram_username)) DO UPDATE SET
       initial_followers   = CASE WHEN b.initial_followers IS NULL THEN EXCLUDED.initial_followers   ELSE b.initial_followers END,
       initial_following   = CASE WHEN b.initial_followers IS NULL THEN EXCLUDED.initial_following   ELSE b.initial_following END,
       initial_posts       = CASE WHEN b.initial_followers IS NULL THEN EXCLUDED.initial_posts       ELSE b.initial_posts END,
       initial_source      = CASE WHEN b.initial_followers IS NULL THEN EXCLUDED.initial_source      ELSE b.initial_source END,
       initial_captured_at = CASE WHEN b.initial_followers IS NULL THEN EXCLUDED.initial_captured_at ELSE b.initial_captured_at END,
       current_followers   = COALESCE(EXCLUDED.current_followers, b.current_followers),
       current_following   = CASE WHEN EXCLUDED.current_followers IS NULL THEN b.current_following ELSE COALESCE(EXCLUDED.current_following, b.current_following) END,
       current_posts       = CASE WHEN EXCLUDED.current_followers IS NULL THEN b.current_posts ELSE COALESCE(EXCLUDED.current_posts, b.current_posts) END,
       current_source      = COALESCE(EXCLUDED.current_source, b.current_source),
       current_updated_at  = COALESCE(EXCLUDED.current_updated_at, b.current_updated_at),
       updated_at = now()`,
    [
      ig, init.followers, init.following, init.posts, source, init.date ?? null,
      current?.followers ?? null, current?.following ?? null, current?.posts ?? null,
    ],
  );
}

export async function loadBaselines(igs: string[]): Promise<Map<string, BaselineRow>> {
  const keys = [...new Set(igs.map(normalizeIg).filter(Boolean))];
  if (!keys.length) return new Map();
  const rows = await adminQuery<Record<string, unknown>>(
    "SELECT * FROM public.ig_profile_baselines WHERE lower(instagram_username) = ANY($1::text[])",
    [keys],
  );
  return new Map(rows.map((r) => [normalizeIg(r.instagram_username), toBaselineRow(r)]));
}

/** Perfis que pertencem ao usuário (cadastro na ferramenta ou no painel). */
export async function ownedInstagrams(username: string, igs: string[]): Promise<Set<string>> {
  const keys = [...new Set(igs.map(normalizeIg).filter(Boolean))];
  const owned = new Set<string>();
  if (!keys.length) return owned;
  const queries: Array<[string, string]> = [
    ["mro_tool_accounts",
      `SELECT lower(regexp_replace(btrim(a.instagram_username), '^@', '')) AS ig
         FROM public.mro_tool_accounts a JOIN public.mro_tool_users u ON u.id = a.user_id
        WHERE lower(btrim(u.username)) = $1
          AND lower(regexp_replace(btrim(a.instagram_username), '^@', '')) = ANY($2::text[])`],
    ["squarecloud_user_profiles",
      `SELECT lower(regexp_replace(btrim(instagram_username), '^@', '')) AS ig
         FROM public.squarecloud_user_profiles
        WHERE lower(squarecloud_username) = $1
          AND lower(regexp_replace(btrim(instagram_username), '^@', '')) = ANY($2::text[])`],
  ];
  for (const [name, sql] of queries) {
    try {
      (await adminQuery<{ ig: string }>(sql, [username.toLowerCase(), keys])).forEach((r) => owned.add(r.ig));
    } catch (err) {
      console.warn(`[ig-baseline] vínculo via ${name} indisponível`, (err as Error).message);
    }
  }
  return owned;
}
