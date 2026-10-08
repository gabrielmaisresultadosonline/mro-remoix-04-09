import { MroIntelligentIntro } from '@/components/sales/MroIntelligentIntro';
import { MroIntelligentFeatures } from '@/components/sales/MroIntelligentFeatures';
import { useState, useEffect, useRef } from "react";
import Hls from "hls.js";

const VIDEO_SERVER = "https://video.maisresultadosonline.com.br";
const isRel = (u: string) => u.startsWith("/");
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView } from "@/lib/facebookTracking";
import { toast } from "sonner";
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  Clock,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Heart,
  Eye,
  UserPlus,
  Bot,
  MessageCircle,
  Video,
  Users,
  Zap,
  X,
  ChevronDown,
  Star,
  Target,
  
  RefreshCw,
  Gift,
  Monitor,
  Laptop,
  Mail,
  User,
  CreditCard,
  Loader2,
  Phone,
  Timer,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  FileText,
  Rocket,
  Crown,
  Flame,
  MousePointerClick
} from "lucide-react";
import logoMro from "@/assets/logo-mro.png";
import ActiveClientsSection from "@/components/ActiveClientsSection";

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

function track(event_type: string, extra?: Record<string, unknown>) {
  try {
    supabase.functions.invoke("ferramentamropromo-video", {
      body: {
        action: "track",
        visitor_id: getVisitorId(),
        event_type,
        user_agent: navigator.userAgent,
        referrer: document.referrer,
        path: window.location.pathname,
        ...(extra || {}),
      },
    }).catch(() => {});
  } catch {}
}

const Ferramentammmr = () => {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [isMainVideoPlaying, setIsMainVideoPlaying] = useState(false);

  // HLS video (mesmo da /ferramentamropromo2)
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [videoCfg, setVideoCfg] = useState<{ video_url: string | null; hls_url: string | null }>({ video_url: null, hls_url: null });
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const milestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    track("page_view");
    supabase.functions
      .invoke("ferramentamropromo-video", { body: { action: "get_video" } })
      .then(({ data }) => {
        if (data) {
          setVideoCfg({
            video_url: data.settings?.video_url ?? data.video_url ?? null,
            hls_url: data.settings?.hls_url ?? data.hls_url ?? null,
          });
        }
      })
      .catch(() => {});

    if (localStorage.getItem("ferramentamropromo:unlocked") === "1") {
      setVideoWatched(true);
    }
  }, []);

  useEffect(() => {
    const video = mainVideoRef.current;
    if (!video) return;
    const { video_url, hls_url } = videoCfg;
    if (!video_url && !hls_url) return;

    const hlsCandidate = hls_url || (video_url?.includes(".m3u8") ? video_url : null);
    const directCandidate = video_url && !video_url.includes(".m3u8") ? video_url : null;
    const fullVideo = directCandidate ? (isRel(directCandidate) ? `${VIDEO_SERVER}${directCandidate}` : directCandidate) : null;
    const fullHls = hlsCandidate ? (isRel(hlsCandidate) ? `${VIDEO_SERVER}${hlsCandidate}` : hlsCandidate) : null;

    const tryBgAutoplay = () => {
      if (videoStarted) return;
      try {
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {}
    };

    const loadDirect = () => {
      if (fullVideo) {
        video.src = fullVideo;
        video.addEventListener("loadedmetadata", tryBgAutoplay, { once: true });
      }
    };

    if (fullHls && Hls.isSupported()) {
      (async () => {
        try {
          const res = await fetch(fullHls, { method: "HEAD" });
          if (!res.ok) return loadDirect();
          const hls = new Hls({ startLevel: 0, capLevelToPlayerSize: true, enableWorker: true });
          hls.loadSource(fullHls);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, tryBgAutoplay);
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { hls.destroy(); loadDirect(); } });
          hlsRef.current = hls;
        } catch { loadDirect(); }
      })();
    } else if (fullHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = fullHls;
      video.addEventListener("loadedmetadata", tryBgAutoplay, { once: true });
    } else {
      loadDirect();
    }
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [videoCfg]);

  useEffect(() => {
    const video = mainVideoRef.current;
    if (!video) return;
    const onTime = () => {
      const d = video.duration || 0;
      if (d <= 0) return;
      const pct = (video.currentTime / d) * 100;
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !milestonesRef.current.has(m)) {
          milestonesRef.current.add(m);
          track("video_progress", { progress_pct: m });
        }
      }
      if (pct >= 50 && !videoWatched) {
        setVideoWatched(true);
        localStorage.setItem("ferramentamropromo:unlocked", "1");
      }
    };
    const onEnded = () => {
      if (!milestonesRef.current.has(100)) {
        milestonesRef.current.add(100);
        track("video_progress", { progress_pct: 100 });
      }
      setVideoWatched(true);
      localStorage.setItem("ferramentamropromo:unlocked", "1");
    };
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);
    const onVol = () => setVideoMuted(video.muted);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVol);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVol);
    };
  }, [videoWatched]);

  const handleMainVideoStart = () => {
    const v = mainVideoRef.current;
    if (!v) return;
    setVideoStarted(true);
    track("video_start");
    try {
      v.loop = false;
      v.currentTime = 0;
    } catch {}
    v.muted = false;
    setVideoMuted(false);
    v.play().catch(() => {
      v.muted = true;
      setVideoMuted(true);
      v.play().catch(() => {});
    });
  };

  const toggleMainPlay = () => {
    const v = mainVideoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  const toggleMainMute = () => {
    const v = mainVideoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setVideoMuted(v.muted);
  };

  const toggleMainFullscreen = () => {
    const v = mainVideoRef.current;
    if (!v) return;
    const anyDoc = document as any;
    const anyV = v as any;
    if (anyDoc.fullscreenElement || anyDoc.webkitFullscreenElement) {
      (anyDoc.exitFullscreen || anyDoc.webkitExitFullscreen)?.call(document);
    } else {
      (anyV.requestFullscreen || anyV.webkitEnterFullscreen || anyV.webkitRequestFullscreen)?.call(v);
    }
  };
  
  // Popup de desconto encerrado - desativado nesta página
  const [showDiscountEndedPopup, setShowDiscountEndedPopup] = useState(false);
  
  // Countdown para promoção - 8 horas a partir do primeiro acesso
  const [promoTimeLeft, setPromoTimeLeft] = useState({ hours: 8, minutes: 0, seconds: 0, expired: false });
  const pricingRef = useRef<HTMLDivElement>(null);
  
  // Modal de cadastro
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ type: 'annual' | 'lifetime'; amount: number; label: string; installments: string; oneTime: string }>({
    type: 'annual',
    amount: 397,
    label: 'Anual Pro',
    installments: '12x de R$ 40,00',
    oneTime: 'R$ 397,00 à vista'
  });
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validar username: apenas letras minúsculas, sem espaços, sem números
  const validateUsername = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
    setUsername(cleaned);
    
    if (value !== cleaned) {
      setUsernameError("Apenas letras minúsculas, sem espaços ou números");
    } else if (cleaned.length < 4) {
      setUsernameError("Mínimo de 4 caracteres");
    } else if (cleaned.length > 20) {
      setUsernameError("Máximo de 20 caracteres");
    } else {
      setUsernameError("");
    }
  };

  // Criar checkout e abrir pagamento
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast.error("Por favor, insira um email válido");
      return;
    }

    if (!phone || phone.replace(/\D/g, "").length < 10) {
      toast.error("Por favor, insira um celular válido com DDD");
      return;
    }

    if (!username || username.length < 4) {
      toast.error("Nome de usuário deve ter no mínimo 4 caracteres");
      return;
    }

    if (usernameError) {
      toast.error(usernameError);
      return;
    }

    setLoading(true);

    try {
      // Preço promocional: R$300
      const { data: checkData, error: checkError } = await supabase.functions.invoke("create-mro-checkout", {
        body: { 
          email: email.toLowerCase().trim(),
          username: username.toLowerCase().trim(),
          phone: phone.replace(/\D/g, "").trim(),
          planType: selectedPlan.type,
          amount: selectedPlan.amount,
          checkUserExists: true
        }
      });

      if (checkError) {
        console.error("Error creating checkout:", checkError);
        toast.error("Erro ao criar link de pagamento. Tente novamente.");
        return;
      }

      if (checkData.userExists) {
        toast.error("Este nome de usuário já está em uso. Escolha outro.");
        setUsernameError("Usuário já existe, escolha outro");
        return;
      }

      if (!checkData.success) {
        toast.error(checkData.error || "Erro ao criar pagamento");
        return;
      }

      // Redirecionar diretamente para o checkout (funciona melhor no mobile)
      // Usar location.href ao invés de window.open para evitar bloqueio de popup
      window.location.href = checkData.payment_link;
      
      // Resetar form
      setEmail("");
      setUsername("");
      setPhone("");

    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Track PageView on mount
  useEffect(() => {
    trackPageView('Sales Page - Instagram MRO Promo 2');
  }, []);

  // Countdown de 7 horas - SEMPRE reinicia quando entra na página (NUNCA expira)
  useEffect(() => {
    // Definir tempo de promoção como 7 horas a partir de AGORA (a cada visita)
    const PROMO_DURATION = 7 * 60 * 60 * 1000; // 7 horas em milissegundos
    const promoEndTime = Date.now() + PROMO_DURATION;
    
    const updateCountdown = () => {
      const currentTime = Date.now();
      const diff = promoEndTime - currentTime;
      
      // Nunca expira - se chegar a 0, mostra 0:0:0 mas não marca como expirado
      if (diff <= 0) {
        setPromoTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: false });
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setPromoTimeLeft({ hours, minutes, seconds, expired: false });
    };
    
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const openVideo = (url: string) => {
    setCurrentVideoUrl(url);
    setShowVideoModal(true);
  };


  const planFeatures = [
    "Ferramenta completa para Instagram",
    "Acesso a 4 contas simultâneas fixas",
    "5 testes todo mês para testar em seus clientes/outras contas",
    "Área de membros por 1 ano",
    "Vídeos estratégicos passo a passo",
    "Grupo VIP no WhatsApp",
    "Suporte prioritário"
  ];

  return (
    <div className="mro-intelligent-sales min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Popup Desconto Encerrado - REMOVED TO PREVENT BLACK SCREEN ISSUES */}
      {/* 
      {showDiscountEndedPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-b from-card to-background border-2 border-border rounded-2xl p-6 sm:p-8 max-w-md w-full text-center relative animate-in zoom-in-95 duration-300">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="bg-primary text-foreground font-bold px-4 py-1.5 rounded-full text-sm">
                ⚠️ AVISO
              </div>
            </div>
            
            <div className="mt-4 mb-6">
              <AlertTriangle className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                Desconto Encerrado!
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
                Aguarde um próximo desconto ou siga para página oficial para adquirir o plano hoje
              </p>
            </div>
            
            <Button 
              onClick={() => window.location.href = '/instagram-nova'}
              className="w-full bg-gradient-to-r from-card to-background hover:from-card hover:to-background text-foreground font-bold text-lg py-5 rounded-xl shadow-lg shadow-primary/30"
            >
              Acessar Página <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            
            <button 
              onClick={() => setShowDiscountEndedPopup(false)}
              className="mt-4 text-muted-foreground hover:text-foreground text-sm underline"
            >
              Continuar na página mesmo assim
            </button>
          </div>
        </div>
      )}
      */}

      {/* Header removido conforme solicitação */}

      {/* Hero Section */}
      <section className="relative pt-8 sm:pt-12 md:pt-16 pb-10 sm:pb-16 px-3 sm:px-4">
        <div className="max-w-5xl mx-auto text-center">

          
          <MroIntelligentIntro />

          {/* Main Video */}
          <div className="mt-8 sm:mt-10 max-w-4xl mx-auto">
            <div className="relative rounded-xl sm:rounded-2xl overflow-hidden bg-background ring-1 ring-ring/30 shadow-lg">
              <div className="relative aspect-video">
                <video
                  ref={mainVideoRef}
                  className={`w-full h-full bg-background transition-opacity duration-500 ${videoStarted ? "opacity-100" : "opacity-10"}`}
                  playsInline
                  controls={false}
                  muted={!videoStarted}
                  autoPlay
                  loop={!videoStarted}
                  preload="metadata"
                />
                {!videoStarted && (
                  <button
                    onClick={handleMainVideoStart}
                    className="absolute inset-0 flex items-center justify-center bg-background/40 hover:bg-background/30 transition"
                    aria-label="Reproduzir"
                  >
                    <span className="w-20 h-20 rounded-full bg-primary hover:bg-primary flex items-center justify-center shadow-2xl animate-pulse">
                      <Play className="w-10 h-10 text-primary-foreground ml-1" fill="currentColor" />
                    </span>
                  </button>
                )}
                {videoStarted && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                    <button
                      onClick={toggleMainPlay}
                      className="w-10 h-10 rounded-full bg-background/70 hover:bg-background flex items-center justify-center"
                      aria-label={videoPlaying ? "Pausar" : "Reproduzir"}
                    >
                      {videoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={toggleMainMute}
                      className="w-10 h-10 rounded-full bg-background/70 hover:bg-background flex items-center justify-center"
                      aria-label={videoMuted ? "Ativar som" : "Silenciar"}
                    >
                      {videoMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={toggleMainFullscreen}
                      className="ml-auto w-10 h-10 rounded-full bg-background/70 hover:bg-background flex items-center justify-center"
                      aria-label="Tela cheia"
                    >
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Button 
            onClick={scrollToPricing}
            className="mt-8 sm:mt-10 bg-gradient-to-r from-card to-background hover:from-card hover:to-background text-foreground font-bold text-sm sm:text-lg px-6 sm:px-10 py-5 sm:py-6 rounded-full shadow-lg shadow-primary/30"
          >
            GARANTIR MEU ACESSO AGORA <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </section>



      <MroIntelligentFeatures />

      {/* Guarantee Section */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-gradient-to-b from-card to-background">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-card/80 to-background border-2 border-border/50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-14 text-center shadow-2xl shadow-primary/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-card/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-center mb-6">
              
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/20 border-2 border-border/40 flex items-center justify-center">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
              </div>
            </div>
            <span className="text-primary font-bold text-[10px] sm:text-xs tracking-[0.3em] uppercase">GARANTIA TOTAL</span>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-black mt-3 mb-4 sm:mb-6 leading-tight">
              30 Dias de Resultados <span className="text-primary">Garantidos</span>
            </h2>
            <div className="bg-primary/10 border border-border/30 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-4 sm:py-5 max-w-2xl mx-auto mb-6 sm:mb-8">
              <p className="text-foreground text-base sm:text-lg md:text-xl leading-relaxed">
                Se em <strong className="text-primary">30 dias</strong> não tiver os resultados prometidos, <strong className="text-foreground">devolvemos o seu dinheiro.</strong>
              </p>
              <p className="text-primary font-bold text-sm sm:text-lg mt-2">Nós garantimos resultados. Sem risco para você.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto mb-6 sm:mb-8">
              {[
                { emoji: "🔒", label: "Compra 100% Segura" },
                { emoji: "💰", label: "Reembolso Garantido" },
                { emoji: "✅", label: "Satisfação ou Dinheiro de Volta" }
              ].map((item, i) => (
                <div key={i} className="bg-primary/10 border border-border/20 rounded-xl px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 justify-center">
                  <span className="text-lg sm:text-xl">{item.emoji}</span>
                  <span className="text-primary text-xs sm:text-sm font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm">Garantia válida por 30 dias após a data da compra.</p>
          </div>
        </div>
      </section>

      {/* O que está incluso */}
      <section ref={pricingRef} className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-card to-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center mb-3 sm:mb-4">
            ESCOLHA SEU <span className="text-primary">PLANO</span>
          </h2>
          <p className="text-center text-muted-foreground mb-8 sm:mb-10 text-base sm:text-lg">
            Selecione o plano ideal para você
          </p>

          <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
            {/* Plano Anual Pro */}
            <div className="bg-gradient-to-b from-card to-background border-2 border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-8 relative overflow-hidden flex flex-col">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-card to-background text-foreground font-bold px-4 sm:px-6 py-1.5 sm:py-2 rounded-b-xl text-xs sm:text-sm whitespace-nowrap">
                  MAIS POPULAR
                </div>
              </div>

              <div className="text-center mt-6 mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">Anual Pro</h3>
                <div className="text-base sm:text-lg text-muted-foreground mb-2">por apenas</div>
                <div className="text-primary mb-1">
                  <span className="text-lg sm:text-xl md:text-2xl font-medium">12x de</span>
                  <span className="text-5xl sm:text-6xl md:text-7xl font-black ml-2">R$40</span>
                </div>
                <p className="text-muted-foreground text-lg sm:text-xl mb-1">
                  ou <span className="text-foreground font-bold">R$ 397,00 à vista</span>
                </p>
                <p className="text-muted-foreground text-xs sm:text-sm">Acesso por 1 ano</p>
              </div>

              <div className="space-y-3 mb-6 sm:mb-8 flex-1">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm sm:text-base">4 contas do Instagram</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm sm:text-base">Ferramenta MRO completa</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm sm:text-base">Suporte VIP</span>
                </div>
              </div>

              <Button
                onClick={() => {
                  setSelectedPlan({
                    type: 'annual',
                    amount: 397,
                    label: 'Anual Pro',
                    installments: '12x de R$ 40,00',
                    oneTime: 'R$ 397,00 à vista'
                  });
                  setShowCheckoutModal(true);
                }}
                className="w-full bg-gradient-to-r from-card to-background hover:from-card hover:to-background text-foreground font-bold text-base sm:text-xl py-5 sm:py-7 rounded-xl shadow-lg shadow-primary/30"
              >
                QUERO O PLANO ANUAL
              </Button>

              <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1"><Shield className="w-3 h-3 sm:w-4 sm:h-4" /><span>Compra Segura</span></div>
                <div className="flex items-center gap-1"><CreditCard className="w-3 h-3 sm:w-4 sm:h-4" /><span>PIX ou Cartão</span></div>
              </div>
            </div>

            {/* Plano Agência Vitalício */}
            <div className="bg-gradient-to-b from-card to-background border-2 border-border/70 rounded-2xl sm:rounded-3xl p-5 sm:p-8 relative overflow-hidden flex flex-col">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-card to-background text-primary-foreground font-bold px-4 sm:px-6 py-1.5 sm:py-2 rounded-b-xl text-xs sm:text-sm whitespace-nowrap">
                  ⭐ PREMIUM VITALÍCIO
                </div>
              </div>

              <div className="text-center mt-6 mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">Agência Vitalício</h3>
                <div className="text-base sm:text-lg text-muted-foreground mb-2">pagamento único</div>
                <div className="text-primary mb-1">
                  <span className="text-lg sm:text-xl md:text-2xl font-medium">12x de</span>
                  <span className="text-5xl sm:text-6xl md:text-7xl font-black ml-2">R$122</span>
                </div>
                <p className="text-muted-foreground text-lg sm:text-xl mb-1">
                  ou <span className="text-foreground font-bold">R$ 1.197,00 à vista</span>
                </p>
                <p className="text-primary text-xs sm:text-sm font-medium">Acesso vitalício — sem renovação</p>
              </div>

              <div className="space-y-3 mb-6 sm:mb-8 flex-1">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm sm:text-base">12 contas do Instagram</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm sm:text-base">Ferramenta MRO completa</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground text-sm sm:text-base">Suporte VIP</span>
                </div>
              </div>

              <Button
                onClick={() => {
                  setSelectedPlan({
                    type: 'lifetime',
                    amount: 1197,
                    label: 'Agência Vitalício',
                    installments: '12x de R$ 122,83',
                    oneTime: 'R$ 1.197,00 à vista'
                  });
                  setShowCheckoutModal(true);
                }}
                className="w-full bg-gradient-to-r from-card to-background hover:from-card hover:to-background text-primary-foreground font-bold text-base sm:text-xl py-5 sm:py-7 rounded-xl shadow-lg shadow-primary/30"
              >
                QUERO O VITALÍCIO
              </Button>

              <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1"><Shield className="w-3 h-3 sm:w-4 sm:h-4" /><span>Compra Segura</span></div>
                <div className="flex items-center gap-1"><CreditCard className="w-3 h-3 sm:w-4 sm:h-4" /><span>PIX ou Cartão</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Final CTA */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-card to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl md:text-4xl font-bold mb-4 sm:mb-6">
            Não perca essa <span className="text-primary">oportunidade única!</span>
          </h2>
          
          <Button
            onClick={scrollToPricing}
            className="bg-gradient-to-r from-card to-background hover:from-card hover:to-background text-foreground font-bold text-sm sm:text-xl px-6 sm:px-12 py-5 sm:py-7 rounded-full shadow-lg shadow-primary/30"
          >
            VER OS PLANOS
          </Button>
        </div>
      </section>

      {/* Video Modal */}
      {showVideoModal && (
        <div 
          className="fixed inset-0 z-[100] bg-background/95 flex items-center justify-center p-2 sm:p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <button 
            className="absolute top-2 right-2 sm:top-4 sm:right-4 text-foreground hover:text-muted-foreground z-10"
            onClick={() => setShowVideoModal(false)}
          >
            <X className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
          <div className="w-full max-w-5xl aspect-video" onClick={e => e.stopPropagation()}>
            <iframe
              src={`https://www.youtube.com/embed/${currentVideoUrl}?autoplay=1&rel=0`}
              className="w-full h-full rounded-lg"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] bg-background/90 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card border border-border/30 rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 relative my-4">
            <button 
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            <div className="text-center mb-4 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-bold mb-2">Finalize seu Cadastro</h3>
              <p className="text-primary font-bold text-sm sm:text-base mb-1">Plano {selectedPlan.label}</p>
              <div className="text-2xl sm:text-3xl font-bold text-primary">
                {selectedPlan.installments}
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">ou {selectedPlan.oneTime}</p>
            </div>
            
            <form onSubmit={handleCheckout} className="space-y-3 sm:space-y-4">
              <div>
                <label className="text-xs sm:text-sm text-muted-foreground mb-1 block">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  E-mail
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="bg-card border-border text-foreground text-sm sm:text-base"
                  required
                />
              </div>
              
              <div>
                <label className="text-xs sm:text-sm text-muted-foreground mb-1 block">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Celular com DDD
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="bg-card border-border text-foreground text-sm sm:text-base"
                  required
                />
              </div>
              
              <div>
                <label className="text-xs sm:text-sm text-muted-foreground mb-1 block">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Nome de usuário (login)
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => validateUsername(e.target.value)}
                  placeholder="seunome"
                  className={`bg-card border-border text-foreground text-sm sm:text-base ${usernameError ? 'border-border' : ''}`}
                  required
                />
                {usernameError && (
                  <p className="text-primary text-[10px] sm:text-xs mt-1">{usernameError}</p>
                )}
                <p className="text-muted-foreground text-[10px] sm:text-xs mt-1">
                  Apenas letras minúsculas, sem espaços ou números
                </p>
              </div>
              
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-card to-background hover:from-card hover:to-background text-foreground font-bold py-5 sm:py-6 rounded-xl text-sm sm:text-base"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    PAGAR AGORA
                  </>
                )}
              </Button>
            </form>
            
            <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4 text-[10px] sm:text-xs text-muted-foreground">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Pagamento 100% seguro via InfiniPay</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-3 sm:px-4 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-muted-foreground text-xs sm:text-sm">
          <p>© 2025 MRO - Mais Resultados Online. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Ferramentammmr;