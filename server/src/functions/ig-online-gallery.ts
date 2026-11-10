/**
 * IG ONLINE — galeria de imagens aprovadas pelos clientes.
 *
 * A extensão envia cada imagem aprovada (base64 em JSON) com a legenda da
 * publicação. O arquivo fica no disco da VPS (STORAGE_ROOT/ig-gallery) e a
 * linha no PostgreSQL; permanecem até exclusão manual pelo administrador.
 * A galeria pública mostra apenas imagem + legenda, nunca o perfil.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { adminQuery } from "../db.js";
import { env } from "../env.js";

type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

export const GALLERY_RETENTION_DAYS = null;
export const GALLERY_MAX_BYTES = 8 * 1024 * 1024;
const ROOT = path.join(env.storage.root, "ig-gallery");
const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID_RE = /^[0-9a-f-]{36}$/i;

const clean = (v: unknown, max: number): string => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);

/** Detecta o tipo real pelos bytes iniciais (não confia no que foi declarado). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Aceita "data:image/png;base64,...." ou base64 puro. */
export function decodeImage(raw: unknown): Buffer | null {
  const s = String(raw ?? "");
  const b64 = s.includes(",") && s.startsWith("data:") ? s.slice(s.indexOf(",") + 1) : s;
  if (!b64 || b64.length > Math.ceil(GALLERY_MAX_BYTES * 1.4)) return null;
  const buf = Buffer.from(b64, "base64");
  return buf.length ? buf : null;
}

export async function cleanupExpired(_force = false): Promise<number> {
  // Compatibility for older callers: automatic deletion is permanently disabled.
  return 0;
}

const firstDefined = (body: Body, keys: string[]): unknown => {
  for (const k of keys) if (body[k] !== undefined && body[k] !== null && body[k] !== "") return body[k];
  return undefined;
};
const toIndex = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(50, Math.trunc(n))) : fallback;
};

type SaveResult = { status: number; body: Record<string, unknown> };

async function saveOne(ig: string, raw: unknown, publicationId: string | null, imageIndex: number, caption: string | null): Promise<SaveResult> {
  const buf = decodeImage(raw);
  if (!buf) return { status: 400, body: { success: false, error: "Envie image_base64 (JPG, PNG ou WEBP)", image_index: imageIndex } };
  if (buf.length > GALLERY_MAX_BYTES) return { status: 413, body: { success: false, error: "Imagem acima de 8 MB", image_index: imageIndex } };
  const mime = sniffMime(buf);
  if (!mime) return { status: 415, body: { success: false, error: "Formato não suportado (use JPG, PNG ou WEBP)", image_index: imageIndex } };

  if (publicationId) {
    const [dup] = await adminQuery<Row>(
      "SELECT id FROM public.ig_online_gallery WHERE lower(instagram_username)=$1 AND publication_id=$2 AND image_index=$3",
      [ig, publicationId, imageIndex],
    );
    if (dup) {
      console.info(`[ig-gallery] @${ig} pub=${publicationId} slide=${imageIndex} já existia (duplicate)`);
      return { status: 200, body: { success: true, id: dup.id, image_index: imageIndex, duplicate: true } };
    }
  }

  const day = new Date().toISOString().slice(0, 10);
  const rel = `${day}/${crypto.randomUUID()}.${MIME_EXT[mime]}`;
  await fs.mkdir(path.join(ROOT, day), { recursive: true });
  await fs.writeFile(path.join(ROOT, rel), buf);
  const [row] = await adminQuery<Row>(
    `INSERT INTO public.ig_online_gallery (instagram_username, publication_id, image_index, caption, file_path, mime, size_bytes, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, 'infinity'::timestamptz) RETURNING id`,
    [ig, publicationId, imageIndex, caption, rel, mime, buf.length],
  );
  console.info(`[ig-gallery] @${ig} pub=${publicationId ?? "-"} slide=${imageIndex} salvo ${row?.id} (${Math.round(buf.length / 1024)} KB)`);
  return { status: 200, body: { success: true, id: row?.id, image_index: imageIndex, expires_at: null, duplicate: false } };
}

/**
 * Aceita dois formatos:
 *  A) uma imagem por requisição: image_base64 + publication_id + image_index (0,1,2...)
 *  B) carrossel inteiro numa requisição: images: ["data:...", ...] ou [{ image_base64, image_index }]
 * No formato B, sem publication_id o servidor cria um para agrupar os slides.
 */
export async function galleryUpload(ig: string, body: Body) {
  const caption = clean(firstDefined(body, ["caption", "legenda"]), 2200) || null;
  let publicationId = clean(firstDefined(body, ["publication_id", "post_id", "carousel_id", "publicacao_id"]), 120) || null;
  const list = firstDefined(body, ["images", "slides", "carousel", "imagens"]);

  if (Array.isArray(list) && list.length) {
    if (list.length > 20) return [400, { success: false, error: "Carrossel com mais de 20 imagens" }] as const;
    if (!publicationId) publicationId = `srv_${crypto.randomUUID()}`;
    console.info(`[ig-gallery] @${ig} carrossel recebido: ${list.length} imagem(ns) pub=${publicationId}`);
    const results: Record<string, unknown>[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const isObj = item && typeof item === "object";
      const raw = isObj ? firstDefined(item as Body, ["image_base64", "image", "base64", "data"]) : item;
      const idx = isObj ? toIndex(firstDefined(item as Body, ["image_index", "index", "slide_index", "position"]), i) : i;
      results.push((await saveOne(ig, raw, publicationId, idx, caption)).body);
    }
    const saved = results.filter((r) => r.success).length;
    return [saved ? 200 : 400, {
      success: saved > 0, publication_id: publicationId, total: list.length, saved, results,
    }] as const;
  }

  const imageIndex = toIndex(firstDefined(body, ["image_index", "index", "slide_index", "position"]), 0);
  if (!publicationId) console.warn(`[ig-gallery] @${ig} enviou imagem sem publication_id — não será agrupada em carrossel`);
  const r = await saveOne(ig, body.image_base64 ?? body.image, publicationId, imageIndex, caption);
  return [r.status, { ...r.body, publication_id: publicationId }] as const;
}

const fileUrl = (base: string, id: unknown) => `${base}?file=${id}`;

/** Only accepts server-validated owned usernames; never expose account names in public_gallery. */
export async function ownedGalleryImages(owned: string[], base: string) {
  if (!owned.length) return [];
  const rows = await adminQuery<Row>(
    `SELECT id, instagram_username, publication_id, image_index, caption, created_at
       FROM public.ig_online_gallery WHERE lower(instagram_username) = ANY($1::text[])
       ORDER BY created_at DESC, image_index ASC`, [owned],
  );
  const allowed = new Set(owned);
  return rows.filter(r => allowed.has(String(r.instagram_username).toLowerCase())).map(r => ({ ...r, url: fileUrl(base, r.id) }));
}

export async function adminGallery(body: Body, base: string) {
  const ig = clean(body.instagram, 60).replace(/^@/, "").toLowerCase();
  const rows = await adminQuery<Row>(
    `SELECT id, instagram_username, publication_id, image_index, caption, size_bytes, created_at, expires_at
       FROM public.ig_online_gallery ${ig ? "WHERE lower(instagram_username)=$1" : ""}
      ORDER BY created_at DESC LIMIT 2000`,
    ig ? [ig] : [],
  );
  const byClient = new Map<string, number>();
  for (const r of rows) byClient.set(String(r.instagram_username), (byClient.get(String(r.instagram_username)) ?? 0) + 1);
  return [200, {
    success: true,
    images: rows.map((r) => ({ ...r, expires_at: null, size_bytes: Number(r.size_bytes), url: fileUrl(base, r.id) })),
    clients: [...byClient.entries()].map(([instagram, total]) => ({ instagram, total })).sort((a, b) => b.total - a.total),
    retention_days: GALLERY_RETENTION_DAYS,
  }] as const;
}

export async function adminGalleryDelete(body: Body) {
  const id = clean(body.id, 60);
  if (!UUID_RE.test(id)) return [400, { success: false, error: "id inválido" }] as const;
  const [row] = await adminQuery<Row>("DELETE FROM public.ig_online_gallery WHERE id=$1::uuid RETURNING file_path", [id]);
  if (row) await fs.rm(path.join(ROOT, String(row.file_path)), { force: true }).catch(() => undefined);
  return [200, { success: true }] as const;
}

/** GET público: ?file=<id> devolve a imagem; ?public_gallery=1 lista só imagem + legenda. */
export async function handleGalleryGet(req: Request, res: Response, base: string): Promise<boolean> {
  const fileId = String(req.query.file ?? "");
  if (fileId) {
    if (!UUID_RE.test(fileId)) { res.status(400).end(); return true; }
    const [row] = await adminQuery<Row>(
      "SELECT file_path, mime FROM public.ig_online_gallery WHERE id=$1::uuid", [fileId],
    );
    if (!row) { res.status(404).end(); return true; }
    const full = path.join(ROOT, String(row.file_path));
    if (!full.startsWith(ROOT)) { res.status(400).end(); return true; }
    try { await fs.access(full); } catch { res.status(404).end(); return true; }
    res.setHeader("Content-Type", String(row.mime));
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    createReadStream(full).pipe(res);
    return true;
  }
  if (req.query.public_gallery) {
    const before = String(req.query.before ?? "");
    const limit = Math.max(1, Math.min(120, Number(req.query.limit ?? 60) || 60));
    const rows = await adminQuery<Row>(
      `SELECT id, caption, created_at, publication_id, image_index FROM public.ig_online_gallery
        ${before ? "WHERE created_at < $2::timestamptz" : ""}
        ORDER BY created_at DESC LIMIT $1`,
      before ? [limit, before] : [limit],
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({
      success: true,
      images: rows.map((r) => ({
        id: r.id,
        url: fileUrl(base, r.id),
        caption: r.caption ?? null,
        created_at: r.created_at,
        publication_id: r.publication_id ?? null,
        image_index: r.image_index ?? null,
      })),
      next_before: rows.length === limit ? rows[rows.length - 1].created_at : null,
    });
    return true;
  }
  return false;
}
