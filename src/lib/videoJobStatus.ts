export interface VideoJob {
  id?: string;
  status?: string;
  progress?: number;
  error?: string | null;
  stage?: string | null;
  stage_progress?: number | null;
  updated_at?: string;
  idle_seconds?: number;
  stalled?: boolean;
  can_retry?: boolean;
  ready?: boolean;
}

export type JobKind = "waiting" | "processing" | "done" | "error" | "stalled" | "unknown";

/** Mesmo limite do servidor de vídeo: 3 minutos sem atualização = possível travamento. */
export const STALL_SECONDS = 180;

/** Traduz o estado real informado pelo servidor; não inventa porcentagem. */
export function describeJobState(job: VideoJob | null, legacy = false, now = Date.now()): { kind: JobKind; label: string; percent: number | null } {
  if (!job) return { kind: "unknown", label: "Consultando servidor…", percent: null };
  const s = String(job.status || "").toLowerCase();
  const pct = typeof job.progress === "number" && Number.isFinite(job.progress) ? Math.max(0, Math.min(100, Math.round(job.progress))) : null;
  if (job.ready || s === "completed" || s === "done") return { kind: "done", label: "Concluído", percent: 100 };
  if (s === "error" || s === "failed") return { kind: "error", label: "Erro no processamento", percent: pct };
  const idle = job.idle_seconds ?? (job.updated_at ? (now - Date.parse(job.updated_at)) / 1000 : 0);
  const stalled = job.stalled ?? (legacy && (s === "processing" || s === "queued") && idle > STALL_SECONDS);
  if (stalled) return { kind: "stalled", label: "Possível travamento", percent: pct };
  if (s === "queued") return { kind: "waiting", label: "Aguardando na fila", percent: null };
  // Antes do primeiro evento do ffmpeg o servidor grava 0–1%: ainda não há medida real.
  if (s === "processing") return { kind: "processing", label: "Processando", percent: pct !== null && pct > 1 ? pct : null };
  return { kind: "unknown", label: s ? `Status: ${s}` : "Status desconhecido", percent: pct };
}
