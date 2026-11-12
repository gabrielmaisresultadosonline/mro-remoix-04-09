/** Histórico de criativos da extensão, vinculado ao mesmo publication_id da galeria. */
import { adminQuery } from "../db.js";

type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

const clean = (value: unknown, max: number) => String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const normalizeIG = (value: unknown) => clean(value, 60).replace(/^@/, "").toLowerCase();

export const CREATIVE_STATUSES = ["created", "scheduled", "published", "cancelled", "failed"] as const;
export type CreativeStatus = typeof CREATIVE_STATUSES[number];

export function normalizeCreativeStatus(value: unknown): CreativeStatus | null {
  const status = clean(value, 30).toLowerCase();
  const aliases: Record<string, CreativeStatus> = {
    created: "created", criado: "created", criada: "created",
    scheduled: "scheduled", agendado: "scheduled", agendada: "scheduled",
    published: "published", publicado: "published", publicada: "published",
    cancelled: "cancelled", canceled: "cancelled", cancelado: "cancelled",
    failed: "failed", erro: "failed", falhou: "failed",
  };
  return aliases[status] ?? null;
}

export function optionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

/** Publicado é um estado final: eventos antigos fora de ordem não o regridem. */
export function nextCreativeStatus(current: string | null | undefined, incoming: CreativeStatus): CreativeStatus {
  return current === "published" && incoming !== "published" ? "published" : incoming;
}

export async function recordCreative(body: Body, forcedIg?: string) {
  const instagram = normalizeIG(forcedIg ?? body.instagram ?? body.instagram_username);
  const publicationId = clean(body.publication_id ?? body.post_id ?? body.carousel_id ?? body.publicacao_id, 120);
  const status = normalizeCreativeStatus(body.status ?? body.event ?? "created");
  if (!/^[a-z0-9._]{1,60}$/.test(instagram) || !publicationId || !status) {
    return [400, { success: false, error: "Informe instagram, publication_id e status válidos" }] as const;
  }
  const scheduledAt = optionalDate(body.scheduled_at ?? body.scheduled_for ?? body.agendado_para);
  const publishedAt = optionalDate(body.published_at ?? body.publicado_em);
  if (scheduledAt === undefined || publishedAt === undefined) {
    return [400, { success: false, error: "Data de agendamento ou publicação inválida" }] as const;
  }
  const caption = clean(body.caption ?? body.legenda, 2200) || null;
  const [existing] = await adminQuery<Row>(
    "SELECT status FROM public.ig_online_creatives WHERE lower(instagram_username)=$1 AND publication_id=$2",
    [instagram, publicationId],
  );
  const next = nextCreativeStatus(existing?.status as string | undefined, status);
  const [row] = await adminQuery<Row>(
    `INSERT INTO public.ig_online_creatives
      (instagram_username, publication_id, status, caption, scheduled_at, published_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (lower(instagram_username), publication_id) DO UPDATE SET
       status = EXCLUDED.status,
       caption = COALESCE(EXCLUDED.caption, public.ig_online_creatives.caption),
       scheduled_at = COALESCE(EXCLUDED.scheduled_at, public.ig_online_creatives.scheduled_at),
       published_at = COALESCE(public.ig_online_creatives.published_at, EXCLUDED.published_at),
       updated_at = now()
     RETURNING id, instagram_username, publication_id, status, caption, scheduled_at, published_at, created_at, updated_at`,
    [instagram, publicationId, next, caption, scheduledAt, next === "published" ? publishedAt ?? new Date().toISOString() : publishedAt],
  );
  return [200, { success: true, creative: row, duplicate: Boolean(existing) }] as const;
}

export async function creativesForAccounts(owned: string[], baseImages: Row[] = []) {
  if (!owned.length) return [] as Row[];
  const rows = await adminQuery<Row>(
    `SELECT id, instagram_username, publication_id, status, caption, scheduled_at, published_at, created_at, updated_at
       FROM public.ig_online_creatives
      WHERE lower(instagram_username) = ANY($1::text[])
      ORDER BY updated_at DESC LIMIT 2000`, [owned],
  );
  const allowed = new Set(owned);
  return rows.filter(row => allowed.has(String(row.instagram_username).toLowerCase())).map(row => ({
    ...row,
    images: baseImages.filter(image =>
      String(image.instagram_username).toLowerCase() === String(row.instagram_username).toLowerCase() &&
      image.publication_id === row.publication_id,
    ),
  }));
}
