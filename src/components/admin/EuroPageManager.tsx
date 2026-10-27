import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { uploadVideoInChunks } from "@/lib/chunkedVideoUpload";
import { Globe, Loader2, RefreshCw, Save, Upload, Video } from "lucide-react";
import { format } from "date-fns";

const VIDEO_SERVER = "https://video.maisresultadosonline.com.br";

interface Visit { id: string; ip: string | null; country: string | null; region: string | null; city: string | null; path: string | null; created_at: string }
interface ServerVideo { name: string; hls_url?: string; url?: string; ready?: boolean; status?: string }

/** Vídeo próprio e acessos da página /instagram-nova-euro (reaproveita o servidor de vídeo e transcodificação existentes). */
export function EuroPageManager({ creds }: { creds: { email: string; password: string } }) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [hlsUrl, setHlsUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [transcode, setTranscode] = useState<{ progress: number; status: string } | null>(null);
  const [serverVideos, setServerVideos] = useState<ServerVideo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const call = (body: Record<string, unknown>) =>
    supabase.functions.invoke("euro-page-admin", { body: { ...body, ...creds } });

  const loadVisits = async () => {
    setLoadingVisits(true);
    try { const { data } = await call({ action: "list_visits" }); if (data?.success) setVisits(data.visits); }
    finally { setLoadingVisits(false); }
  };
  const loadVideo = async () => {
    const { data } = await call({ action: "get_video" });
    setHlsUrl(data?.hls_url || ""); setVideoUrl(data?.video_url || ""); setTitle(data?.video_title || "");
  };
  const loadServerVideos = async () => {
    try { const r = await fetch(`${VIDEO_SERVER}/api/video/list`); const d = await r.json(); if (d?.success) setServerVideos(d.files || []); } catch { /* sem lista */ }
  };
  useEffect(() => { loadVisits(); loadVideo(); loadServerVideos(); }, []);

  const save = async (o?: { hls_url?: string; video_url?: string }) => {
    const { data } = await call({ action: "set_video", hls_url: o?.hls_url ?? hlsUrl, video_url: o?.video_url ?? videoUrl, video_title: title });
    if (data?.success) toast.success("Vídeo da página Euro salvo"); else toast.error("Erro ao salvar vídeo");
  };

  const poll = (jobId: string) => {
    const tick = async () => {
      try {
        const r = await fetch(`${VIDEO_SERVER}/api/video/status/${encodeURIComponent(jobId)}`);
        const d = await r.json();
        const p = Number(d?.progress ?? 0);
        setTranscode({ progress: p, status: d?.status || "" });
        if (d?.status === "done" || d?.status === "completed" || p >= 100) { toast.success("Transcodificação concluída"); loadServerVideos(); return; }
        if (d?.status === "error") { toast.error("Erro na transcodificação"); return; }
      } catch { /* tenta de novo */ }
      window.setTimeout(tick, 4000);
    };
    tick();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!/\.mp4$/i.test(file.name) && file.type !== "video/mp4") { toast.error("Envie um arquivo MP4"); return; }
    setUploading(true); setProgress(0);
    try {
      const result = await uploadVideoInChunks({ serverUrl: VIDEO_SERVER, file, onStatus: setStatus, onProgress: (p) => setProgress(p) });
      if (result.success && result.hls_url) {
        setHlsUrl(result.hls_url); setVideoUrl(result.video_url || "");
        await save({ hls_url: result.hls_url, video_url: result.video_url || "" });
        const jobId = result.job_id || result.hls_url.match(/\/videos\/hls\/(.+?)\/master\.m3u8/)?.[1];
        if (jobId) { setTranscode({ progress: 0, status: "queued" }); poll(jobId); }
      } else toast.error(result.error || "Servidor recusou o envio");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no envio");
    } finally {
      setUploading(false); setStatus(""); if (fileRef.current) fileRef.current.value = "";
    }
  };

  const select = (v: ServerVideo) => {
    if (v.ready === false || v.status === "processing" || v.status === "queued") { toast.info("Aguarde a transcodificação concluir"); return; }
    const base = v.name.replace(/\.[^.]+$/, "");
    setHlsUrl(v.hls_url || v.url || `/videos/hls/${base}/master.m3u8`); setVideoUrl("");
    toast.success("Selecionado — clique em Salvar");
  };

  const region = (v: Visit) => [v.city, v.region, v.country].filter(Boolean).join(", ") || "—";

  return (
    <div className="grid gap-4 lg:grid-cols-2 mb-6">
      <Card className="bg-zinc-800/50 border-zinc-700">
        <CardHeader><CardTitle className="text-white flex items-center gap-2"><Video className="w-5 h-5" /> Vídeo da página /instagram-nova-euro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-zinc-400 text-sm break-all">Atual: {hlsUrl || videoUrl || "nenhum (mostra o vídeo do YouTube padrão)"}</p>
          <Input placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white" />
          <Input placeholder="URL HLS (.m3u8)" value={hlsUrl} onChange={(e) => setHlsUrl(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="video/mp4,.mp4" className="hidden" onChange={onFile} disabled={uploading} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} size="sm">
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Enviar MP4
            </Button>
            <Button onClick={() => save()} variant="outline" size="sm" className="border-zinc-600 text-zinc-200"><Save className="w-4 h-4 mr-2" /> Salvar</Button>
            <Button onClick={() => { setHlsUrl(""); setVideoUrl(""); }} variant="outline" size="sm" className="border-zinc-600 text-zinc-400">Limpar</Button>
          </div>
          {uploading && <div className="space-y-1"><Progress value={progress} /><p className="text-xs text-zinc-400">{progress.toFixed(0)}% {status}</p></div>}
          {transcode && <p className="text-xs text-zinc-400">Transcodificação: {transcode.progress.toFixed(0)}% ({transcode.status})</p>}
          {serverVideos.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 border-t border-zinc-700 pt-2">
              <p className="text-xs text-zinc-500">Vídeos já no servidor:</p>
              {serverVideos.map((v) => (
                <button key={v.name} onClick={() => select(v)} className="block w-full text-left text-xs text-zinc-300 hover:text-white truncate">
                  {v.name} {v.ready === false ? "(processando)" : ""}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-zinc-800/50 border-zinc-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2"><Globe className="w-5 h-5" /> Acessos ({visits.length})</CardTitle>
          <Button onClick={loadVisits} size="sm" variant="outline" className="border-zinc-600 text-zinc-300" disabled={loadingVisits}>
            <RefreshCw className={`w-4 h-4 ${loadingVisits ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500 mb-2">Região aproximada pelo IP. Registros apagados após 90 dias.</p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-xs text-zinc-300">
              <thead><tr className="text-zinc-500 text-left"><th className="py-1">Data</th><th>IP</th><th>Região</th></tr></thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="border-t border-zinc-700/50">
                    <td className="py-1 whitespace-nowrap">{format(new Date(v.created_at), "dd/MM HH:mm")}</td>
                    <td className="font-mono">{v.ip || "—"}</td>
                    <td>{region(v)}</td>
                  </tr>
                ))}
                {!visits.length && <tr><td colSpan={3} className="py-3 text-zinc-500">Nenhum acesso registrado ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
