/**
 * IG ONLINE — galeria de imagens aprovadas pelos clientes.
 *
 * A extensão envia cada imagem aprovada (base64 em JSON) com a legenda da
 * publicação. O arquivo fica no disco da VPS (STORAGE_ROOT/ig-gallery) e a
 * linha no PostgreSQL; ambos expiram em 30 dias e são removidos sozinhos.
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

export const GALLERY_RETENTION_DAYS = 30;
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

let lastCleanup = 0;
export async function cleanupExpired(force = false): Promise<number> {
  if (!force && Date.now() - lastCleanup < 60 * 60 * 1000) return 0;
  lastCleanup = Date.now();
  const rows = await adminQuery<Row>(
    "DELETE FROM public.ig_online_gallery WHERE expires_at < now() RETURNING file_path",
  ).catch(() => [] as Row[]);
  for (const r of rows) await fs.rm(path.join(ROOT, String(r.file_path)), { force: true }).catch(() => undefined);
  if (rows.length) console.info(`[ig-gallery] ${rows.length} imagem(ns) expirada(s) removida(s)`);
  return rows.length;
}

export async function galleryUpload(ig: string, body: Body) {
  const buf = decodeImage(body.image_base64 ?? body.image);
  if (!buf) return [400, { success: false, error: "Envie image_base64 (JPG, PNG ou WEBP)" }] as const;
  if (buf.length > GALLERY_MAX_BYTES) return [413, { success: false, error: "Imagem acima de 8 MB" }] as const;
  const mime = sniffMime(buf);
  if (!mime) return [415, { success: false, error: "Formato não suportado (use JPG, PNG ou WEBP)" }] as const;
  const publicationId = clean(body.publication_id, 120) || null;
  const imageIndex = Math.max(0, Math.min(50, Number(body.image_index ?? 0) || 0));
  const caption = clean(body.caption, 2200) || null;

  if (publicationId) {
    const [dup] = await adminQuery<Row>(
      "SELECT id FROM public.ig_online_gallery WHERE lower(instagram_username)=$1 AND publication_id=$2 AND image_index=$3",
      [ig, publicationId, imageIndex],
    );
    if (dup) return [200, { success: true, id: dup.id, duplicate: true }] as const;
  }

  const day = new Date().toISOString().slice(0, 10);
  const rel = `${day}/${crypto.randomUUID()}.${MIME_EXT[mime]}`;
  await fs.mkdir(path.join(ROOT, day), { recursive: true });
  await fs.writeFile(path.join(ROOT, rel), buf);
  const [row] = await adminQuery<Row>(
    `INSERT INTO public.ig_online_gallery (instagram_username, publication_id, image_index, caption, file_path, mime, size_bytes, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now() + make_interval(days => $8)) RETURNING id, expires_at`,
    [ig, publicationId, imageIndex, caption, rel, mime, buf.length, GALLERY_RETENTION_DAYS],
  );
  void cleanupExpired();
  console.info(`[ig-gallery] @${ig} enviou imagem ${row?.id} (${Math.round(buf.length / 1024)} KB)`);
  return [200, { success: true, id: row?.id, expires_at: row?.expires_at, duplicate: false }] as const;
}

const fileUrl = (base: string, id: unknown) => `${base}?file=${id}`;

export async function adminGallery(body: Body, base: string) {
  const ig = clean(body.instagram, 60).replace(/^@/, "").toLowerCase();
  const rows = await adminQuery<Row>(
    `SELECT id, instagram_username, publication_id, image_index, caption, size_bytes, created_at, expires_at
       FROM public.ig_online_gallery WHERE expires_at > now() ${ig ? "AND lower(instagram_username)=$1" : ""}
      ORDER BY created_at DESC LIMIT 2000`,
    ig ? [ig] : [],
  );
  const byClient = new Map<string, number>();
  for (const r of rows) byClient.set(String(r.instagram_username), (byClient.get(String(r.instagram_username)) ?? 0) + 1);
  return [200, {
    success: true,
    images: rows.map((r) => ({ ...r, size_bytes: Number(r.size_bytes), url: fileUrl(base, r.id) })),
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
      "SELECT file_path, mime FROM public.ig_online_gallery WHERE id=$1::uuid AND expires_at > now()", [fileId],
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
    void cleanupExpired();
    const before = String(req.query.before ?? "");
    const limit = Math.max(1, Math.min(120, Number(req.query.limit ?? 60) || 60));
    const rows = await adminQuery<Row>(
      `SELECT id, caption, created_at FROM public.ig_online_gallery
        WHERE expires_at > now() ${before ? "AND created_at < $2::timestamptz" : ""}
        ORDER BY created_at DESC LIMIT $1`,
      before ? [limit, before] : [limit],
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({
      success: true,
      images: rows.map((r) => ({ id: r.id, url: fileUrl(base, r.id), caption: r.caption ?? null, created_at: r.created_at })),
      next_before: rows.length === limit ? rows[rows.length - 1].created_at : null,
    });
    return true;
  }
  return false;
}
