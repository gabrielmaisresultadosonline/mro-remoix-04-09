import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";



import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView, trackInitiateCheckout, trackFacebookEvent } from "@/lib/facebookTracking";
import { toast } from "sonner";
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  Play,
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
  Lightbulb,
  RefreshCw,
  Gift,
  Laptop,
  Mail,
  User,
  CreditCard,
  Loader2,
  Phone,
  Timer,
  AlertTriangle,
  Send,
  Filter,
  BarChart3,
  FileText,
  Rocket,
  Crown,
  Flame,
  MousePointerClick,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import logoMro from "@/assets/logo-mro.png";
import bonus5mil from "@/assets/bonus-5mil.png";
import ActiveClientsSection from "@/components/ActiveClientsSection";
import { RendaExtraAgencyProposal } from "@/components/sales/RendaExtraAgencyProposal";

import { MRO_ANNUAL_OFFER } from '../../supabase/functions/_shared/mro-sales';
import { wlCall, type WlSalesContext } from '@/lib/whitelabel';
import { WlBrandOrbit } from '@/components/whitelabel/WlBrandOrbit';

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  photoUrl: string;
  active: boolean;
  showPromoBanner?: boolean;
}

const DescontoAlunosRendaExtra = ({ whitelabel }: { whitelabel?: WlSalesContext } = {}) => {
  const { affiliateId } = useParams<{ affiliateId: string }>();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [loadingAffiliate, setLoadingAffiliate] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Carregar dados do afiliado
  useEffect(() => {
    const loadAffiliate = async () => {
      if (whitelabel) {
        setAffiliate({ id: whitelabel.code, name: whitelabel.name, email: '', photoUrl: '', active: true, showPromoBanner: false });
        setNotFound(false); setLoadingAffiliate(false); return;
      }
      let id = affiliateId;
      if (!id && window.location.hash) {
        id = window.location.hash.replace('#', '');
      }
      if (!id) {
        setNotFound(true);
        setLoadingAffiliate(false);
        return;
      }
      try {
        // 1. Check DB partners first
        const { data: dbPartner } = await supabase
          .from('partners')
          .select('*')
          .eq('slug', id)
          .eq('status', 'active')
          .maybeSingle();

        if (dbPartner) {
          setAffiliate({
            id: dbPartner.slug,
            name: dbPartner.name,
            email: dbPartner.email,
            photoUrl: "",
            active: true,
            showPromoBanner: (dbPartner as any).show_promo_banner ?? true,
          });
          setLoadingAffiliate(false);
          return;
        }

        const { data, error } = await supabase.storage
          .from('user-data')
          .download('admin/affiliates.json');
        if (error || !data) {
          setNotFound(true);
          setLoadingAffiliate(false);
          return;
        }
        const text = await data.text();
        const affiliates: AffiliateData[] = JSON.parse(text);
        const found = affiliates.find(a => a.id.toLowerCase() === id?.toLowerCase());
        if (!found || !found.active) {
          setNotFound(true);
          setLoadingAffiliate(false);
          return;
        }
        setAffiliate(found);
      } catch (e) {
        console.error("Error:", e);
        setNotFound(true);
      } finally {
        setLoadingAffiliate(false);
      }
    };
    loadAffiliate();
  }, [affiliateId, whitelabel]);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [isMainVideoPlaying, setIsMainVideoPlaying] = useState(false);
  const [isDiscountActive, setIsDiscountActive] = useState(true);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  
  // Popup de desconto encerrado - agora controlado pelo banco de dados
  const [showDiscountEndedPopup, setShowDiscountEndedPopup] = useState(false);
  
  // Countdown para promoção - 8 horas a partir do primeiro acesso
  const [promoTimeLeft, setPromoTimeLeft] = useState({ hours: 8, minutes: 0, seconds: 0, expired: false });
  const pricingRef = useRef<HTMLDivElement>(null);
  
  // Modal de cadastro
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
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
      if (whitelabel) {
        const { checkout_url } = await wlCall<{ checkout_url: string }>('public_checkout', {
          code: whitelabel.code, link_type: whitelabel.linkType, plan: 'annual', email, username, name: username,
          phone: phone.replace(/\D/g, ''),
        });
        trackInitiateCheckout('MRO Renda Extra Whitelabel', MRO_ANNUAL_OFFER.price);
        window.location.href = checkout_url;
        return;
      }
      // Shared official annual price.
      const { data: checkData, error: checkError } = await supabase.functions.invoke("create-mro-checkout", {
        body: { 
          email: `${affiliateId || affiliate?.id}:${email.toLowerCase().trim()}`,
          username: username.toLowerCase().trim(),
          phone: phone.replace(/\D/g, "").trim(),
          planType: "annual",
          amount: MRO_ANNUAL_OFFER.price,

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

      // Track InitiateCheckout when redirecting to payment
      trackInitiateCheckout(`MRO Renda Extra Affiliate ${affiliate?.name || ''}`, MRO_ANNUAL_OFFER.price);
      
      // Redirecionar diretamente para o checkout (funciona melhor no mobile)
      window.location.href = checkData.payment_link;
      
      // Resetar form
      setEmail("");
      setUsername("");
      setPhone("");

    } catch (error) {
      console.error("Error:", error);
      toast.error(whitelabel && error instanceof Error ? error.message : "Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Track PageView on mount and fetch settings
  useEffect(() => {
    trackPageView(`Sales Page - Renda Extra Affiliate ${affiliate?.name || ''}`);
    
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("desconto_alunos_settings")
          .select("is_active")
          .single();
        
        if (!error && data) {
          setIsDiscountActive(data.is_active);
          if (!data.is_active) {
            setShowDiscountEndedPopup(true);
          }
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setIsSettingsLoading(false);
      }
    };
    
    fetchSettings();
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

  const iaFeatures = [
    "Cria legendas prontas e otimizadas para seu conteúdo",
    "Gera biografias profissionais para seu Instagram",
    "Entrega os melhores horários para postar no seu nicho",
    "Recomenda hashtags quentes e relevantes"
  ];

  const mroFeatures = [
    { icon: Heart, title: "Curte fotos" },
    { icon: UserPlus, title: "Segue perfis estratégicos" },
    { icon: Users, title: "Segue e deixa de seguir também" },
    { icon: Eye, title: "Reage aos Stories com \"amei\"" },
    { icon: Target, title: "Remove seguidores fakes/comprados" },
    { icon: Zap, title: "Interação com 200 pessoas por dia" }
  ];

  const areaMembroFeatures = [
    "Vídeos estratégicos com passo a passo",
    "Como deixar seu perfil mais atrativo e profissional",
    "Como agendar suas postagens e deixar tudo no automático",
    "Estratégias para bombar seu Instagram mesmo começando do zero"
  ];

  const grupoVipFeatures = [
    "Acesse o grupo VIP",
    "Tire dúvidas",
    "Compartilhe resultados",
    "Receba atualizações em primeira mão"
  ];

  const planFeatures = [
    "Ferramenta completa para Instagram",
    "Acesso a 4 contas simultâneas fixas",
    "5 testes todo mês para testar em seus clientes/outras contas",
    "Área de membros por 1 ano",
    "Vídeos estratégicos passo a passo",
    "Grupo VIP no WhatsApp",
    "Suporte prioritário"
  ];

  if (loadingAffiliate) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
      </div>
    );
  }

  if (notFound || !affiliate) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Promoção não encontrada</h1>
          <p className="text-gray-400">Esta promoção pode ter expirado ou não existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <style>{`
        .btn-pulse-color {
          background: linear-gradient(to right, #facc15, #eab308) !important;
          border: none;
        }
        @keyframes bounceArrowRight {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(8px); }
        }
        @keyframes bounceArrowLeft {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-8px); }
        }
        .arrow-bounce-right {
          animation: bounceArrowRight 1s ease-in-out infinite;
        }
        .arrow-bounce-left {
          animation: bounceArrowLeft 1s ease-in-out infinite;
        }
      `}</style>
      {/* Popup Desconto Encerrado */}
      {showDiscountEndedPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-red-500 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center relative animate-in zoom-in-95 duration-300 shadow-[0_0_50px_rgba(239,68,68,0.3)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="bg-red-600 text-white font-bold px-4 py-1.5 rounded-full text-sm">
                ⚠️ AVISO
              </div>
            </div>
            
            <div className="mt-4 mb-6">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Desconto Encerrado!
              </h2>
              <p className="text-gray-300 text-base sm:text-lg leading-relaxed mb-2">
                Aguarde um próximo desconto para alunos renda extra.
              </p>
              <p className="text-red-400 font-bold text-sm sm:text-base">
                Consulte os administradores para mais informações.
              </p>
            </div>
            
            <Button 
              onClick={() => window.location.href = '/instagram-nova'}
              className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white font-bold text-lg py-5 rounded-xl border border-gray-600"
            >
              Página Oficial <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            
            {!isDiscountActive ? (
              <div className="mt-6 p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
                <p className="text-xs text-red-400">
                  Esta oferta foi encerrada temporariamente pela administração.
                </p>
              </div>
            ) : (
              <button 
                onClick={() => setShowDiscountEndedPopup(false)}
                className="mt-4 text-gray-400 hover:text-white text-sm underline"
              >
                Continuar na página mesmo assim
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header removido conforme solicitação */}

      {/* Hero Section */}
      <section className="relative pt-16 sm:pt-20 md:pt-24 pb-10 sm:pb-16 px-3 sm:px-4">
        <div className="max-w-5xl mx-auto text-center">
          
          {/* Affiliate Info */}
          {(affiliate.showPromoBanner ?? true) && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            {affiliate.photoUrl ? (
              <img 
                src={affiliate.photoUrl} 
                alt={affiliate.name} 
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto mb-4 border-4 border-yellow-500 shadow-lg shadow-yellow-500/30 object-cover"
              />
            ) : (
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto mb-4 border-4 border-yellow-500 shadow-lg shadow-yellow-500/30 bg-yellow-900 flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
            )}
            <div className="inline-block bg-yellow-500/10 border border-yellow-500/30 rounded-full px-6 py-2">
              <p className="text-yellow-400 text-sm sm:text-base font-bold">
                🎁 Promoção especial — {affiliate.name}
              </p>
            </div>
          </div>
          )}

          
          {whitelabel ? <WlBrandOrbit logoUrl={whitelabel.logoUrl} name={whitelabel.name} /> : <img src={logoMro} alt="MRO" className="h-16 sm:h-20 md:h-28 mx-auto mb-6 sm:mb-8 object-contain" />}
          
          {/* Animated Title */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-yellow-500/20 via-yellow-500/20 to-yellow-500/20 blur-3xl rounded-full" />
            <h1 className="relative text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black mb-3 sm:mb-4 px-2">
              <span className="bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent">FATURE MAIS DE R$5.000</span>
            </h1>
            <h2 className="relative text-lg sm:text-xl md:text-3xl lg:text-4xl font-black mb-3">
              <span className="bg-gradient-to-r from-yellow-400 via-yellow-400 to-yellow-400 bg-clip-text text-transparent">
                TRABALHANDO DE CASA!
              </span>
            </h2>
            <p className="relative mt-3 text-sm sm:text-base md:text-lg text-gray-300 max-w-3xl mx-auto">
              Renda extra automática e real! Com apenas 1 computador ou notebook, instale a ferramenta MRO e comece a faturar de qualquer lugar do mundo.
            </p>
          </div>

          {/* Renda Extra Badge */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-600/30 to-yellow-600/30 border border-yellow-500/50 rounded-full px-4 sm:px-6 py-2 mt-6">
            <Laptop className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            <span className="text-white font-bold text-xs sm:text-sm">20 MINUTOS ANTES DE DORMIR = RENDA EXTRA AUTOMÁTICA</span>
            <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
          </div>


          {/* Main Video */}
          <div className="mt-8 sm:mt-10 max-w-4xl mx-auto">
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white">
                Assista a <span className="text-yellow-400">AULA GRÁTIS</span> para entender tudo
              </h2>
            </div>
            <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-yellow-500/30">
              <div className="aspect-video">
                <iframe 
                  src="https://www.youtube.com/embed/-0CHlqHVe0g?rel=0&modestbranding=1" 
                  title="Aula Grátis"
                  className="w-full h-full" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen 
                />
              </div>
            </div>
          </div>

          {/* CTA Button with arrows */}
          <div className="relative mt-8 sm:mt-10 flex items-center justify-center gap-2 sm:gap-4">
            <span className="arrow-bounce-right text-white text-2xl sm:text-3xl">▶</span>
            <Button 
              onClick={scrollToPricing}
              className="btn-pulse-color text-black font-bold text-sm sm:text-lg px-6 sm:px-10 py-5 sm:py-6 rounded-full shadow-lg shadow-yellow-500/30"
            >
              GARANTIR MEU DESCONTO AGORA <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <span className="arrow-bounce-left text-white text-2xl sm:text-3xl">◀</span>
          </div>
        </div>
      </section>


      {/* === PASSO A PASSO PARA FATURAR 5 MIL === */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 sm:px-6 py-2 mb-6">
            <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <span className="text-amber-400 font-bold text-xs sm:text-sm">BÔNUS EXCLUSIVO</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-4">
            Você vai receber o <span className="text-yellow-400">passo a passo completo</span> para faturar seus 5 mil!
          </h2>
          <p className="text-gray-300 text-sm sm:text-lg max-w-3xl mx-auto mb-8 sm:mb-10">
            Desde como se posicionar para começar, até fechar contratos e entregar testes ao cliente — além de materiais disponíveis para divulgação.
          </p>
          <div className="rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-2xl shadow-amber-500/10">
            <img src={bonus5mil} alt="Passo a passo para faturar mais de 5 mil com a ferramenta MRO" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* === FEEDBACKS DE ALUNOS - VÍDEO CARROSSEL === */}
      <section className="py-16 sm:py-20 px-3 sm:px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 sm:px-6 py-2 mb-4">
              <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-xs sm:text-sm">RESULTADOS REAIS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3">
              Alunos faturando <span className="text-yellow-400">mais de R$5.000</span>
            </h2>
            <p className="text-gray-400 text-sm sm:text-base">
              Veja os feedbacks de quem já está lucrando com prestação de serviço usando a ferramenta MRO
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => {
                const el = document.getElementById('feedback-carousel');
                if (el) el.scrollBy({ left: -260, behavior: 'smooth' });
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-800/80 hover:bg-yellow-500/80 border border-gray-700 hover:border-yellow-400 flex items-center justify-center transition-all -ml-2 sm:-ml-4 shadow-lg"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('feedback-carousel');
                if (el) el.scrollBy({ left: 260, behavior: 'smooth' });
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gray-800/80 hover:bg-yellow-500/80 border border-gray-700 hover:border-yellow-400 flex items-center justify-center transition-all -mr-2 sm:-mr-4 shadow-lg"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>

            <div
              id="feedback-carousel"
              className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory cursor-grab active:cursor-grabbing px-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
              onMouseDown={(e) => {
                const el = e.currentTarget;
                el.dataset.dragging = 'true';
                el.dataset.startX = String(e.pageX - el.offsetLeft);
                el.dataset.scrollLeft = String(el.scrollLeft);
              }}
              onMouseMove={(e) => {
                const el = e.currentTarget;
                if (el.dataset.dragging !== 'true') return;
                e.preventDefault();
                const x = e.pageX - el.offsetLeft;
                const walk = (x - Number(el.dataset.startX)) * 1.5;
                el.scrollLeft = Number(el.dataset.scrollLeft) - walk;
              }}
              onMouseUp={(e) => { e.currentTarget.dataset.dragging = 'false'; }}
              onMouseLeave={(e) => { e.currentTarget.dataset.dragging = 'false'; }}
            >
              {[
                { id: "eFEZ_jysYvU", title: "Feedback 1" },
                { id: "gRe-VlScXjo", title: "Feedback 2" },
                { id: "wfU12IHauN8", title: "Feedback 3" },
                { id: "8o8ut9yxmnk", title: "Feedback 4" },
                { id: "cZA5lEH8rpE", title: "Feedback 5" },
                { id: "ct5U0Cp61YA", title: "Feedback 6" },
              ].map((video, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[180px] sm:w-[220px] md:w-[240px] snap-start cursor-pointer group select-none"
                  onClick={(e) => {
                    const el = document.getElementById('feedback-carousel');
                    if (el?.dataset.dragging === 'true') return;
                    openVideo(video.id);
                  }}
                >
                  <div className="relative aspect-[9/16] rounded-xl sm:rounded-2xl overflow-hidden border-2 border-yellow-500/30 group-hover:border-yellow-400 transition-all shadow-lg group-hover:shadow-yellow-500/20">
                    <img
                      src={`https://img.youtube.com/vi/${video.id}/0.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-yellow-500/90 group-hover:bg-yellow-500 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white ml-1" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      <section className="py-10 sm:py-12 px-3 sm:px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl sm:text-2xl font-bold text-center mb-6 text-white">
            Como funciona <span className="text-yellow-400">na prática</span>
          </h3>
          <p className="text-center text-gray-300 text-sm sm:text-base mb-6 max-w-2xl mx-auto">
            Você vai prestar esse serviço para <span className="text-yellow-400 font-semibold">empresas e negócios locais</span> — e eles vão te pagar uma <span className="text-yellow-400 font-semibold">mensalidade recorrente</span> pelo trabalho automático que a ferramenta faz por você.
          </p>
          <div className="grid gap-3">
            {[
              { step: "01", title: "Feche um cliente (empresa/negócio local)", desc: "Ofereça o serviço de automação no Instagram e cobre uma mensalidade recorrente" },
              { step: "02", title: "Ative o seguir + curtir em massa", desc: "O sistema interage com perfis estratégicos automaticamente para o cliente" },
              { step: "03", title: "Pessoas interessadas seguem o cliente de volta", desc: "Quem se identifica com o conteúdo passa a seguir o perfil" },
              { step: "04", title: "Envie Direct em massa automaticamente", desc: "Mensagens otimizadas são enviadas para leads qualificados" },
              { step: "05", title: "O cliente vende mais e te paga todo mês", desc: "Resultado real = cliente satisfeito pagando mensalidade recorrente pra você" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-gray-900/60 border border-gray-800 rounded-xl p-3 sm:p-4">
                <span className="text-yellow-400 font-black text-lg shrink-0">{item.step}</span>
                <div>
                  <p className="text-white font-semibold text-sm sm:text-base">{item.title}</p>
                  <p className="text-gray-500 text-xs sm:text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm sm:text-base text-gray-400 mt-5">
            Mais seguidores → Mais conversas → <span className="text-yellow-400 font-bold">Mais vendas</span>
          </p>
        </div>
      </section>




      {/* Nova proposta MRO Inteligente — apresentação apenas */}
      <RendaExtraAgencyProposal onCta={scrollToPricing} />

      <section ref={pricingRef} className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center mb-3 sm:mb-4">
            <span className="text-yellow-400">OFERTA ESPECIAL</span>
          </h2>
          <p className="text-center text-gray-400 mb-8 sm:mb-10 text-base sm:text-lg">Promoção válida apenas por 8 horas</p>
          
          {/* Pricing Card */}
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-yellow-500 rounded-2xl sm:rounded-3xl p-5 sm:p-8 relative overflow-hidden">
            {/* Badge */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2">
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold px-4 sm:px-6 py-1.5 sm:py-2 rounded-b-xl text-xs sm:text-sm whitespace-nowrap">
                🔥 DESCONTO ESPECIAL
              </div>
            </div>
            
            <div className="text-center mt-6 sm:mt-6 mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">Plano Anual Completo</h3>
              
              {/* Price */}
              <div className="mb-2">
                <span className="text-gray-500 line-through text-lg sm:text-2xl">De R$ 497</span>
              </div>
              
              <div className="text-base sm:text-lg text-gray-300 mb-2">por apenas</div>
              
              <div className="text-yellow-400 mb-1">
                <span className="text-lg sm:text-xl md:text-2xl font-medium">12x de</span>
                <span className="text-5xl sm:text-6xl md:text-7xl font-black ml-2">R${MRO_ANNUAL_OFFER.installment}</span>
              </div>
              
              <p className="text-gray-300 text-lg sm:text-xl mb-3">
                ou <span className="text-white font-bold">R${MRO_ANNUAL_OFFER.price} à vista</span>
              </p>
              
              {/* Animated discount highlight */}
              <div className="relative inline-block mb-4">
                <div className="absolute -inset-2 bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-red-500/30 rounded-full blur-md animate-pulse" />
                <div className="relative inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-600 border-2 border-yellow-400/60 rounded-full px-4 sm:px-6 py-2 sm:py-3 animate-bounce" style={{ animationDuration: '2s' }}>
                  <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300" />
                  <span className="text-white font-black text-sm sm:text-lg tracking-wide">R$100 DE DESCONTO!</span>

                  <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300 animate-pulse" />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 animate-pulse" />
                <p className="text-yellow-400 text-xs sm:text-sm font-bold">
                  ⏰ Válido apenas nas próximas 8 horas
                </p>
                <AlertTriangle className="w-4 h-4 text-yellow-400 animate-pulse" />
              </div>
            </div>
            
            {/* Features */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              {planFeatures.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-200 text-sm sm:text-base">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <Button 
              onClick={() => {
                if (promoTimeLeft.expired) {
                  toast.error("Promoção expirada! Esta oferta não está mais disponível.");
                  return;
                }
                setShowCheckoutModal(true);
              }}
              disabled={promoTimeLeft.expired}
              className="w-full btn-pulse-color text-black font-bold text-base sm:text-xl py-5 sm:py-7 rounded-xl shadow-lg shadow-yellow-500/30 disabled:opacity-50"
            >
              {promoTimeLeft.expired ? "PROMOÇÃO EXPIRADA" : "QUERO GARANTIR AGORA"}
            </Button>
            <div className="flex items-center justify-center gap-2 sm:gap-4 mt-3">
              <span className="arrow-bounce-right text-white text-xl sm:text-2xl">▶</span>
              <span className="text-white text-xs sm:text-sm font-semibold">CLIQUE ACIMA</span>
              <span className="arrow-bounce-left text-white text-xl sm:text-2xl">◀</span>
            </div>
            
            {/* Secure badges */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mt-4 sm:mt-6 text-xs sm:text-sm text-gray-400 flex-wrap">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Compra Segura</span>
              </div>
              <div className="flex items-center gap-1">
                <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>PIX ou Cartão</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Garantia */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-black">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-yellow-900/30 to-yellow-900/30 border border-yellow-500/30 rounded-xl sm:rounded-2xl p-5 sm:p-8">
            <div className="flex flex-col items-center gap-4 sm:gap-6 text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-400 mb-2 sm:mb-3">
                  30 Dias de Resultados Garantidos
                </h3>
                <p className="text-gray-300 text-sm sm:text-base">
                  Nós garantimos engajamento, clientes, público e vendas utilizando nossa ferramenta de modo contínuo. 
                  Se em 30 dias você não estiver completamente satisfeito, devolvemos <strong className="text-white">100% do seu investimento!</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl md:text-4xl font-bold mb-4 sm:mb-6">
            Não perca essa <span className="text-yellow-400">oportunidade única!</span>
          </h2>
          
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
            <Timer className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 animate-pulse" />
            <span className="text-base sm:text-xl font-bold">
              Oferta expira em{" "}
              <span className="text-red-500 font-mono">
                {promoTimeLeft.expired ? "EXPIRADO" : 
                  `${String(promoTimeLeft.hours).padStart(2, '0')}:${String(promoTimeLeft.minutes).padStart(2, '0')}:${String(promoTimeLeft.seconds).padStart(2, '0')}`
                }
              </span>
            </span>
          </div>
          
          <Button 
            onClick={() => {
              if (promoTimeLeft.expired) {
                toast.error("Promoção expirada!");
                return;
              }
              setShowCheckoutModal(true);
            }}
            disabled={promoTimeLeft.expired}
            className="btn-pulse-color text-black font-bold text-sm sm:text-xl px-6 sm:px-12 py-5 sm:py-7 rounded-full shadow-lg shadow-yellow-500/30 disabled:opacity-50"
          >
            {promoTimeLeft.expired ? "PROMOÇÃO EXPIRADA" : `GARANTIR MEU DESCONTO DE R$${MRO_ANNUAL_OFFER.price}`}
          </Button>
          <div className="flex items-center justify-center gap-2 sm:gap-4 mt-3">
            <span className="arrow-bounce-right text-white text-xl sm:text-2xl">▶</span>
            <span className="text-white text-xs sm:text-sm font-semibold">CLIQUE ACIMA</span>
            <span className="arrow-bounce-left text-white text-xl sm:text-2xl">◀</span>
          </div>
        </div>
      </section>

      {/* Video Modal */}
      {showVideoModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2 sm:p-4"
          onClick={() => setShowVideoModal(false)}
        >
          <button 
            className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white hover:text-gray-300 z-10"
            onClick={() => setShowVideoModal(false)}
          >
            <X className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
          <div className="w-full max-w-sm aspect-[9/16] max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <iframe
              src={`https://www.youtube.com/embed/${currentVideoUrl}?autoplay=1&rel=0`}
              className="w-full h-full rounded-xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-yellow-500/30 rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 relative my-4">
            <button 
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            <div className="text-center mb-4 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-bold mb-2">Finalize seu Cadastro</h3>
              <div className="text-2xl sm:text-3xl font-bold text-yellow-400">
                12x de R${MRO_ANNUAL_OFFER.installment}
              </div>
              <p className="text-gray-400 text-xs sm:text-sm">ou R${MRO_ANNUAL_OFFER.price} à vista no PIX</p>
            </div>
            
            <form onSubmit={handleCheckout} className="space-y-3 sm:space-y-4">
              <div>
                <label className="text-xs sm:text-sm text-gray-400 mb-1 block">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  E-mail
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="bg-gray-800 border-gray-700 text-white text-sm sm:text-base"
                  required
                />
              </div>
              
              <div>
                <label className="text-xs sm:text-sm text-gray-400 mb-1 block">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Celular com DDD
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="bg-gray-800 border-gray-700 text-white text-sm sm:text-base"
                  required
                />
              </div>
              
              <div>
                <label className="text-xs sm:text-sm text-gray-400 mb-1 block">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Nome de usuário (login)
                </label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => validateUsername(e.target.value)}
                  placeholder="seunome"
                  className={`bg-gray-800 border-gray-700 text-white text-sm sm:text-base ${usernameError ? 'border-red-500' : ''}`}
                  required
                />
                {usernameError && (
                  <p className="text-red-400 text-[10px] sm:text-xs mt-1">{usernameError}</p>
                )}
                <p className="text-gray-500 text-[10px] sm:text-xs mt-1">
                  Apenas letras minúsculas, sem espaços ou números
                </p>
              </div>
              
              <Button
                type="submit"
                disabled={loading || promoTimeLeft.expired}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black font-bold py-5 sm:py-6 rounded-xl text-sm sm:text-base"
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
            
            <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4 text-[10px] sm:text-xs text-gray-500">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Pagamento 100% seguro via InfiniPay</span>
            </div>
          </div>
        </div>
      )}

      {/* Active Clients */}
      <section className="py-8 px-4 bg-gradient-to-b from-gray-950 to-black">
        <ActiveClientsSection title="Clientes Ativos" maxClients={15} />
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-3 sm:px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-xs sm:text-sm">
          <p>© 2025 MRO - Mais Resultados Online. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default DescontoAlunosRendaExtra;
