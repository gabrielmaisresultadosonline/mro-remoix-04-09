/**
 * Ao Vivo MRO — transmite uma playlist de vídeos em loop para o Instagram (RTMPS)
 * usando ffmpeg na própria VPS.
 *
 * Rotas (montadas em /functions/v1/aovivo-api, antes do parser bruto global):
 *   POST /login              {identifier, password}   → token
 *   GET  /me                 → streams do usuário (admin vê todas)
 *   POST /streams            {title}                  → cria live (respeita limite)
 *   PATCH /streams/:id       {title, rtmp_url, stream_key}
 *   DELETE /streams/:id
 *   POST /streams/:id/videos (multipart "file")        → playlist ≤ 100MB no total
 *   DELETE /streams/:id/videos/:videoId
 *   POST /streams/:id/order  {ids: string[]}
 *   POST /streams/:id/start | /stop
 *   GET  /admin/users        → usuários MRO + limites (admin)
 *   POST /admin/limits       {user_id, max_streams} (admin)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { adminQuery } from "../db.js";
import { env } from "../env.js";

const MAX_PLAYLIST_BYTES = 100 * 1024 * 1024;
const MAX_VIDEOS = 20;
const ADMIN_EMAIL = (process.env.MRO_ADMIN_EMAIL?.trim() || "mro@gmail.com").toLowerCase();
const ADMIN_PASSWORD = process.env.MRO_ADMIN_PASSWORD?.trim() || "Ga145523@";
const SECRET = process.env.MRO_ADMIN_SESSION_SECRET?.trim() || "mro-admin-session-fallback-secret";
const ROOT = path.join(env.storage.root, "aovivo");

interface Session { kind: "admin" | "user"; userId: string | null; label: string; exp: number }
interface StreamRow {
  id: string; owner_type: string; user_id: string | null; owner_label: string; title: string;
  rtmp_url: string; stream_key: string; status: string; started_at: string | null;
  total_seconds: string; last_error: string | null; created_at: string;
}
interface VideoRow { id: string; stream_id: string; file_name: string; file_path: string; size_bytes: string; order_index: number }

type AuthedRequest = Request & { session?: Session };

// ---------- token ----------
function sign(payload: Session): string {
  const body = Buffer.from(JSON.stringify({ ...payload, scope: "aovivo" })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session & { scope?: string };
    if (parsed.scope !== "aovivo" || parsed.exp < Date.now()) return null;
    return parsed;
  } catch { return null; }
}
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

// ---------- ffmpeg ----------
interface Running { proc: ChildProcess; stopRequested: boolean; startedAt: number; restarts: number }
const running = new Map<string, Running>();

async function loadVideos(streamId: string): Promise<VideoRow[]> {
  return adminQuery<VideoRow>(
    "SELECT * FROM public.aovivo_videos WHERE stream_id = $1 ORDER BY order_index, created_at", [streamId]);
}

function buildTarget(rtmpUrl: string, key: string): string {
  const base = rtmpUrl.trim();
  return base.endsWith("/") ? `${base}${key.trim()}` : `${base}/${key.trim()}`;
}

async function launch(stream: StreamRow, restarts = 0): Promise<void> {
  const videos = await loadVideos(stream.id);
  if (videos.length === 0) throw new Error("Adicione pelo menos 1 vídeo antes de iniciar.");
  if (!stream.rtmp_url || !stream.stream_key) throw new Error("Informe a URL do stream e a chave de stream.");

  const dir = path.join(ROOT, stream.id);
  fs.mkdirSync(dir, { recursive: true });
  const listFile = path.join(dir, "playlist.txt");
  fs.writeFileSync(listFile, videos.map((v) => `file '${v.file_path.replace(/'/g, "'\\''")}'`).join("\n") + "\n");

  // Vertical 720x1280 @30fps, H.264 + AAC 44.1k: formato aceito pelo Instagram Live.
  const args = [
    "-hide_banner", "-loglevel", "warning", "-re",
    "-stream_loop", "-1", "-f", "concat", "-safe", "0", "-i", listFile,
    "-vf", "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p",
    "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
    "-b:v", "3500k", "-maxrate", "3500k", "-bufsize", "7000k", "-g", "60", "-keyint_min", "60",
    "-af", "aresample=async=1,loudnorm=I=-14:TP=-1.5:LRA=11",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
    "-f", "flv", buildTarget(stream.rtmp_url, stream.stream_key),
  ];
  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  const entry: Running = { proc, stopRequested: false, startedAt: Date.now(), restarts };
  running.set(stream.id, entry);
  let lastErr = "";
  proc.stderr?.on("data", (chunk: Buffer) => { lastErr = chunk.toString().slice(-400); });
  proc.on("error", (error) => { lastErr = error.message; });

  await adminQuery(
    "UPDATE public.aovivo_streams SET status='running', started_at=COALESCE(started_at, now()), last_error=NULL, updated_at=now() WHERE id=$1",
    [stream.id]);
  console.info(`[aovivo] stream=${stream.id} iniciado (${videos.length} vídeos, tentativa ${restarts})`);

  proc.on("exit", async (code) => {
    const elapsed = Math.round((Date.now() - entry.startedAt) / 1000);
    running.delete(stream.id);
    await adminQuery("UPDATE public.aovivo_streams SET total_seconds = total_seconds + $2, updated_at=now() WHERE id=$1",
      [stream.id, elapsed]).catch(() => undefined);
    if (entry.stopRequested) return;
    console.warn(`[aovivo] stream=${stream.id} ffmpeg saiu code=${code} ${lastErr}`);
    // Reconecta sozinho (queda do Instagram/rede). Para após 20 falhas rápidas seguidas.
    const quick = elapsed < 30 ? restarts + 1 : 0;
    if (quick >= 20) {
      await adminQuery("UPDATE public.aovivo_streams SET status='error', started_at=NULL, last_error=$2 WHERE id=$1",
        [stream.id, lastErr || `ffmpeg encerrou (código ${code})`]).catch(() => undefined);
      return;
    }
    setTimeout(async () => {
      const [fresh] = await adminQuery<StreamRow>("SELECT * FROM public.aovivo_streams WHERE id=$1 AND deleted_at IS NULL", [stream.id]);
      if (fresh?.status === "running") launch(fresh, quick).catch(async (e: Error) => {
        await adminQuery("UPDATE public.aovivo_streams SET status='error', started_at=NULL, last_error=$2 WHERE id=$1", [stream.id, e.message]);
      });
    }, Math.min(30000, 3000 * (quick + 1)));
  });
}

async function stop(streamId: string): Promise<void> {
  const entry = running.get(streamId);
  if (entry) { entry.stopRequested = true; entry.proc.kill("SIGTERM"); }
  await adminQuery("UPDATE public.aovivo_streams SET status='stopped', started_at=NULL, updated_at=now() WHERE id=$1", [streamId]);
}

/** Retoma lives que estavam ativas quando o servidor reiniciou. */
export async function resumeAovivoStreams(): Promise<void> {
  try {
    const rows = await adminQuery<StreamRow>("SELECT * FROM public.aovivo_streams WHERE status='running' AND deleted_at IS NULL");
    for (const row of rows) launch(row).catch((e: Error) => console.warn(`[aovivo] retomar ${row.id}: ${e.message}`));
  } catch (error) {
    console.warn(`[aovivo] tabela ainda não criada: ${(error as Error).message}`);
  }
}

// ---------- helpers ----------
function serialize(s: StreamRow, videos: VideoRow[]) {
  const live = running.get(s.id);
  const currentSeconds = live ? Math.round((Date.now() - live.startedAt) / 1000) : 0;
  return {
    id: s.id, owner_type: s.owner_type, user_id: s.user_id, owner_label: s.owner_label, title: s.title,
    rtmp_url: s.rtmp_url, stream_key: s.stream_key, status: s.status, started_at: s.started_at,
    online: Boolean(live), total_seconds: Number(s.total_seconds) + currentSeconds, last_error: s.last_error,
    created_at: s.created_at,
    videos: videos.filter((v) => v.stream_id === s.id).map((v) => ({
      id: v.id, file_name: v.file_name, size_bytes: Number(v.size_bytes), order_index: v.order_index })),
  };
}

async function getOwned(req: AuthedRequest, id: string): Promise<StreamRow | null> {
  const [row] = await adminQuery<StreamRow>("SELECT * FROM public.aovivo_streams WHERE id=$1 AND deleted_at IS NULL", [id]);
  if (!row) return null;
  const s = req.session!;
  if (s.kind === "admin") return row;
  return row.user_id === s.userId ? row : null;
}

async function maxStreamsFor(userId: string): Promise<number> {
  const [row] = await adminQuery<{ max_streams: number }>("SELECT max_streams FROM public.aovivo_limits WHERE user_id=$1", [userId]);
  return row?.max_streams ?? 1;
}

// ---------- router ----------
export const aovivoRouter = express.Router();

aovivoRouter.use((req, res, next) => {
  const origin = req.header("origin");
  res.setHeader("Access-Control-Allow-Origin", origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", req.header("access-control-request-headers") ?? "authorization, content-type, x-aovivo-token, apikey");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  next();
});

const jsonParser = express.json({ limit: "1mb" });

aovivoRouter.post("/login", jsonParser, async (req, res) => {
  const identifier = String(req.body?.identifier ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "").trim();
  if (!identifier || !password || identifier.length > 255 || password.length > 255) {
    res.status(400).json({ success: false, error: "Informe usuário/e-mail e senha." }); return;
  }
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  if (identifier === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    res.json({ success: true, token: sign({ kind: "admin", userId: null, label: "Admin MRO", exp }), kind: "admin", label: "Admin MRO" });
    return;
  }
  const [user] = await adminQuery<{ id: string; username: string; password_hash: string | null; password_plain: string | null; is_active: boolean }>(
    `SELECT id, username, password_hash, password_plain, is_active FROM public.mro_tool_users
      WHERE lower(username)=$1 OR lower(COALESCE(email,''))=$1 LIMIT 1`, [identifier]);
  const ok = Boolean(user && ((user.password_hash && user.password_hash === sha256(password)) || user.password_plain === password));
  if (!user || !ok) { res.json({ success: false, error: "Usuário ou senha incorretos" }); return; }
  if (user.is_active === false) { res.json({ success: false, error: "Acesso bloqueado" }); return; }
  res.json({ success: true, token: sign({ kind: "user", userId: user.id, label: user.username, exp }), kind: "user", label: user.username });
});

aovivoRouter.use((req: AuthedRequest, res, next) => {
  const session = verify(req.header("x-aovivo-token")?.trim());
  if (!session) { res.status(401).json({ success: false, error: "Sessão expirada. Entre novamente." }); return; }
  req.session = session;
  next();
});

aovivoRouter.get("/me", async (req: AuthedRequest, res) => {
  const s = req.session!;
  const streams = s.kind === "admin"
    ? await adminQuery<StreamRow>("SELECT * FROM public.aovivo_streams WHERE deleted_at IS NULL ORDER BY (status='running') DESC, created_at DESC")
    : await adminQuery<StreamRow>("SELECT * FROM public.aovivo_streams WHERE deleted_at IS NULL AND user_id=$1 ORDER BY created_at", [s.userId]);
  const ids = streams.map((x) => x.id);
  const videos = ids.length
    ? await adminQuery<VideoRow>("SELECT * FROM public.aovivo_videos WHERE stream_id = ANY($1::uuid[]) ORDER BY order_index, created_at", [ids])
    : [];
  const max = s.kind === "admin" ? 50 : await maxStreamsFor(s.userId!);
  res.json({ success: true, kind: s.kind, label: s.label, max_streams: max, max_playlist_bytes: MAX_PLAYLIST_BYTES,
    streams: streams.map((x) => serialize(x, videos)) });
});

aovivoRouter.post("/streams", jsonParser, async (req: AuthedRequest, res) => {
  const s = req.session!;
  if (s.kind === "user") {
    const [{ count }] = await adminQuery<{ count: string }>(
      "SELECT count(*) FROM public.aovivo_streams WHERE user_id=$1 AND deleted_at IS NULL", [s.userId]);
    if (Number(count) >= await maxStreamsFor(s.userId!)) {
      res.status(403).json({ success: false, error: "Seu plano permite apenas 1 ao vivo. Fale com o admin para liberar mais." }); return;
    }
  }
  const title = String(req.body?.title ?? "Minha live").trim().slice(0, 80) || "Minha live";
  const [row] = await adminQuery<StreamRow>(
    "INSERT INTO public.aovivo_streams (owner_type, user_id, owner_label, title) VALUES ($1,$2,$3,$4) RETURNING *",
    [s.kind, s.userId, s.label, title]);
  res.json({ success: true, stream: serialize(row, []) });
});

aovivoRouter.patch("/streams/:id", jsonParser, async (req: AuthedRequest, res) => {
  const row = await getOwned(req, req.params.id);
  if (!row) { res.status(404).json({ success: false, error: "Live não encontrada" }); return; }
  const title = String(req.body?.title ?? row.title).trim().slice(0, 80) || row.title;
  const rtmp = String(req.body?.rtmp_url ?? row.rtmp_url).trim().slice(0, 500);
  const key = String(req.body?.stream_key ?? row.stream_key).trim().slice(0, 1000);
  if (rtmp && !/^rtmps?:\/\//i.test(rtmp)) { res.status(400).json({ success: false, error: "A URL do stream deve começar com rtmps://" }); return; }
  await adminQuery("UPDATE public.aovivo_streams SET title=$2, rtmp_url=$3, stream_key=$4, updated_at=now() WHERE id=$1",
    [row.id, title, rtmp, key]);
  res.json({ success: true });
});

aovivoRouter.delete("/streams/:id", async (req: AuthedRequest, res) => {
  const row = await getOwned(req, req.params.id);
  if (!row) { res.status(404).json({ success: false, error: "Live não encontrada" }); return; }
  await stop(row.id);
  await adminQuery("UPDATE public.aovivo_streams SET deleted_at=now() WHERE id=$1", [row.id]);
  fs.rmSync(path.join(ROOT, row.id), { recursive: true, force: true });
  await adminQuery("DELETE FROM public.aovivo_videos WHERE stream_id=$1", [row.id]);
  res.json({ success: true });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(ROOT, String(req.params.id).replace(/[^a-f0-9-]/gi, ""));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".mp4";
      cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`);
    },
  }),
  limits: { fileSize: MAX_PLAYLIST_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^video\//.test(file.mimetype) || /\.(mp4|mov|webm|mkv|m4v)$/i.test(file.originalname)),
});

aovivoRouter.post("/streams/:id/videos", async (req: AuthedRequest, res, next) => {
  const row = await getOwned(req, req.params.id);
  if (!row) { res.status(404).json({ success: false, error: "Live não encontrada" }); return; }
  upload.single("file")(req, res, async (err: unknown) => {
    if (err) {
      res.status(400).json({ success: false, error: (err as { code?: string }).code === "LIMIT_FILE_SIZE"
        ? "O vídeo passa de 100MB." : "Falha no envio do vídeo." });
      return;
    }
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: "Envie um arquivo de vídeo (MP4, MOV, WEBM)." }); return; }
    try {
      const [agg] = await adminQuery<{ total: string; count: string }>(
        "SELECT COALESCE(sum(size_bytes),0) AS total, count(*) AS count FROM public.aovivo_videos WHERE stream_id=$1", [row.id]);
      if (Number(agg.count) >= MAX_VIDEOS || Number(agg.total) + file.size > MAX_PLAYLIST_BYTES) {
        fs.rmSync(file.path, { force: true });
        res.status(400).json({ success: false, error: Number(agg.count) >= MAX_VIDEOS
          ? "Máximo de 20 vídeos por live." : "A lista inteira não pode passar de 100MB somando todos os vídeos." });
        return;
      }
      await adminQuery(
        "INSERT INTO public.aovivo_videos (stream_id, file_name, file_path, size_bytes, order_index) VALUES ($1,$2,$3,$4,$5)",
        [row.id, file.originalname.slice(0, 200), file.path, file.size, Number(agg.count)]);
      res.json({ success: true });
    } catch (e) { next(e); }
  });
});

aovivoRouter.delete("/streams/:id/videos/:videoId", async (req: AuthedRequest, res) => {
  const row = await getOwned(req, req.params.id);
  if (!row) { res.status(404).json({ success: false, error: "Live não encontrada" }); return; }
  const [video] = await adminQuery<VideoRow>("DELETE FROM public.aovivo_videos WHERE id=$1 AND stream_id=$2 RETURNING *", [req.params.videoId, row.id]);
  if (video) fs.rmSync(video.file_path, { force: true });
  res.json({ success: true, restart_needed: row.status === "running" });
});

aovivoRouter.post("/streams/:id/order", jsonParser, async (req: AuthedRequest, res) => {
  const row = await getOwned(req, req.params.id);
  if (!row) { res.status(404).json({ success: false, error: "Live não encontrada" }); return; }
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).map(String).slice(0, MAX_VIDEOS) : [];
  for (let i = 0; i < ids.length; i++) {
    await adminQuery("UPDATE public.aovivo_videos SET order_index=$3 WHERE id=$1 AND stream_id=$2", [ids[i], row.id, i]);
  }
  res.json({ success: true });
});

aovivoRouter.post("/streams/:id/start", async (req: AuthedRequest, res) => {
  const row = await getOwned(req, req.params.id);
  if (!row) { res.status(404).json({ success: false, error: "Live não encontrada" }); return; }
  if (running.has(row.id)) { res.json({ success: true }); return; }
  try { await launch(row); res.json({ success: true }); }
  catch (e) { res.status(400).json({ success: false, error: (e as Error).message }); }
});

aovivoRouter.post("/streams/:id/stop", async (req: AuthedRequest, res) => {
  const row = await getOwned(req, req.params.id);
  if (!row) { res.status(404).json({ success: false, error: "Live não encontrada" }); return; }
  await stop(row.id);
  res.json({ success: true });
});

aovivoRouter.get("/admin/users", async (req: AuthedRequest, res) => {
  if (req.session!.kind !== "admin") { res.status(403).json({ success: false, error: "Somente admin" }); return; }
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const users = await adminQuery<{ id: string; username: string; email: string | null; max_streams: number | null; streams: string }>(
    `SELECT u.id, u.username, u.email, l.max_streams,
            (SELECT count(*) FROM public.aovivo_streams s WHERE s.user_id=u.id AND s.deleted_at IS NULL) AS streams
       FROM public.mro_tool_users u LEFT JOIN public.aovivo_limits l ON l.user_id=u.id
      WHERE $1 = '' OR lower(u.username) LIKE '%'||$1||'%' OR lower(COALESCE(u.email,'')) LIKE '%'||$1||'%'
      ORDER BY (l.max_streams IS NOT NULL) DESC, u.username LIMIT 50`, [q]);
  res.json({ success: true, users: users.map((u) => ({ ...u, max_streams: u.max_streams ?? 1, streams: Number(u.streams) })) });
});

aovivoRouter.post("/admin/limits", jsonParser, async (req: AuthedRequest, res) => {
  if (req.session!.kind !== "admin") { res.status(403).json({ success: false, error: "Somente admin" }); return; }
  const userId = String(req.body?.user_id ?? "");
  const max = Math.max(0, Math.min(50, Number(req.body?.max_streams ?? 1) | 0));
  if (!/^[0-9a-f-]{36}$/i.test(userId)) { res.status(400).json({ success: false, error: "Usuário inválido" }); return; }
  await adminQuery(
    `INSERT INTO public.aovivo_limits (user_id, max_streams) VALUES ($1,$2)
     ON CONFLICT (user_id) DO UPDATE SET max_streams=EXCLUDED.max_streams, updated_at=now()`, [userId, max]);
  res.json({ success: true });
});

aovivoRouter.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[aovivo] erro:", error);
  res.status(500).json({ success: false, error: "Erro interno do Ao Vivo. Verifique se a VPS foi atualizada." });
});
