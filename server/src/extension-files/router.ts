/**
 * Arquivo ZIP da extensão MRO Ferramenta.
 *
 * Montado em /functions/v1/mro-extension-file (antes do parser bruto global):
 *   GET    /latest    público → dados do arquivo atual (nome, tamanho, sha256, data, link)
 *   GET    /download  público → baixa o ZIP atual (Content-Disposition: attachment)
 *   POST   /upload    admin   → multipart "file" (.zip) + campos opcionais version/notes
 *   GET    /history   admin   → últimos envios
 *   DELETE /current   admin   → deixa de oferecer o arquivo atual
 *
 * O arquivo fica no disco da VPS (storage.root/mro-extension) e o registro no PostgreSQL.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { adminQuery } from "../db.js";
import { env } from "../env.js";
import { hasValidAdminSession } from "../admin-session.js";
import { cleanVersion, isZipBuffer, KEEP_PREVIOUS, MAX_ZIP_BYTES, safeZipName } from "./zip.js";

const ROOT = path.join(env.storage.root, "mro-extension");
const TOOL = "mro";
const BASE_PATH = "/functions/v1/mro-extension-file";

interface FileRow {
  id: string; file_name: string; file_path: string; size_bytes: string; sha256: string;
  version: string | null; notes: string | null; is_current: boolean; created_at: string;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ZIP_BYTES, files: 1 },
});

function publicInfo(row: FileRow | undefined) {
  if (!row) return { available: false };
  return {
    available: true,
    id: row.id,
    file_name: row.file_name,
    size_bytes: Number(row.size_bytes),
    sha256: row.sha256,
    version: row.version,
    notes: row.notes,
    updated_at: new Date(row.created_at).toISOString(),
    download_url: `${env.publicUrl}${BASE_PATH}/download`,
    latest_url: `${env.publicUrl}${BASE_PATH}/latest`,
  };
}

async function current(): Promise<FileRow | undefined> {
  const [row] = await adminQuery<FileRow>(
    "SELECT * FROM public.mro_extension_files WHERE tool = $1 AND is_current LIMIT 1", [TOOL]);
  return row;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!hasValidAdminSession(req)) {
    res.status(401).json({ error: "Sessão admin inválida. Entre novamente no /admin." });
    return;
  }
  next();
}

function absolute(rel: string): string | null {
  const abs = path.resolve(ROOT, rel);
  return abs.startsWith(path.resolve(ROOT) + path.sep) ? abs : null;
}

async function pruneOld(): Promise<void> {
  const old = await adminQuery<FileRow>(
    `SELECT * FROM public.mro_extension_files WHERE tool = $1 AND NOT is_current
     ORDER BY created_at DESC OFFSET $2`, [TOOL, KEEP_PREVIOUS]);
  for (const row of old) {
    const abs = absolute(row.file_path);
    if (abs) await fs.promises.rm(abs, { force: true }).catch(() => undefined);
    await adminQuery("DELETE FROM public.mro_extension_files WHERE id = $1", [row.id]);
  }
}

export const extensionFilesRouter = express.Router();

extensionFilesRouter.get("/latest", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(publicInfo(await current()));
});

extensionFilesRouter.head("/download", async (_req, res) => {
  const row = await current();
  if (!row) { res.status(404).end(); return; }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Length", String(row.size_bytes));
  res.setHeader("ETag", `"${row.sha256}"`);
  res.setHeader("Last-Modified", new Date(row.created_at).toUTCString());
  res.status(200).end();
});

extensionFilesRouter.get("/download", async (req, res) => {
  const row = await current();
  const abs = row ? absolute(row.file_path) : null;
  if (!row || !abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: "Nenhum arquivo ZIP disponível no momento." });
    return;
  }
  const etag = `"${row.sha256}"`;
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", new Date(row.created_at).toUTCString());
  res.setHeader("Cache-Control", "no-cache");
  if (req.header("if-none-match") === etag) { res.status(304).end(); return; }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Length", String(row.size_bytes));
  res.setHeader("Content-Disposition", `attachment; filename="${row.file_name}"`);
  console.info(`[mro-extension-file] download ${row.file_name} ip=${req.ip}`);
  fs.createReadStream(abs).pipe(res);
});

extensionFilesRouter.post("/upload", requireAdmin, (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Arquivo maior que 95 MB." });
      return;
    }
    if (err) { next(err); return; }
    next();
  });
}, async (req, res) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file?.buffer?.length) { res.status(400).json({ error: "Envie um arquivo .zip." }); return; }
  if (!isZipBuffer(file.buffer)) { res.status(400).json({ error: "O arquivo enviado não é um ZIP válido." }); return; }

  const fileName = safeZipName(file.originalname);
  const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const day = new Date().toISOString().slice(0, 10);
  const rel = path.join(day, `${crypto.randomUUID()}.zip`);
  const abs = path.join(ROOT, rel);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, file.buffer);

  const body = req.body as Record<string, unknown>;
  try {
    await adminQuery("UPDATE public.mro_extension_files SET is_current = false WHERE tool = $1 AND is_current", [TOOL]);
    await adminQuery(
      `INSERT INTO public.mro_extension_files (tool, file_name, file_path, size_bytes, sha256, version, notes, is_current)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
      [TOOL, fileName, rel, file.size, sha256, cleanVersion(body.version),
        String(body.notes ?? "").trim().slice(0, 500) || null]);
  } catch (error) {
    await fs.promises.rm(abs, { force: true }).catch(() => undefined);
    throw error;
  }
  await pruneOld().catch((e) => console.error("[mro-extension-file] limpeza falhou", e));
  console.info(`[mro-extension-file] novo ZIP ${fileName} ${file.size} bytes sha256=${sha256}`);
  res.json(publicInfo(await current()));
});

extensionFilesRouter.get("/history", requireAdmin, async (_req, res) => {
  const rows = await adminQuery<FileRow>(
    "SELECT * FROM public.mro_extension_files WHERE tool = $1 ORDER BY created_at DESC LIMIT 10", [TOOL]);
  res.json({
    items: rows.map((r) => ({
      id: r.id, file_name: r.file_name, size_bytes: Number(r.size_bytes), sha256: r.sha256,
      version: r.version, is_current: r.is_current, updated_at: new Date(r.created_at).toISOString(),
    })),
  });
});

extensionFilesRouter.delete("/current", requireAdmin, async (_req, res) => {
  await adminQuery("UPDATE public.mro_extension_files SET is_current = false WHERE tool = $1 AND is_current", [TOOL]);
  res.json({ available: false });
});
