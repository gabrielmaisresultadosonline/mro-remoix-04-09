import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCcw, XCircle } from "lucide-react";
import { describeJobState, type VideoJob } from "@/lib/videoJobStatus";

const POLL_MS = 3000;

/** Acompanha a transcodificação real de um vídeo no video-server (sem progresso simulado). */
export function EuroVideoJobTracker({ serverUrl, jobId, onDone }: { serverUrl: string; jobId: string; onDone?: () => void }) {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const timer = useRef<number>();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const load = useCallback(async () => {
    try {
      let r = await fetch(`${serverUrl}/api/video/job/${encodeURIComponent(jobId)}`);
      let isLegacy = false;
      if (r.status === 404) {
        const body = await r.json().catch(() => ({}));
        if (!body?.error || body.error === "Not found" || !("success" in body)) {
          // Servidor ainda sem a rota detalhada: usa o status básico.
          r = await fetch(`${serverUrl}/api/video/status/${encodeURIComponent(jobId)}`);
          isLegacy = true;
        } else { setFetchError(body.error); return false; }
      }
      if (!r.ok) { setFetchError(`Servidor respondeu ${r.status}`); return true; }
      const d = await r.json();
      setLegacy(isLegacy); setFetchError(null); setJob(d);
      const state = describeJobState(d, isLegacy);
      if (state.kind === "done") { doneRef.current?.(); return false; }
      return state.kind !== "error";
    } catch {
      setFetchError("Sem conexão com o servidor de vídeo — tentando de novo");
      return true;
    }
  }, [serverUrl, jobId]);

  useEffect(() => {
    let alive = true;
    const loop = async () => {
      const keep = await load();
      if (alive && keep) timer.current = window.setTimeout(loop, POLL_MS);
    };
    loop();
    return () => { alive = false; window.clearTimeout(timer.current); };
  }, [load]);

  const retry = async () => {
    setRetrying(true);
    try {
      const r = await fetch(`${serverUrl}/api/video/job/${encodeURIComponent(jobId)}/retry`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.success) { toast.error(d?.error || "Não foi possível reprocessar"); return; }
      toast.success("Reprocessamento iniciado");
      window.clearTimeout(timer.current);
      const loop = async () => { if (await load()) timer.current = window.setTimeout(loop, POLL_MS); };
      loop();
    } finally { setRetrying(false); }
  };

  const state = describeJobState(job, legacy);
  const Icon = { waiting: Clock, processing: Loader2, done: CheckCircle2, error: XCircle, stalled: AlertTriangle, unknown: Clock }[state.kind];
  const color = { waiting: "text-zinc-300", processing: "text-amber-300", done: "text-emerald-400", error: "text-red-400", stalled: "text-orange-400", unknown: "text-zinc-400" }[state.kind];

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className={`text-sm font-medium flex items-center gap-2 ${color}`}>
          <Icon className={`w-4 h-4 ${state.kind === "processing" ? "animate-spin" : ""}`} /> {state.label}
        </p>
        <span className="text-xs text-zinc-500 truncate max-w-[50%]" title={jobId}>{jobId}</span>
      </div>
      {state.percent !== null ? (
        <div className="space-y-1">
          <Progress value={state.percent} />
          <p className="text-xs text-zinc-400">{state.percent}% concluído</p>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Progresso percentual indisponível nesta etapa.</p>
      )}
      {job?.stage && <p className="text-xs text-zinc-400">Etapa: {job.stage}{job.stage_progress != null ? ` — ${Math.round(job.stage_progress)}%` : ""}</p>}
      {job?.updated_at && state.kind !== "done" && <p className="text-xs text-zinc-500">Última atualização do servidor: há {job.idle_seconds ?? Math.round((Date.now() - Date.parse(job.updated_at)) / 1000)}s</p>}
      {state.kind === "stalled" && <p className="text-xs text-orange-300">Sem progresso há mais de 3 minutos. O processamento pode ter sido interrompido (por exemplo, reinício do servidor).</p>}
      {state.kind === "error" && <p className="text-xs text-red-300 break-words">Ocorreu um erro na transcodificação{job?.error ? `: ${job.error}` : "."}</p>}
      {legacy && state.kind !== "done" && <p className="text-xs text-zinc-500">Etapa detalhada e “Tentar novamente” ficam disponíveis após atualizar o servidor de vídeo.</p>}
      {fetchError && <p className="text-xs text-zinc-500">{fetchError}</p>}
      {!legacy && (state.kind === "error" || state.kind === "stalled") && (
        job?.can_retry ? (
          <Button size="sm" variant="outline" onClick={retry} disabled={retrying} className="border-zinc-600 text-zinc-200">
            {retrying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />} Tentar novamente
          </Button>
        ) : <p className="text-xs text-zinc-500">O arquivo original não está mais no servidor; envie o MP4 de novo.</p>
      )}
    </div>
  );
}
