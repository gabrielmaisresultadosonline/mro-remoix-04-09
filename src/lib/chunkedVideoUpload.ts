/**
 * Envio de vídeos grandes em partes para o video-server.
 *
 * O domínio do servidor de vídeo passa pela Cloudflare, que recusa requisições
 * acima de 100MB. Por isso o arquivo é fatiado em partes de 25MB, cada uma com
 * novas tentativas automáticas, e o servidor junta tudo antes de transcodificar.
 */

export interface VideoUploadResult {
  success: boolean;
  job_id?: string;
  video_url?: string;
  hls_url?: string;
  error?: string;
}

export interface ChunkedUploadOptions {
  serverUrl: string;
  file: File;
  onProgress?: (percent: number, info: { sentBytes: number; totalBytes: number; speedBps: number }) => void;
  onStatus?: (message: string) => void;
  signal?: AbortSignal;
  chunkSize?: number;
}

const DEFAULT_CHUNK = 25 * 1024 * 1024;
const MAX_RETRIES = 6;
/** Sem nenhum byte enviado por este tempo, a parte é cancelada e reenviada. */
const STALL_MS = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class VideoServerOutdatedError extends Error {
  constructor() {
    super(
      "O servidor de vídeo ainda não foi atualizado para receber arquivos grandes. Rode a atualização da VPS e tente de novo.",
    );
    this.name = "VideoServerOutdatedError";
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Envia uma parte via XHR para ter progresso em tempo real e detectar travamento. */
function putChunk(
  url: string,
  blob: Blob,
  onBytes: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    let lastActivity = Date.now();
    const watchdog = window.setInterval(() => {
      if (Date.now() - lastActivity > STALL_MS) {
        xhr.abort();
        cleanup();
        reject(new Error("Conexão parada (sem envio por 60s)"));
      }
    }, 5000);
    const onAbort = () => { xhr.abort(); cleanup(); reject(new DOMException("Cancelado", "AbortError")); };
    const cleanup = () => { window.clearInterval(watchdog); signal?.removeEventListener("abort", onAbort); };
    signal?.addEventListener("abort", onAbort);

    xhr.upload.onprogress = (ev) => { lastActivity = Date.now(); onBytes(ev.loaded); };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Servidor respondeu ${xhr.status}`));
    };
    xhr.onerror = () => { cleanup(); reject(new Error("Falha de rede")); };
    xhr.send(blob);
  });
}

export async function uploadVideoInChunks(opts: ChunkedUploadOptions): Promise<VideoUploadResult> {
  const { serverUrl, file, onProgress, onStatus, signal } = opts;
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK;
  const total = Math.max(1, Math.ceil(file.size / chunkSize));
  const base = serverUrl.replace(/\/+$/, "");

  onStatus?.("Preparando envio…");
  const initRes = await fetch(`${base}/api/video/chunk/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, size: file.size, total_chunks: total }),
    signal,
  }).catch(() => { throw new Error("Não foi possível conectar ao servidor de vídeo"); });
  if (initRes.status === 404) throw new VideoServerOutdatedError();
  const init = await readJson(initRes);
  if (!initRes.ok || !init.success || typeof init.upload_id !== "string") {
    throw new Error((init.error as string) || `Servidor recusou o envio (${initRes.status})`);
  }
  const uploadId = init.upload_id;

  const doneBytes = new Array<number>(total).fill(0);
  const startedAt = Date.now();
  const report = () => {
    const sent = doneBytes.reduce((a, b) => a + b, 0);
    const elapsed = Math.max(1, (Date.now() - startedAt) / 1000);
    onProgress?.(Math.min(99, Math.floor((sent / file.size) * 100)), {
      sentBytes: sent,
      totalBytes: file.size,
      speedBps: sent / elapsed,
    });
  };
  report();

  for (let i = 0; i < total; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const blob = file.slice(start, end);
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      try {
        onStatus?.(`Enviando parte ${i + 1} de ${total}${attempt ? ` (tentativa ${attempt + 1})` : ""}`);
        await putChunk(`${base}/api/video/chunk/${uploadId}/${i}`, blob, (loaded) => {
          doneBytes[i] = loaded;
          report();
        }, signal);
        doneBytes[i] = end - start;
        report();
        break;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        attempt++;
        doneBytes[i] = 0;
        report();
        if (attempt >= MAX_RETRIES) {
          throw new Error(`Falha ao enviar a parte ${i + 1}/${total}: ${(err as Error).message}`);
        }
        onStatus?.(`Internet instável — reenviando parte ${i + 1} em ${attempt * 2}s…`);
        await sleep(attempt * 2000);
      }
    }
  }

  onStatus?.("Finalizando no servidor…");
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${base}/api/video/chunk/${uploadId}/complete`, { method: "POST", signal });
      const data = await readJson(res);
      if (res.ok && data.success) {
        onProgress?.(100, { sentBytes: file.size, totalBytes: file.size, speedBps: 0 });
        return data as unknown as VideoUploadResult;
      }
      if (res.status < 500) throw new Error((data.error as string) || `Erro ${res.status} ao finalizar`);
    } catch (err) {
      if (attempt === 3) throw err;
    }
    await sleep(3000);
  }
  throw new Error("Não foi possível finalizar o envio");
}
