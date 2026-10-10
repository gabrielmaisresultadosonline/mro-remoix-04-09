import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const VIDEO_SERVER = "https://video.maisresultadosonline.com.br";
const isRel = (u: string) => u.startsWith("/");

/** Opções do player, configuradas em /ferramentamropromo/video. */
export interface PromoPlayerSettings {
  allow_seek: boolean;
  show_progress: boolean;
  force_max_volume: boolean;
  minimal_controls: boolean;
  show_fullscreen: boolean;
}

export const DEFAULT_PLAYER_SETTINGS: PromoPlayerSettings = {
  allow_seek: true,
  show_progress: true,
  force_max_volume: false,
  minimal_controls: false,
  show_fullscreen: true,
};

function getVisitorId(): string {
  try {
    let id = localStorage.getItem("fmp:visitor_id");
    if (!id) {
      id = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now()).toString();
      localStorage.setItem("fmp:visitor_id", id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

export function trackPromoVideo(event_type: string, extra?: Record<string, unknown>) {
  supabase.functions
    .invoke("ferramentamropromo-video", {
      body: {
        action: "track",
        visitor_id: getVisitorId(),
        event_type,
        user_agent: navigator.userAgent,
        referrer: document.referrer,
        path: window.location.pathname,
        ...(extra || {}),
      },
    })
    .catch(() => {});
}

export interface PromoHlsVideoProps {
  /** Registra page_view ao montar (desligue se a página já registra). */
  trackPageView?: boolean;
  onWatched?: () => void;
  /** Exibido se nenhum vídeo estiver configurado. */
  fallback?: React.ReactNode;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/** Player HLS adaptativo (várias qualidades) compartilhado por /ferramentamropromo e /promo/:afiliado. */
export function PromoHlsVideo({ trackPageView = true, onWatched, fallback }: PromoHlsVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const maxTimeRef = useRef(0);
  const milestones = useRef<Set<number>>(new Set());
  const [cfg, setCfg] = useState<{ video_url: string | null; hls_url: string | null } | null>(null);
  const [ps, setPs] = useState<PromoPlayerSettings>(DEFAULT_PLAYER_SETTINGS);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    if (trackPageView) trackPromoVideo("page_view");
    supabase.functions
      .invoke("ferramentamropromo-video", { body: { action: "get_video" } })
      .then(({ data }) => {
        setCfg({ video_url: data?.video_url ?? null, hls_url: data?.hls_url ?? null });
        setPs({ ...DEFAULT_PLAYER_SETTINGS, ...(data?.player_settings || {}) });
      })
      .catch(() => setCfg({ video_url: null, hls_url: null }));
  }, [trackPageView]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !cfg) return;
    const { video_url, hls_url } = cfg;
    const hlsC = hls_url || (video_url?.includes(".m3u8") ? video_url : null);
    const direct = video_url && !video_url.includes(".m3u8") ? video_url : null;
    const full = (u: string | null) => (u ? (isRel(u) ? `${VIDEO_SERVER}${u}` : u) : null);
    const fullHls = full(hlsC);
    const fullVideo = full(direct);
    const loadDirect = () => { if (fullVideo) video.src = fullVideo; };

    if (fullHls && Hls.isSupported()) {
      // Começa na menor qualidade e sobe conforme a internet permite: não trava em conexão lenta.
      const hls = new Hls({ startLevel: 0, capLevelToPlayerSize: true, enableWorker: true, maxBufferLength: 30 });
      hls.loadSource(fullHls);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { hls.destroy(); hlsRef.current = null; loadDirect(); } });
      hlsRef.current = hls;
    } else if (fullHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = fullHls;
    } else loadDirect();
    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [cfg]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onTime = () => {
      setTime(v.currentTime);
      if (v.currentTime > maxTimeRef.current && !v.seeking) maxTimeRef.current = v.currentTime;
      const d = v.duration || 0;
      if (d <= 0 || !started) return;
      const pct = (v.currentTime / d) * 100;
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !milestones.current.has(m)) {
          milestones.current.add(m);
          trackPromoVideo("video_progress", { progress_pct: m });
          if (m === 50) onWatched?.();
        }
      }
    };
    const onSeeking = () => {
      if (!ps.allow_seek && v.currentTime > maxTimeRef.current + 1) v.currentTime = maxTimeRef.current;
    };
    const onEnded = () => {
      if (!milestones.current.has(100)) { milestones.current.add(100); trackPromoVideo("video_progress", { progress_pct: 100 }); }
      onWatched?.();
    };
    const onVol = () => {
      if (ps.force_max_volume && v.volume < 1) v.volume = 1;
      setMuted(v.muted);
    };
    const onMeta = () => setDur(v.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("ended", onEnded);
    v.addEventListener("volumechange", onVol);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("volumechange", onVol);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [ps, started, onWatched]);

  if (cfg && !cfg.video_url && !cfg.hls_url && fallback) return <>{fallback}</>;

  const start = () => {
    const v = ref.current; if (!v) return;
    setStarted(true);
    trackPromoVideo("video_start");
    v.volume = 1; v.muted = false;
    v.play().catch(() => { v.muted = true; setMuted(true); v.play().catch(() => {}); });
  };
  const togglePlay = () => { const v = ref.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const toggleMute = () => { const v = ref.current; if (!v) return; v.muted = !v.muted; if (ps.force_max_volume) v.volume = 1; };
  const restart = () => { const v = ref.current; if (!v) return; v.currentTime = 0; v.play().catch(() => {}); };
  const fullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (v.requestFullscreen) v.requestFullscreen().catch(() => {});
    else v.webkitEnterFullscreen?.();
  };
  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = ref.current; if (!v) return;
    let t = Number(e.target.value);
    if (!ps.allow_seek) t = Math.min(t, maxTimeRef.current);
    v.currentTime = t;
  };
  const btn = "w-10 h-10 rounded-full bg-background/70 hover:bg-background flex items-center justify-center text-foreground";
  const showBar = ps.show_progress && !ps.minimal_controls;

  return (
    <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-background ring-1 ring-ring/30 shadow-lg">
      <div className="relative aspect-video">
        <video
          ref={ref}
          className="w-full h-full bg-background"
          playsInline
          preload="metadata"
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          onContextMenu={(e) => e.preventDefault()}
          onClick={started ? togglePlay : undefined}
        />
        {!started && (
          <button onClick={start} className="absolute inset-0 flex items-center justify-center bg-background/40" aria-label="Reproduzir">
            <span className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl animate-pulse">
              <Play className="w-10 h-10 text-primary-foreground ml-1" fill="currentColor" />
            </span>
          </button>
        )}
        {started && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background/80 to-transparent space-y-2">
            {showBar && (
              <div className="flex items-center gap-2 text-xs text-foreground">
                <span>{fmt(time)}</span>
                <input
                  type="range" min={0} max={dur || 0} step={0.1} value={time}
                  onChange={seek} disabled={!ps.allow_seek}
                  className="flex-1 accent-primary" aria-label="Progresso do vídeo"
                />
                <span>{fmt(dur)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className={btn} aria-label={playing ? "Pausar" : "Reproduzir"}>
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={restart} className={btn} aria-label="Recomeçar"><RotateCcw className="w-5 h-5" /></button>
              <button onClick={toggleMute} className={btn} aria-label={muted ? "Ativar som" : "Silenciar"}>
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              {!ps.force_max_volume && !ps.minimal_controls && (
                <input
                  type="range" min={0} max={1} step={0.05} defaultValue={1}
                  onChange={(e) => { if (ref.current) ref.current.volume = Number(e.target.value); }}
                  className="w-20 accent-primary" aria-label="Volume"
                />
              )}
              {ps.show_fullscreen && !ps.minimal_controls && (
                <button onClick={fullscreen} className={`${btn} ml-auto`} aria-label="Tela cheia"><Maximize className="w-5 h-5" /></button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
