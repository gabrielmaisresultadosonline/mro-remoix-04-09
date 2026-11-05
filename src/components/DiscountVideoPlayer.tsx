import { useEffect, useRef, useState, memo } from "react";
import Hls from "hls.js";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";

const VIDEO_SERVER = "https://video.maisresultadosonline.com.br";

interface Props {
  email: string;
  nome?: string;
  /** Página com vídeo próprio configurado no admin (ex.: "renddx"); sem vídeo próprio usa o padrão. */
  configPage?: "renddx";
}

/**
 * Reproduz o vídeo hospedado no servidor (mesmo da /renda-extrass)
 * e dispara tracking de acesso + milestones 25/50/75/100% para o backend.
 */
const DiscountVideoPlayer = ({ email, nome, configPage }: Props) => {
  const [cfg, setCfg] = useState<{ video_url: string | null; hls_url: string | null; video_title: string | null }>({
    video_url: null,
    hls_url: null,
    video_title: null,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const milestonesRef = useRef<{ p25: boolean; p50: boolean; p75: boolean; p100: boolean }>({
    p25: false,
    p50: false,
    p75: false,
    p100: false,
  });
  const accessSentRef = useRef(false);

  // Carrega config do vídeo
  useEffect(() => {
    const loadDefault = () =>
      supabase.functions
        .invoke("estrutura4-discount", { body: { action: "get_video" } })
        .then(({ data }) => {
          if (data) setCfg(data);
        })
        .catch(() => {});
    if (!configPage) {
      loadDefault();
      return;
    }
    supabase.functions
      .invoke("euro-page-admin", { body: { action: "get_video", page: configPage } })
      .then(({ data }) => {
        if (data?.hls_url || data?.video_url) setCfg(data);
        else loadDefault();
      })
      .catch(() => loadDefault());
  }, [configPage]);

  // Registra acesso assim que o componente monta (uma vez)
  useEffect(() => {
    if (!email || accessSentRef.current) return;
    accessSentRef.current = true;
    supabase.functions
      .invoke("estrutura4-discount", {
        body: { action: "track_video_access", email, nome: nome || "" },
      })
      .catch(() => {});
  }, [email, nome]);

  // Liga HLS / src
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const { video_url, hls_url } = cfg;
    if (!video_url && !hls_url) return;
    const isRel = (u: string) => u.startsWith("/");
    const hlsCandidate = hls_url || (video_url?.includes(".m3u8") ? video_url : null);
    const directCandidate = video_url && !video_url.includes(".m3u8") ? video_url : null;
    const fullVideo = directCandidate ? (isRel(directCandidate) ? `${VIDEO_SERVER}${directCandidate}` : directCandidate) : null;
    const fullHls = hlsCandidate ? (isRel(hlsCandidate) ? `${VIDEO_SERVER}${hlsCandidate}` : hlsCandidate) : null;
    const loadDirect = () => {
      if (fullVideo) video.src = fullVideo;
    };
    if (fullHls && Hls.isSupported()) {
      (async () => {
        try {
          const res = await fetch(fullHls, { method: "HEAD" });
          if (!res.ok) return loadDirect();
          const hls = new Hls({ startLevel: 0, capLevelToPlayerSize: true, enableWorker: true });
          hls.loadSource(fullHls);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_, d) => {
            if (d.fatal) {
              hls.destroy();
              loadDirect();
            }
          });
          hlsRef.current = hls;
        } catch {
          loadDirect();
        }
      })();
    } else if (fullHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = fullHls;
    } else {
      loadDirect();
    }
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [cfg]);

  // Listeners + milestone tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reportMilestone = (m: "25" | "50" | "75" | "100") => {
      supabase.functions
        .invoke("estrutura4-discount", {
          body: { action: "track_video_milestone", email, nome: nome || "", milestone: m },
        })
        .catch(() => {});
    };
    const onTime = () => {
      const d = video.duration || 0;
      if (d <= 0) return;
      const pct = (video.currentTime / d) * 100;
      const mr = milestonesRef.current;
      if (pct >= 25 && !mr.p25) {
        mr.p25 = true;
        reportMilestone("25");
      }
      if (pct >= 50 && !mr.p50) {
        mr.p50 = true;
        reportMilestone("50");
      }
      if (pct >= 75 && !mr.p75) {
        mr.p75 = true;
        reportMilestone("75");
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      if (!milestonesRef.current.p100) {
        milestonesRef.current.p100 = true;
        reportMilestone("100");
      }
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
    };
  }, [email, nome]);

  const handleStart = () => {
    const v = videoRef.current;
    if (!v) return;
    setStarted(true);
    v.play().catch(() => {});
  };
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const toggleFullscreen = async () => {
    const el = containerRef.current;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (el?.requestFullscreen) await el.requestFullscreen();
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-xl sm:rounded-2xl overflow-hidden border border-green-500/30 shadow-2xl">
      <video ref={videoRef} className="w-full h-full object-contain" playsInline preload="metadata" />
      {!started && (
        <button
          type="button"
          onClick={handleStart}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 hover:bg-black/60 transition"
        >
          <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-2xl">
            <Play className="w-10 h-10 text-white fill-white" />
          </div>
          <span className="text-white text-lg font-bold">{cfg.video_title || "Assistir agora"}</span>
        </button>
      )}
      {started && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center gap-3">
          <button onClick={togglePlay} className="text-white">{playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
          <button onClick={toggleMute} className="text-white">{muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
          <div className="flex-1" />
          <button onClick={toggleFullscreen} className="text-white"><Maximize className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
};

export default memo(DiscountVideoPlayer);