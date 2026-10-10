import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_PLAYER_SETTINGS, type PromoPlayerSettings } from "@/components/sales/PromoHlsVideo";
import { Loader2, Save, Trash2, Video, LogOut, BarChart3, Users, MousePointerClick, PlayCircle, TrendingUp, Clock } from "lucide-react";

const VIDEO_SERVER = "https://video.maisresultadosonline.com.br";
const STORAGE_KEY = "fmp_admin_creds";

interface Analytics {
  summary: {
    totalPageViews: number;
    uniqueVisitors: number;
    totalStarts: number;
    uniqueStarters: number;
    totalClicks: number;
    uniqueClickers: number;
    avgProgress: number;
    milestone25: number;
    milestone50: number;
    milestone75: number;
    milestone100: number;
    conversionRate: number;
    lastAccess: string | null;
    lastVideoAccess?: string | null;
    visitedNoVideo?: number;
  };
  byPage?: { page: string; views: number; visitors: number; starters: number; no_video: number; p50: number; p100: number; clicks: number; last: string }[];
  daily: { day: string; visitors: number; clicks: number; starts: number; completes: number }[];
  referrers: { host: string; count: number }[];
  ranking: { visitor_id: string; first: string; last: string; max_progress: number; clicked: boolean; page?: string; started?: boolean; last_video?: string | null }[];
}

interface ServerVideo {
  name: string;
  url: string;
  hls_url: string;
  status?: string;
  progress?: number;
  ready?: boolean;
  can_use?: boolean;
  created?: string;
}

export default function FerramentaMROPromoAdmin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [logging, setLogging] = useState(false);

  const [videoUrl, setVideoUrl] = useState("");
  const [hlsUrl, setHlsUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [player, setPlayer] = useState<PromoPlayerSettings>(DEFAULT_PLAYER_SETTINGS);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcoding, setTranscoding] = useState<{ jobId: string; progress: number; status: string } | null>(null);
  const [serverVideos, setServerVideos] = useState<ServerVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const transcodeTimer = useRef<number | null>(null);

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setCreds(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (!creds) return;
    loadCfg();
    loadServerVideos();
    loadAnalytics();
    return () => { if (transcodeTimer.current) window.clearTimeout(transcodeTimer.current); };
  }, [creds]);

  const loadAnalytics = async (days = analyticsDays) => {
    if (!creds) return;
    setLoadingAnalytics(true);
    try {
      const { data } = await supabase.functions.invoke("ferramentamropromo-video", {
        body: { action: "get_analytics", email: creds.email, password: creds.password, days },
      });
      if (data?.success) setAnalytics(data as Analytics);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const doLogin = async () => {
    setLogging(true);
    try {
      const { data } = await supabase.functions.invoke("ferramentamropromo-video", {
        body: { action: "admin_login", email, password },
      });
      if (data?.success) {
        const c = { email, password };
        setCreds(c);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
      } else {
        toast.error("Credenciais inválidas");
      }
    } finally { setLogging(false); }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCreds(null);
    setEmail(""); setPassword("");
  };

  const loadCfg = async () => {
    const { data } = await supabase.functions.invoke("ferramentamropromo-video", { body: { action: "get_video" } });
    if (data) {
      setVideoUrl(data.video_url || "");
      setHlsUrl(data.hls_url || "");
      setVideoTitle(data.video_title || "");
      setPlayer({ ...DEFAULT_PLAYER_SETTINGS, ...(data.player_settings || {}) });
    }
  };

  const save = async (override?: { video_url?: string; hls_url?: string }) => {
    if (!creds) return;
    const { data } = await supabase.functions.invoke("ferramentamropromo-video", {
      body: {
        action: "set_video", email: creds.email, password: creds.password,
        video_url: override?.video_url ?? videoUrl, hls_url: override?.hls_url ?? hlsUrl, video_title: videoTitle,
        player_settings: player,
      },
    });
    if (data?.success) toast.success("Vídeo salvo");
    else toast.error("Erro ao salvar");
  };

  const loadServerVideos = async () => {
    setLoadingVideos(true);
    try {
      const res = await fetch(`${VIDEO_SERVER}/api/video/list`);
      const data = await res.json();
      if (data?.success) setServerVideos(data.files || []);
    } catch { setServerVideos([]); }
    finally { setLoadingVideos(false); }
  };

  const selectExisting = (v: ServerVideo) => {
    if (v.ready === false || v.can_use === false || v.status === "processing" || v.status === "queued") {
      toast.info("Aguarde o transcoding concluir.");
      return;
    }
    const baseName = v.name.replace(/\.[^.]+$/, "");
    const selectedHls = v.hls_url || v.url || `/videos/hls/${baseName}/master.m3u8`;
    setVideoUrl("");
    setHlsUrl(selectedHls);
    toast.success("Vídeo selecionado! Clique em Salvar.");
  };

  const pollTranscoding = async (jobId: string) => {
    const tick = async () => {
      try {
        const res = await fetch(`${VIDEO_SERVER}/api/video/status/${encodeURIComponent(jobId)}`);
        const data = await res.json();
        setTranscoding({ jobId, progress: data.progress || 0, status: data.status });
        if (data.status === "completed") { toast.success("Transcoding concluído"); setTimeout(() => setTranscoding(null), 3000); loadServerVideos(); return; }
        if (data.status === "error") { toast.error("Erro no transcoding"); setTimeout(() => setTranscoding(null), 5000); return; }
        transcodeTimer.current = window.setTimeout(tick, 2000);
      } catch { transcodeTimer.current = window.setTimeout(tick, 3000); }
    };
    tick();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024 * 1024) { toast.error("Máx 5GB"); return; }
    setUploading(true); setUploadProgress(0);
    try {
      const formData = new FormData(); formData.append("video", file);
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${VIDEO_SERVER}/api/video/upload`); xhr.timeout = 7200000;
        xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100)); };
        xhr.onload = () => xhr.status === 200 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`HTTP ${xhr.status}`));
        xhr.ontimeout = () => reject(new Error("Timeout"));
        xhr.onerror = () => reject(new Error("Falha de rede"));
        xhr.send(formData);
      });
      if (result.success) {
        setVideoUrl(result.video_url); setHlsUrl(result.hls_url);
        // Ativa imediatamente nas páginas; até o HLS ficar pronto, o player usa o arquivo original.
        await save({ video_url: result.video_url, hls_url: result.hls_url });
        toast.success("Upload concluído e vídeo ativo! Transcodificando qualidades…");
        const jobId = result.job_id || (result.hls_url || "").match(/\/videos\/hls\/(.+?)\/master\.m3u8/)?.[1];
        if (jobId) { setTranscoding({ jobId, progress: 0, status: "queued" }); pollTranscoding(jobId); }
      } else toast.error("Servidor recusou");
    } catch (err: any) { toast.error(err.message || "Erro no upload"); }
    finally { setUploading(false); setUploadProgress(0); if (fileRef.current) fileRef.current.value = ""; }
  };

  const deleteVideo = async (name: string) => {
    if (!confirm(`Excluir "${name}"?`)) return;
    try {
      const res = await fetch(`${VIDEO_SERVER}/api/video/${encodeURIComponent(name)}`, { method: "DELETE" });
      const data = await res.json();
      if (data?.success) { toast.success("Excluído"); setServerVideos((p) => p.filter((v) => v.name !== name)); }
      else toast.error("Erro ao excluir");
    } catch { toast.error("Erro ao conectar ao servidor"); }
  };

  if (!creds) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 bg-zinc-900 border-zinc-800">
          <h1 className="text-2xl font-bold mb-6 text-center">Admin — Ferramenta MRO Promo</h1>
          <div className="space-y-4">
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button onClick={doLogin} disabled={logging} className="w-full">
              {logging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Entrar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Ferramenta MRO Promo — Admin</h1>
          <Button variant="outline" onClick={logout}><LogOut className="w-4 h-4 mr-2" /> Sair</Button>
        </div>

        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-zinc-900 border border-zinc-800">
            <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-2" /> Analytics</TabsTrigger>
            <TabsTrigger value="videos"><Video className="w-4 h-4 mr-2" /> Vídeo</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                {[7, 30, 90].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={analyticsDays === d ? "default" : "outline"}
                    onClick={() => { setAnalyticsDays(d); loadAnalytics(d); }}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => loadAnalytics()} disabled={loadingAnalytics}>
                {loadingAnalytics ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
              </Button>
            </div>

            {analytics ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard icon={<Users className="w-4 h-4" />} label="Visitantes únicos" value={analytics.summary.uniqueVisitors} sub={`${analytics.summary.totalPageViews} pageviews`} />
                  <MetricCard icon={<PlayCircle className="w-4 h-4" />} label="Iniciaram vídeo" value={analytics.summary.uniqueStarters} sub={`${analytics.summary.totalStarts} plays`} />
                  <MetricCard icon={<MousePointerClick className="w-4 h-4" />} label="Cliques CTA (Lead)" value={analytics.summary.uniqueClickers} sub={`${analytics.summary.totalClicks} cliques totais`} />
                  <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Taxa de conversão" value={`${analytics.summary.conversionRate}%`} sub="clique / visitante" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard icon={<Users className="w-4 h-4" />} label="Acessaram e NÃO viram o vídeo" value={analytics.summary.visitedNoVideo ?? 0} />
                  <MetricCard icon={<PlayCircle className="w-4 h-4" />} label="Assistiram 50%" value={analytics.summary.milestone50} />
                  <MetricCard icon={<PlayCircle className="w-4 h-4" />} label="Assistiram 100%" value={analytics.summary.milestone100} />
                  <MetricCard icon={<Clock className="w-4 h-4" />} label="Último acesso ao vídeo" value={analytics.summary.lastVideoAccess ? new Date(analytics.summary.lastVideoAccess).toLocaleString("pt-BR") : "—"} />
                </div>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                  <h3 className="text-lg font-semibold mb-4">Visitas por página (ferramentamropromo e afiliados)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="text-left py-2 px-2">Página</th>
                          <th className="text-right py-2 px-2">Visitantes</th>
                          <th className="text-right py-2 px-2">Sem vídeo</th>
                          <th className="text-right py-2 px-2">Iniciaram</th>
                          <th className="text-right py-2 px-2">50%</th>
                          <th className="text-right py-2 px-2">100%</th>
                          <th className="text-right py-2 px-2">Cliques</th>
                          <th className="text-right py-2 px-2">Último</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analytics.byPage || []).map((p) => (
                          <tr key={p.page} className="border-b border-zinc-800/60">
                            <td className="py-2 px-2 font-mono text-xs">{p.page}</td>
                            <td className="text-right py-2 px-2">{p.visitors}</td>
                            <td className="text-right py-2 px-2 text-red-400">{p.no_video}</td>
                            <td className="text-right py-2 px-2">{p.starters}</td>
                            <td className="text-right py-2 px-2 text-amber-400">{p.p50}</td>
                            <td className="text-right py-2 px-2 text-green-400">{p.p100}</td>
                            <td className="text-right py-2 px-2">{p.clicks}</td>
                            <td className="text-right py-2 px-2 text-xs text-zinc-400">{new Date(p.last).toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                        {(analytics.byPage || []).length === 0 && (
                          <tr><td colSpan={8} className="text-center text-zinc-500 py-4">Sem dados.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                  <h3 className="text-lg font-semibold mb-4">Progresso do vídeo (visitantes únicos)</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Iniciaram", value: analytics.summary.uniqueStarters, color: "bg-blue-500" },
                      { label: "25%", value: analytics.summary.milestone25, color: "bg-amber-400" },
                      { label: "50%", value: analytics.summary.milestone50, color: "bg-amber-500" },
                      { label: "75%", value: analytics.summary.milestone75, color: "bg-orange-500" },
                      { label: "100%", value: analytics.summary.milestone100, color: "bg-green-500" },
                    ].map((r) => {
                      const total = Math.max(analytics.summary.uniqueVisitors, 1);
                      const pct = Math.min(100, Math.round((r.value / total) * 100));
                      return (
                        <div key={r.label}>
                          <div className="flex justify-between text-xs text-zinc-400 mb-1">
                            <span className="font-medium">{r.label}</span>
                            <span>{r.value} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                            <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-sm text-zinc-400">
                    Média de progresso dos que iniciaram: <span className="font-bold text-amber-300">{analytics.summary.avgProgress}%</span>
                  </p>
                  {analytics.summary.lastAccess && (
                    <p className="mt-1 text-xs text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Último evento: {new Date(analytics.summary.lastAccess).toLocaleString("pt-BR")}
                    </p>
                  )}
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                  <h3 className="text-lg font-semibold mb-4">Por dia</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="text-left py-2 px-2">Dia</th>
                          <th className="text-right py-2 px-2">Visitantes</th>
                          <th className="text-right py-2 px-2">Iniciaram</th>
                          <th className="text-right py-2 px-2">Concluíram</th>
                          <th className="text-right py-2 px-2">Cliques</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.daily.slice().reverse().map((d) => (
                          <tr key={d.day} className="border-b border-zinc-800/60">
                            <td className="py-2 px-2 font-mono text-xs">{d.day}</td>
                            <td className="text-right py-2 px-2">{d.visitors}</td>
                            <td className="text-right py-2 px-2">{d.starts}</td>
                            <td className="text-right py-2 px-2 text-green-400">{d.completes}</td>
                            <td className="text-right py-2 px-2 text-amber-400 font-semibold">{d.clicks}</td>
                          </tr>
                        ))}
                        {analytics.daily.length === 0 && (
                          <tr><td colSpan={5} className="text-center text-zinc-500 py-4">Sem dados no período.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                  <h3 className="text-lg font-semibold mb-4">Ranking — visitantes que assistiram mais</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="text-left py-2 px-2">#</th>
                          <th className="text-left py-2 px-2">Visitante</th>
                          <th className="text-right py-2 px-2">Assistido</th>
                          <th className="text-right py-2 px-2">CTA</th>
                          <th className="text-right py-2 px-2">Último acesso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.ranking.slice(0, 30).map((r, i) => (
                          <tr key={r.visitor_id} className="border-b border-zinc-800/60">
                            <td className="py-2 px-2 text-zinc-500">{i + 1}</td>
                            <td className="py-2 px-2 font-mono text-xs text-zinc-300">{r.visitor_id.slice(0, 12)}…<div className="text-[10px] text-zinc-500">{r.page}{r.started ? "" : " · não viu o vídeo"}</div></td>
                            <td className="text-right py-2 px-2">
                              <span className={r.max_progress >= 100 ? "text-green-400 font-bold" : r.max_progress >= 75 ? "text-amber-400" : "text-zinc-300"}>
                                {r.max_progress}%
                              </span>
                            </td>
                            <td className="text-right py-2 px-2">{r.clicked ? "✅" : "—"}</td>
                            <td className="text-right py-2 px-2 text-xs text-zinc-400">{new Date(r.last).toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                        {analytics.ranking.length === 0 && (
                          <tr><td colSpan={5} className="text-center text-zinc-500 py-4">Sem dados ainda.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card className="p-6 bg-zinc-900 border-zinc-800">
                  <h3 className="text-lg font-semibold mb-4">Origens (referrer)</h3>
                  {analytics.referrers.length === 0 ? (
                    <p className="text-sm text-zinc-500">Sem referrers no período.</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics.referrers.map((r) => (
                        <div key={r.host} className="flex justify-between text-sm">
                          <span className="text-zinc-300">{r.host}</span>
                          <span className="font-bold text-amber-300">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            ) : (
              <Card className="p-8 bg-zinc-900 border-zinc-800 text-center text-zinc-400">
                {loadingAnalytics ? "Carregando…" : "Sem dados"}
              </Card>
            )}
          </TabsContent>

          <TabsContent value="videos" className="space-y-6 mt-6">
            <Card className="p-6 bg-zinc-900 border-zinc-800 space-y-4">
              <h2 className="text-xl font-semibold">Vídeo atual</h2>
              <div className="space-y-3">
                <Input placeholder="Título (opcional)" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} />
                <Input placeholder="Video URL (direto .mp4)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                <Input placeholder="HLS URL (.m3u8)" value={hlsUrl} onChange={(e) => setHlsUrl(e.target.value)} />
                <Button onClick={() => save()} className="w-full"><Save className="w-4 h-4 mr-2" /> Salvar vídeo</Button>
              </div>
            </Card>

            <Card className="p-6 bg-zinc-900 border-zinc-800 space-y-4">
              <h2 className="text-xl font-semibold">Controles do player</h2>
              <p className="text-xs text-zinc-400">Vale para /ferramentamropromo e para todas as páginas de afiliados /promo/nome. Clique em Salvar vídeo para aplicar.</p>
              {([
                ["allow_seek", "Permitir avançar o vídeo (arrastar para frente)"],
                ["show_progress", "Mostrar barra de progresso / cursor do vídeo"],
                ["force_max_volume", "Volume sempre no máximo (só botão de mudo)"],
                ["minimal_controls", "Controles mínimos: só play/pause, recomeçar e mudo"],
                ["show_fullscreen", "Mostrar botão de tela cheia"],
              ] as [keyof PromoPlayerSettings, string][]).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span>{label}</span>
                  <Switch checked={player[k]} onCheckedChange={(c) => setPlayer((p) => ({ ...p, [k]: c }))} />
                </label>
              ))}
              <Button onClick={() => save()} className="w-full"><Save className="w-4 h-4 mr-2" /> Salvar controles</Button>
            </Card>

            <Card className="p-6 bg-zinc-900 border-zinc-800 space-y-4">
              <h2 className="text-xl font-semibold">Upload novo vídeo</h2>
              <p className="text-xs text-zinc-400">Aceita arquivos grandes (500MB+). O servidor transcodifica em várias qualidades (HLS) para internet lenta, como na /live. O vídeo fica ativo assim que o envio terminar.</p>
              <input ref={fileRef} type="file" accept="video/*" onChange={handleUpload} disabled={uploading}
                className="block w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-amber-500 file:text-black file:font-semibold hover:file:bg-amber-400" />
              {uploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-zinc-400">Enviando… {uploadProgress}%</p>
                </div>
              )}
              {transcoding && (
                <div className="space-y-2">
                  <Progress value={transcoding.progress} />
                  <p className="text-sm text-zinc-400">Transcodificando ({transcoding.status})… {transcoding.progress}%</p>
                </div>
              )}
            </Card>

            <Card className="p-6 bg-zinc-900 border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Vídeos no servidor</h2>
                <Button variant="outline" size="sm" onClick={loadServerVideos} disabled={loadingVideos}>
                  {loadingVideos ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
                </Button>
              </div>
              <div className="space-y-2">
                {serverVideos.length === 0 && <p className="text-sm text-zinc-500">Nenhum vídeo.</p>}
                {serverVideos.map((v) => (
                  <div key={v.name} className="flex items-center justify-between gap-2 p-3 rounded bg-zinc-800/60">
                    <div className="flex items-center gap-3 min-w-0">
                      <Video className="w-5 h-5 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{v.name}</p>
                        <p className="text-xs text-zinc-400">{v.status || (v.ready ? "pronto" : "processando")}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => selectExisting(v)}>Usar</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteVideo(v.name)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4 bg-zinc-900 border-zinc-800">
      <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">{icon}<span>{label}</span></div>
      <div className="text-2xl md:text-3xl font-black text-white">{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-1">{sub}</div>}
    </Card>
  );
}
