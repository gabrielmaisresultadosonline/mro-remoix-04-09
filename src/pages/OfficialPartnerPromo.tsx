import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
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
  Brain,
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
  Calendar,
  FileText,
  DollarSign,
  HelpCircle,
  Smartphone,
  TrendingUp,
  ShoppingCart,
  Send,
  Filter,
  Rocket,
  Crown,
  Flame,
  MousePointerClick,
  BarChart3
} from "lucide-react";
import logoMro from "@/assets/logo-mro.png";
import ActiveClientsSection from "@/components/ActiveClientsSection";

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  photoUrl: string;
  active: boolean;
  showPromoBanner?: boolean;
  promoStartDate?: string;
  promoEndDate?: string;
  promoStartTime?: string;
  promoEndTime?: string;
}

const OfficialPartnerPromo = () => {
  const { affiliateId } = useParams<{ affiliateId: string }>();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  
  // Countdown
  const [promoTimeLeft, setPromoTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });
  const pricingRef = useRef<HTMLDivElement>(null);
  
  // Modal de cadastro
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Carregar dados do afiliado
  useEffect(() => {
    const loadAffiliate = async () => {
      if (!affiliateId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        // 1. Check Database first (Official Partners)
        const { data: dbPartner, error: dbError } = await supabase
          .from('partners')
          .select('*')
          .eq('slug', affiliateId)
          .single();

        if (dbPartner && dbPartner.status === 'active') {
          setAffiliate({
            id: dbPartner.slug,
            name: dbPartner.name,
            email: dbPartner.email,
            photoUrl: "", // Partners might not have photoUrl yet
            active: true,
            showPromoBanner: (dbPartner as any).show_promo_banner ?? true
          });
          setPartnerId(dbPartner.id);

          // Record visit
          await supabase.from('partner_visits').insert([{
            partner_id: dbPartner.id,
            user_agent: navigator.userAgent,
            referer: document.referrer
          }]);

          setLoading(false);
          return;
        }

        // 2. Fallback to Supabase Storage (Legacy Affiliates)
        const { data, error } = await supabase.storage
          .from('user-data')
          .download('admin/affiliates.json');

        if (error || !data) {
          console.error("Error loading affiliates:", error);
          setNotFound(true);
          setLoading(false);
          return;
        }

        const text = await data.text();
        const affiliates: AffiliateData[] = JSON.parse(text);
        const found = affiliates.find(a => a.id.toLowerCase() === affiliateId.toLowerCase());

        if (!found || !found.active) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setAffiliate(found);
      } catch (e) {
        console.error("Error:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    loadAffiliate();
  }, [affiliateId]);

  // Countdown baseado nas datas do afiliado
  useEffect(() => {
    if (!affiliate) return;

    // Contador fictício de escassez - SEMPRE começa em 10 horas quando usuário entra
    // Armazena apenas na sessão atual (não persiste entre recarregamentos)
    const startTime = Date.now();
    const tenHoursMs = 10 * 60 * 60 * 1000; // 10 horas em milissegundos

    const updateCountdown = () => {
      const elapsed = Date.now() - startTime;
      let remaining = tenHoursMs - elapsed;

      // Se chegou a zero, reinicia (nunca expira de verdade)
      if (remaining <= 0) {
        remaining = tenHoursMs;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      setPromoTimeLeft({ days: 0, hours, minutes, seconds, expired: false });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [affiliate]);

  // Track PageView
  useEffect(() => {
    if (affiliate) {
      trackPageView(`Sales Page - Affiliate ${affiliate.name}`);
    }
  }, [affiliate]);

  // Verificar disponibilidade do username na SquareCloud usando /verificar-numero
  // Regra: enviar nome e senha iguais (numero = username) e interpretar:
  // - senhaCorrespondente === true  => já existe (não disponível)
  // - senhaCorrespondente === false => disponível
  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (usernameToCheck.length < 4) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const body = new URLSearchParams({
        nome: usernameToCheck,
        numero: usernameToCheck,
      });

      const response = await fetch(
        'https://dashboardmroinstagramvini-online.squareweb.app/verificar-numero',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setUsernameAvailable(null);
        setUsernameError('Erro ao verificar disponibilidade');
        return;
      }

      if (data?.senhaCorrespondente === true) {
        setUsernameAvailable(false);
        setUsernameError('Usuário já em uso. Utilize outro usuário');
      } else if (data?.senhaCorrespondente === false) {
        setUsernameAvailable(true);
        setUsernameError('');
      } else {
        setUsernameAvailable(null);
        setUsernameError('Erro ao verificar disponibilidade');
      }
    } catch {
      setUsernameAvailable(null);
      setUsernameError('Erro ao verificar disponibilidade');
    } finally {
      setCheckingUsername(false);
    }
  };

  // Validar username com debounce para verificação
  const validateUsername = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
    setUsername(cleaned);
    setUsernameAvailable(null);
    
    // Limpar timeout anterior
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }
    
    if (value !== cleaned) {
      setUsernameError("Apenas letras minúsculas, sem espaços ou números");
      return;
    } else if (cleaned.length < 4) {
      setUsernameError("Mínimo de 4 caracteres");
      return;
    } else if (cleaned.length > 20) {
      setUsernameError("Máximo de 20 caracteres");
      return;
    } else {
      setUsernameError("");
    }
    
    // Debounce: verificar disponibilidade após 500ms
    usernameCheckTimeoutRef.current = setTimeout(() => {
      checkUsernameAvailability(cleaned);
    }, 500);
  };

  // Checkout
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

    setCheckoutLoading(true);

    try {
      const { data: checkData, error: checkError } = await supabase.functions.invoke("create-mro-checkout", {
        body: { 
          email: `${affiliateId}:${email.toLowerCase().trim()}`,
          partner_id: partnerId,
          username: username.toLowerCase().trim(),
          phone: phone.replace(/\D/g, "").trim(),
          planType: "annual",
          amount: 397,
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

      const paymentLink = checkData.payment_link as string;

      // Em ambientes embedados (ex: preview/iframe), o checkout pode recusar abrir.
      // Então abrimos em nova aba. Em navegação normal, redirecionamos na mesma aba (melhor no mobile).
      let isEmbedded = false;
      try {
        isEmbedded = window.self !== window.top;
      } catch {
        isEmbedded = true;
      }

      if (isEmbedded) {
        const opened = window.open(paymentLink, "_blank", "noopener,noreferrer");
        if (!opened) {
          // Fallback: se popup foi bloqueado, tentar redirecionar mesmo assim
          window.location.href = paymentLink;
        }
      } else {
        window.location.href = paymentLink;
      }

    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const scrollToPricing = () => {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const openVideo = (url: string) => {
    setCurrentVideoUrl(url);
    setShowVideoModal(true);
  };

  // Features
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

  // Formatar data de expiração para exibição
  const getExpirationText = () => {
    // Sempre mostrar a mensagem de urgência
    return "PROMOÇÃO TERMINA EM 10 HORAS";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-green-400 animate-spin" />
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
      {/* Removed Urgency Banner */}

      {/* Hero Section */}
      <section className="relative pt-4 sm:pt-6 md:pt-8 pb-10 sm:pb-16 px-3 sm:px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* Affiliate Photo & Special Badge */}
          {(affiliate.showPromoBanner ?? true) && (
          <div className="mb-6 sm:mb-8">
            {affiliate.photoUrl ? (
              <img 
                src={affiliate.photoUrl} 
                alt={affiliate.name} 
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto mb-4 border-4 border-green-500 shadow-lg shadow-green-500/30 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%234c1d95'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='white' font-size='40'%3E" + affiliate.name.charAt(0).toUpperCase() + "%3C/text%3E%3C/svg%3E";
                }}
              />
            ) : (
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full mx-auto mb-4 border-4 border-green-500 shadow-lg shadow-green-500/30 bg-purple-900 flex items-center justify-center">
                <span className="text-4xl font-bold text-white">{affiliate.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <p className="text-green-400 text-sm sm:text-base md:text-lg font-bold">
              🎁 Promoção especial {affiliate.name}
            </p>
          </div>
          )}
          
          <img src={logoMro} alt="MRO" className="h-16 sm:h-20 md:h-28 mx-auto mb-6 sm:mb-8 object-contain" />
          
          {/* Title */}
          <div className="relative group">
            <h1 
              className="relative text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-2 sm:mb-3 text-white px-1"
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
            >
              NÃO GASTE COM ANÚNCIOS
            </h1>
            <h2 
              className="relative text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-orange-500 px-1"
              style={{ textShadow: '0 2px 8px rgba(249,115,22,0.3), 0 1px 3px rgba(0,0,0,0.8)' }}
            >
              UTILIZE A MRO INTELIGENTE!
            </h2>
            <p className="text-gray-300 text-sm sm:text-base mt-3">
              Instale em seu notebook, macbook ou computador de mesa!
            </p>
          </div>

          {/* Main Video - Embedded Player */}
          <div className="mt-8 sm:mt-10 max-w-4xl mx-auto">
            <div className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-green-500/30">
              <div className="aspect-video">
                <iframe
                  src="https://www.youtube.com/embed/lecSwt54sa0?rel=0&modestbranding=1"
                  title="Video MRO"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Button 
            onClick={scrollToPricing}
            className="mt-8 sm:mt-10 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-sm sm:text-lg px-6 sm:px-10 py-5 sm:py-6 rounded-full shadow-lg shadow-green-500/30"
          >
            GARANTIR MEU DESCONTO AGORA <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </section>

      {/* Active Clients */}
      <section className="py-8 px-4 bg-gradient-to-b from-gray-950 to-black">
        <ActiveClientsSection title="Clientes Ativos" maxClients={15} />
      </section>

      {/* ====== COMO FUNCIONA NA PRÁTICA ====== */}
      <section className="py-20 px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-6 py-2 mb-4">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-400 font-bold text-sm">COMO FUNCIONA</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              COMO FUNCIONA <span className="text-cyan-400">NA PRÁTICA</span>
            </h2>
            <p className="text-gray-400 text-lg">A nova lógica está muito mais estratégica e assertiva</p>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/50 via-amber-500/50 to-green-500/50 -translate-x-1/2" />
            {[
              { step: "01", icon: UserPlus, title: "Ative o seguir + curtir em massa", desc: "O sistema começa a interagir com perfis estratégicos automaticamente", color: "cyan" },
              { step: "02", icon: Users, title: "Pessoas interessadas te seguem de volta", desc: "Quem se identifica com seu conteúdo e nicho passa a te seguir", color: "blue" },
              { step: "03", icon: Filter, title: "O sistema identifica o público quente", desc: "Filtros inteligentes separam quem realmente tem interesse", color: "purple" },
              { step: "04", icon: Send, title: "Envie Direct em massa automaticamente", desc: "Mensagens otimizadas são enviadas para leads qualificados", color: "amber" },
              { step: "05", icon: Rocket, title: "Direcione para seu produto ou serviço", desc: "Converta seguidores em clientes reais com estratégia", color: "green" },
            ].map((item, i) => (
              <div key={i} className={`relative flex items-center gap-6 mb-8 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                <div className={`flex-1 ${i % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                  <div className="bg-gray-900/80 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-colors">
                    <div className="flex items-center gap-3 mb-2" style={{ justifyContent: i % 2 === 0 ? 'flex-end' : 'flex-start' }}>
                      <span className="text-3xl font-black text-gray-700">{item.step}</span>
                    </div>
                    <h4 className="text-xl font-bold text-white mb-1">{item.title}</h4>
                    <p className="text-gray-400">{item.desc}</p>
                  </div>
                </div>
                <div className="hidden md:flex w-14 h-14 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-600 items-center justify-center z-10 flex-shrink-0">
                  <item.icon className="w-6 h-6 text-gray-300" />
                </div>
                <div className="flex-1 hidden md:block" />
              </div>
            ))}
          </div>

          <div className="mt-12 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-green-500/10 border-2 border-amber-500/30 rounded-3xl p-8 text-center">
            <p className="text-3xl md:text-4xl font-black mb-4">
              💥 <span className="text-amber-400">RESULTADO</span>
            </p>
            <p className="text-xl md:text-2xl text-gray-200 font-bold">
              Mais seguidores → Mais conversas → <span className="text-green-400">Mais vendas</span>
            </p>
          </div>
        </div>
      </section>

      {/* ====== O QUE HÁ DE NOVO NA V7+ PLUS ====== */}
      <section className="py-20 px-4 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-full px-6 py-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-bold text-sm">O QUE HÁ DE NOVO</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              NOVIDADES DA <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">V7+ PLUS</span>
            </h2>
            <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto mb-2">
              Totalmente otimizada com mais automação, mais inteligência e mais resultados
            </p>
            <p className="text-2xl md:text-3xl font-black mt-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              🎁 O que você vai receber no Plano MRO!
            </p>
          </div>

          {/* DM em Massa */}
          <div className="mb-10">
            <div className="relative bg-gradient-to-br from-blue-950/60 to-blue-900/30 border-2 border-blue-500/40 rounded-3xl p-8 md:p-10 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Send className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="bg-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full inline-block mb-1">NOVO</div>
                    <h3 className="text-2xl md:text-3xl font-black text-blue-300">Automação de Direct (DM) em Massa</h3>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { icon: UserPlus, text: "Envio automático para novos seguidores" },
                    { icon: Users, text: "Envio para seus seguidores atuais" },
                    { icon: Target, text: "Envio para seguidores de qualquer página" },
                    { icon: Bot, text: "Copy otimizada com Corretor de IA exclusivo MRO" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 hover:bg-blue-500/15 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-blue-400" />
                      </div>
                      <span className="text-gray-200 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Filtros Inteligentes */}
          <div className="mb-10">
            <div className="relative bg-gradient-to-br from-purple-950/60 to-purple-900/30 border-2 border-purple-500/40 rounded-3xl p-8 md:p-10 overflow-hidden">
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Filter className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="bg-purple-500 text-white text-[10px] font-black px-3 py-1 rounded-full inline-block mb-1">NOVO</div>
                    <h3 className="text-2xl md:text-3xl font-black text-purple-300">Filtros Inteligentes (Público Quente)</h3>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                    <Target className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <span className="text-gray-200">Segmentação avançada para atingir quem realmente tem interesse</span>
                  </div>
                  <div className="flex items-center gap-4 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                    <TrendingUp className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <span className="text-gray-200">Mais precisão = mais respostas e conversões</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Automação Completa de Crescimento */}
          <div className="mb-10">
            <div className="relative bg-gradient-to-br from-amber-950/60 to-amber-900/30 border-2 border-amber-500/40 rounded-3xl p-8 md:p-10 overflow-hidden">
              <div className="absolute top-0 left-1/2 w-96 h-64 bg-amber-500/10 rounded-full blur-[50px] md:blur-[100px] pointer-events-none -translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="bg-amber-500 text-black text-[10px] font-black px-3 py-1 rounded-full inline-block mb-1">PRINCIPAL</div>
                    <h3 className="text-2xl md:text-3xl font-black text-amber-300">Automação Completa de Crescimento</h3>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: UserPlus, text: "Seguir em massa", color: "text-green-400" },
                    { icon: Heart, text: "Curtir fotos automaticamente", color: "text-pink-400" },
                    { icon: Flame, text: "Curtir stories", color: "text-orange-400" },
                    { icon: RefreshCw, text: "Deixar de seguir", color: "text-blue-400" },
                  ].map((item, i) => (
                    <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 text-center hover:scale-105 transition-transform">
                      <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center mx-auto mb-3">
                        <item.icon className={`w-6 h-6 ${item.color}`} />
                      </div>
                      <span className="text-gray-200 font-bold text-sm">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Captura Avançada de Público */}
          <div className="mb-10">
            <div className="relative bg-gradient-to-br from-green-950/60 to-green-900/30 border-2 border-green-500/40 rounded-3xl p-8 md:p-10 overflow-hidden">
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                    <MousePointerClick className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="bg-green-500 text-black text-[10px] font-black px-3 py-1 rounded-full inline-block mb-1">AVANÇADO</div>
                    <h3 className="text-2xl md:text-3xl font-black text-green-300">Captura Avançada de Público</h3>
                  </div>
                </div>
                <p className="text-gray-400 mb-5 text-lg">Extraia leads altamente qualificados:</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {["Pessoas que curtem posts", "Pessoas que comentam", "Seguidores de qualquer perfil", "Quem o perfil está seguindo"].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-gray-200">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 bg-green-500/15 border border-green-500/30 rounded-xl p-4 text-center">
                  <p className="text-green-300 font-bold text-lg">👉 Você atinge exatamente quem já demonstra interesse.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Inteligência Artificial Exclusiva */}
          <div className="mb-10">
            <div className="relative bg-gradient-to-br from-pink-950/60 to-pink-900/30 border-2 border-pink-500/40 rounded-3xl p-8 md:p-10 overflow-hidden">
              <div className="absolute top-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
                    <Brain className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="bg-pink-500 text-white text-[10px] font-black px-3 py-1 rounded-full inline-block mb-1">IA EXCLUSIVA</div>
                    <h3 className="text-2xl md:text-3xl font-black text-pink-300">Inteligência Artificial Exclusiva</h3>
                  </div>
                </div>
                <p className="text-gray-300 mb-5 text-lg">A MRO V7+ vai além da automação:</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { icon: Bot, text: "Análise completa do seu perfil", color: "text-pink-400" },
                    { icon: FileText, text: "Estratégias de conteúdo", color: "text-blue-400" },
                    { icon: BarChart3, text: "Estratégias de engajamento", color: "text-purple-400" },
                    { icon: CreditCard, text: "Estratégias de vendas", color: "text-green-400" },
                    { icon: Sparkles, text: "Otimização da BIO", color: "text-amber-400" },
                    { icon: TrendingUp, text: "Relatórios e acompanhamento", color: "text-cyan-400" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-pink-500/10 border border-pink-500/20 rounded-xl p-4 hover:bg-pink-500/15 transition-colors">
                      <item.icon className={`w-5 h-5 ${item.color} flex-shrink-0`} />
                      <span className="text-gray-200 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== MAIS RESULTADOS ZERO ANÚNCIOS ====== */}
      <section className="py-16 px-4 bg-black">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              💰 MAIS RESULTADOS, <span className="text-red-400">ZERO ANÚNCIOS</span>
            </h2>
            <p className="text-gray-400 text-lg">Com a MRO Inteligente V7+ você:</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Rocket, text: "Aumenta seu engajamento", gradient: "from-blue-600 to-cyan-600", glow: "shadow-blue-500/30" },
              { icon: Users, text: "Ganha seguidores qualificados", gradient: "from-purple-600 to-pink-600", glow: "shadow-purple-500/30" },
              { icon: CreditCard, text: "Converte mais clientes", gradient: "from-green-600 to-emerald-600", glow: "shadow-green-500/30" },
              { icon: X, text: "Sem tráfego pago", gradient: "from-red-600 to-orange-600", glow: "shadow-red-500/30" },
            ].map((item, i) => (
              <div key={i} className="text-center group">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-4 shadow-xl ${item.glow} group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-10 h-10 text-white" />
                </div>
                <p className="text-white font-bold text-lg">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== RESUMO FINAL ====== */}
      <section className="py-16 px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-amber-950/50 to-orange-950/50 border-2 border-amber-500/50 rounded-3xl p-8 md:p-12 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-full px-6 py-2 mb-6">
                <Flame className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 font-bold text-sm">RESUMO FINAL</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-8">
                A MRO Inteligente V7+ Plus é uma <span className="text-amber-400">máquina de crescimento e vendas</span> no Instagram
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { emoji: "👉", label: "Automática", desc: "Funciona 24/7" },
                  { emoji: "👉", label: "Inteligente", desc: "IA exclusiva" },
                  { emoji: "👉", label: "Escalável", desc: "Sem limites" },
                  { emoji: "👉", label: "Sem limites", desc: "Uso ilimitado" },
                ].map((item, i) => (
                  <div key={i} className="bg-black/40 border border-amber-500/20 rounded-xl p-4">
                    <span className="text-2xl">{item.emoji}</span>
                    <p className="text-white font-bold mt-2">{item.label}</p>
                    <p className="text-gray-500 text-xs mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Guarantee Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-green-950/80 to-black border-2 border-green-500/50 rounded-3xl p-8 md:p-14 text-center shadow-2xl shadow-green-500/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-center mb-6">
              <div className="absolute w-28 h-28 rounded-full bg-green-500/10 animate-ping pointer-events-none" style={{animationDuration: '3s'}} />
              <div className="relative w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center">
                <Shield className="w-12 h-12 text-green-400" />
              </div>
            </div>
            <span className="text-green-400 font-bold text-xs tracking-[0.3em] uppercase">GARANTIA TOTAL</span>
            <h2 className="text-3xl md:text-5xl font-black mt-3 mb-6 leading-tight">
              30 Dias de Resultados <span className="text-green-400">Garantidos</span>
            </h2>
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl px-6 py-5 max-w-2xl mx-auto mb-8">
              <p className="text-white text-lg md:text-xl leading-relaxed">
                Se em <strong className="text-green-400">30 dias</strong> não tiver os resultados prometidos, <strong className="text-white">devolvemos o seu dinheiro.</strong>
              </p>
              <p className="text-green-300 font-bold text-lg mt-2">Nós garantimos resultados. Sem risco para você.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
              {[
                { emoji: "🔒", label: "Compra 100% Segura" },
                { emoji: "💰", label: "Reembolso Garantido" },
                { emoji: "✅", label: "Satisfação ou Dinheiro de Volta" }
              ].map((item, i) => (
                <div key={i} className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-2 justify-center">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-green-300 text-sm font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-sm">Garantia válida por 30 dias após a data da compra.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={pricingRef} className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center mb-3 sm:mb-4">
            <span className="text-green-400">OFERTA ESPECIAL</span>
          </h2>
          {getExpirationText() && (
            <p className="text-center text-gray-400 mb-8 sm:mb-10 text-base sm:text-lg">
              ⏰ {getExpirationText()}
            </p>
          )}
          
          {/* Pricing Card */}
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-green-500 rounded-2xl sm:rounded-3xl p-5 sm:p-8 relative overflow-hidden">
            {/* Badge */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold px-4 sm:px-6 py-1.5 sm:py-2 rounded-b-xl text-xs sm:text-sm whitespace-nowrap">
                🔥 PROMOÇÃO ALUNOS {affiliate.name.toUpperCase()}
              </div>
            </div>
            
            <div className="text-center mt-6 sm:mt-6 mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4">Plano Anual Completo</h3>
              
              {/* Price Display - Updated Layout */}
              <div className="mb-2">
                <span className="text-gray-500 line-through text-lg sm:text-2xl">De R$497</span>
              </div>
              
              <div className="text-base sm:text-lg text-gray-300 mb-2">POR APENAS</div>
              
              {/* Main price - R$41 bigger */}
              <div className="text-green-400 mb-1">
                <span className="text-base sm:text-lg text-gray-400">12x de</span>{" "}
                <span className="text-5xl sm:text-6xl md:text-7xl font-black">R$41</span>
              </div>
              
              {/* À vista price below */}
              <div className="text-green-400/80 mb-3">
                <span className="text-xl sm:text-2xl font-bold">ou R$397 à vista no PIX</span>
              </div>
              
              <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/50 rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
                <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                <span className="text-red-400 font-bold text-sm sm:text-base">R$100 OFF DE DESCONTO!</span>
              </div>
            </div>
            
            {/* Features */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              {planFeatures.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0 mt-0.5" />
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
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-base sm:text-xl py-5 sm:py-7 rounded-xl shadow-lg shadow-green-500/30 disabled:opacity-50"
            >
              {promoTimeLeft.expired ? "PROMOÇÃO EXPIRADA" : "QUERO GARANTIR AGORA"}
            </Button>
            
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

      {/* Countdown Timer Section */}
      <section className="py-8 sm:py-12 px-3 sm:px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4">
            {promoTimeLeft.days > 0 && (
              <>
                <div className="bg-gradient-to-b from-red-600 to-red-800 rounded-lg p-2 sm:p-3 min-w-[50px] sm:min-w-[65px]">
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold font-mono">
                    {String(promoTimeLeft.days).padStart(2, '0')}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-red-200">DIAS</div>
                </div>
                <span className="text-lg sm:text-xl font-bold text-red-500">:</span>
              </>
            )}
            <div className="bg-gradient-to-b from-red-600 to-red-800 rounded-lg p-2 sm:p-3 min-w-[50px] sm:min-w-[65px]">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold font-mono">
                {String(promoTimeLeft.hours).padStart(2, '0')}
              </div>
              <div className="text-[9px] sm:text-[10px] text-red-200">HORAS</div>
            </div>
            <span className="text-lg sm:text-xl font-bold text-red-500">:</span>
            <div className="bg-gradient-to-b from-red-600 to-red-800 rounded-lg p-2 sm:p-3 min-w-[50px] sm:min-w-[65px]">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold font-mono">
                {String(promoTimeLeft.minutes).padStart(2, '0')}
              </div>
              <div className="text-[9px] sm:text-[10px] text-red-200">MINUTOS</div>
            </div>
            <span className="text-lg sm:text-xl font-bold text-red-500">:</span>
            <div className="bg-gradient-to-b from-red-600 to-red-800 rounded-lg p-2 sm:p-3 min-w-[50px] sm:min-w-[65px]">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold font-mono">
                {String(promoTimeLeft.seconds).padStart(2, '0')}
              </div>
              <div className="text-[9px] sm:text-[10px] text-red-200">SEGUNDOS</div>
            </div>
          </div>
          
          {getExpirationText() && (
            <p className="text-yellow-400 text-sm sm:text-base font-medium">
              ⏰ {getExpirationText()}
            </p>
          )}
        </div>
      </section>

      {/* Garantia */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-black">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl sm:rounded-2xl p-5 sm:p-8">
            <div className="flex flex-col items-center gap-4 sm:gap-6 text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-green-400" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-green-400 mb-2 sm:mb-3">
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

      {/* O QUE VOCÊ VAI RECEBER */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center mb-10 sm:mb-16">
            O QUE VOCÊ VAI <span className="text-green-400">RECEBER</span>
          </h2>

          {/* IA Section */}
          <div className="mb-10 sm:mb-16">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2">
                <span className="font-bold text-xs sm:text-sm">NOVO</span>
              </div>
              <h3 className="text-lg sm:text-2xl md:text-3xl font-bold">
                Inteligência artificial automática
              </h3>
            </div>
            
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-8">
              <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                {iaFeatures.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm sm:text-base">{feature}</span>
                  </div>
                ))}
              </div>
              <p className="text-green-400 font-medium mt-4 sm:mt-6 text-center text-sm sm:text-lg">
                Tudo isso personalizado para você, em segundos!
              </p>
            </div>
          </div>

          {/* MRO Principal */}
          <div className="mb-10 sm:mb-16">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div className="bg-green-500 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2">
                <span className="font-bold text-black text-xs sm:text-sm">PRINCIPAL</span>
              </div>
              <h3 className="text-lg sm:text-2xl md:text-3xl font-bold">
                FERRAMENTA MRO
              </h3>
            </div>
            
            <div className="bg-gray-900/50 border border-green-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-8">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {mroFeatures.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4 bg-gray-800/50 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                    </div>
                    <span className="font-medium text-sm sm:text-base">{feature.title}</span>
                  </div>
                ))}
              </div>
              
              <p className="text-gray-400 mt-6 sm:mt-8 text-center max-w-3xl mx-auto text-sm sm:text-base">
                Tudo isso em alta escala, todos os dias, atraindo um novo público real e interessado em você.
              </p>
              
              <div className="mt-4 sm:mt-6 text-center">
                <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-full px-4 sm:px-6 py-2 sm:py-3">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                  <span className="text-green-400 font-bold text-xs sm:text-sm">Resultados comprovados em até 7 horas de uso!</span>
                </div>
              </div>
            </div>
          </div>

          {/* Area de Membros */}
          <div className="mb-10 sm:mb-16">
            <h3 className="text-lg sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6">
              ÁREA DE MEMBROS <span className="text-green-400">VITALÍCIA</span>
            </h3>
            
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-8">
              <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                {areaMembroFeatures.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 sm:gap-3">
                    <Video className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm sm:text-base">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grupo VIP */}
          <div className="mb-10 sm:mb-16">
            <h3 className="text-lg sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6">
              GRUPO VIP DE <span className="text-green-400">SUPORTE E NETWORKING</span>
            </h3>
            
            <div className="bg-gray-900/50 border border-green-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-8">
              <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                {grupoVipFeatures.map((feature, i) => (
                  <div key={i} className="flex items-start gap-2 sm:gap-3">
                    <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300 text-sm sm:text-base">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BÔNUS INCLUSOS */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center mb-10 sm:mb-16">
            + <span className="text-green-400">BÔNUS INCLUSOS</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-6 mb-10">
            {/* Bônus 1 */}
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-green-500/30 rounded-xl p-5 sm:p-6">
              <div className="bg-green-500 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <Brain className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-center text-lg sm:text-xl font-bold mb-2 text-green-400">BÔNUS #1</h3>
              <h4 className="text-center text-base sm:text-lg font-bold mb-3">Análise de I.A Completa</h4>
              <p className="text-gray-400 text-sm text-center">
                Nossa inteligência artificial analisa seu perfil em profundidade: bio, posts, engajamento e identifica todas as oportunidades de melhoria baseado no seu nicho.
              </p>
            </div>

            {/* Bônus 2 */}
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-green-500/30 rounded-xl p-5 sm:p-6">
              <div className="bg-green-500 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <Calendar className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-center text-lg sm:text-xl font-bold mb-2 text-green-400">BÔNUS #2</h3>
              <h4 className="text-center text-base sm:text-lg font-bold mb-3">Acompanhamento Anual</h4>
              <p className="text-gray-400 text-sm text-center">
                Suporte e acompanhamento durante todo o ano para garantir que você está sempre evoluindo e alcançando seus objetivos de crescimento.
              </p>
            </div>

            {/* Bônus 3 */}
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-green-500/30 rounded-xl p-5 sm:p-6">
              <div className="bg-green-500 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <RefreshCw className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-center text-lg sm:text-xl font-bold mb-2 text-green-400">BÔNUS #3</h3>
              <h4 className="text-center text-base sm:text-lg font-bold mb-3">Estratégias Mensais (30 em 30 dias)</h4>
              <p className="text-gray-400 text-sm text-center">
                A cada 30 dias você recebe uma nova estratégia personalizada baseada no seu nicho e nos resultados do mês anterior.
              </p>
            </div>
          </div>

          {/* Mais recursos da I.A */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl sm:rounded-2xl p-5 sm:p-8 mb-6">
            <h3 className="text-lg sm:text-xl font-bold mb-6 text-center">
              E mais recursos da <span className="text-green-400">I.A da MRO</span>
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base">Ideias de Conteúdo Ilimitadas</h4>
                  <p className="text-gray-400 text-sm">Dezenas de ideias de posts, reels e stories alinhadas com seu nicho</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base">Scripts de Vendas</h4>
                  <p className="text-gray-400 text-sm">Scripts prontos e gatilhos mentais para transformar seguidores em clientes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BÔNUS GRÁTIS - Fature R$5.000 */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-2 border-yellow-500/50 rounded-2xl p-6 sm:p-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/50 rounded-full px-4 py-2 mb-4">
                <Gift className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-bold text-sm sm:text-base">BÔNUS GRÁTIS</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold mb-4">
                FAÇA MAIS DE <span className="text-green-400">5 MIL MENSAL</span> PRESTANDO SERVIÇO COM ESSA FERRAMENTA
              </h2>
              <p className="text-gray-300 text-sm sm:text-base max-w-3xl mx-auto mb-4">
                Rode esse sistema para outras empresas e fature mensalmente por isso!
              </p>
            </div>

            <div className="space-y-4 text-gray-300 text-sm sm:text-base mb-6">
              <p>
                Temos um método completo no qual você pode prestar serviços utilizando essa ferramenta, fechando contratos com empresas que buscam engajamento, clientes e vendas.
              </p>
              <p>
                Você roda a ferramenta para o cliente, cobra uma mensalidade, e gera uma renda recorrente. Tudo pode ser feito de qualquer lugar do mundo com seu notebook.
              </p>
              <p>
                Para quem deseja oferecer esse serviço, entregamos <strong className="text-white">4 contas vitalícias + 5 testes grátis por mês</strong> (de 1 dia cada).
              </p>
              <p>
                Esses testes servem para apresentar o serviço: você roda a ferramenta por 1 dia, o cliente vê o resultado e você fecha um contrato mensal com ele.
              </p>
            </div>

            {/* Video de como faturar */}
            <div 
              onClick={() => openVideo("WQwnAHNvSMU")}
              className="relative rounded-xl overflow-hidden cursor-pointer group shadow-xl mb-6 max-w-2xl mx-auto"
            >
              <img 
                src="https://img.youtube.com/vi/WQwnAHNvSMU/maxresdefault.jpg" 
                alt="Video Como Faturar" 
                className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                  <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white ml-1" fill="white" />
                </div>
              </div>
              <div className="absolute bottom-2 left-2 right-2 text-center">
                <span className="bg-black/70 text-white text-xs sm:text-sm px-3 py-1 rounded-full">
                  🎬 VÍDEO: COMO FATURAR COM A MRO
                </span>
              </div>
            </div>

            <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 sm:p-6 text-center mb-4">
              <DollarSign className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 font-bold text-lg sm:text-xl">
                OU SEJA, VOCÊ PODE FATURAR MAIS DE R$5.000,00 POR MÊS PRESTANDO SERVIÇO COM ESSA FERRAMENTA!
              </p>
            </div>

            <p className="text-gray-400 text-sm text-center">
              Caso precise de mais contas no futuro, cobramos R$150 por conta adicional para quem já utiliza o sistema.
            </p>
          </div>
        </div>
      </section>

      {/* Video de Apresentação */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6">
            CONFIRA UMA APRESENTAÇÃO DE COMO DESENVOLVEMOS ESSA SOLUÇÃO:
          </h2>
          <p className="text-gray-400 mb-8">
            Está pronto para começar? Entre em contato e garanta seu acesso vitalício agora mesmo!
          </p>
          
          <Button 
            onClick={scrollToPricing}
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-sm sm:text-lg px-6 sm:px-10 py-5 sm:py-6 rounded-full shadow-lg shadow-green-500/30"
          >
            GARANTIR MEU ACESSO <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-10 sm:mb-12">
            Perguntas <span className="text-green-400">Frequentes</span>
          </h2>

          <div className="space-y-4">
            {[
              {
                question: "Quais são os planos disponíveis hoje?",
                answer: "Oferecemos o Plano Anual Completo que inclui acesso à ferramenta MRO, 4 contas simultâneas, 5 testes mensais, área de membros, grupo VIP e todos os bônus exclusivos."
              },
              {
                question: "Por que interagir em massa vai me ajudar?",
                answer: "A interação em massa com perfis estratégicos do seu nicho faz com que mais pessoas vejam seu perfil, aumentando naturalmente seu alcance, engajamento e seguidores qualificados."
              },
              {
                question: "Mas isso traz vendas, ou só seguidores?",
                answer: "Traz vendas! Quando você interage com pessoas do seu nicho que têm interesse no que você oferece, elas vêm até seu perfil e se tornam potenciais clientes. Diferente de seguidores comprados, esses são reais e interessados."
              },
              {
                question: "Isso em massa não gera bloqueio?",
                answer: "Não! Nossa ferramenta foi desenvolvida para respeitar os limites do Instagram, com intervalos e comportamentos humanizados. Milhares de usuários usam diariamente sem problemas."
              },
              {
                question: "Funciona só em computador?",
                answer: "Sim, nossa ferramenta é compatível apenas com computadores de mesa, notebooks ou MacBooks. Não funciona em celulares, tablets ou dispositivos móveis."
              }
            ].map((faq, i) => (
              <details key={i} className="group bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between gap-4 p-4 sm:p-5 cursor-pointer list-none">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base">{faq.question}</span>
                  </div>
                  <ChevronDown className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                </summary>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
                  <p className="text-gray-400 text-sm sm:text-base ml-8">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Ainda está com dúvidas? */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">
            Ainda está com <span className="text-green-400">dúvidas?</span>
          </h2>
          <p className="text-gray-400 mb-8 text-sm sm:text-base">
            Veja no vídeo abaixo como nossa ferramenta pode transformar seus resultados sem gastar com anúncios pagos
          </p>

          {/* Resultados cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            <div className="bg-gray-900/50 border border-green-500/30 rounded-xl p-5">
              <TrendingUp className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-2">Resultados Rápidos</h3>
              <p className="text-gray-400 text-sm">Em apenas 7 horas utilizando nossa ferramenta você já começa a ver os primeiros resultados no seu negócio</p>
            </div>
            <div className="bg-gray-900/50 border border-green-500/30 rounded-xl p-5">
              <Heart className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-2">Engajamento Garantido</h3>
              <p className="text-gray-400 text-sm">Aumente significativamente o engajamento do seu público sem depender de algoritmos ou anúncios pagos</p>
            </div>
            <div className="bg-gray-900/50 border border-green-500/30 rounded-xl p-5">
              <ShoppingCart className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-2">Mais Vendas</h3>
              <p className="text-gray-400 text-sm">Método comprovado que gera clientes e aumenta suas vendas de forma consistente e previsível</p>
            </div>
          </div>

          {/* Nota de compatibilidade */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 flex items-center justify-center gap-3">
            <Monitor className="w-5 h-5 text-gray-400" />
            <p className="text-gray-400 text-xs sm:text-sm">
              <strong className="text-white">Nota:</strong> Nossa ferramenta é compatível apenas com computadores de mesa, notebooks ou MacBooks. Não funciona em celulares, tablets ou dispositivos móveis.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA - Pronto para Escalar? */}
      <section className="py-10 sm:py-16 px-3 sm:px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-6">
            Pronto para <span className="text-green-400">Escalar seu Instagram?</span>
          </h2>
          
          <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 sm:mb-8">
            <Timer className="w-6 h-6 sm:w-8 sm:h-8 text-red-500 animate-pulse" />
            <span className="text-base sm:text-xl font-bold">
              Oferta expira em{" "}
              <span className="text-red-500 font-mono">
                {promoTimeLeft.expired ? "EXPIRADO" : 
                  promoTimeLeft.days > 0 
                    ? `${promoTimeLeft.days}D ${String(promoTimeLeft.hours).padStart(2, '0')}:${String(promoTimeLeft.minutes).padStart(2, '0')}:${String(promoTimeLeft.seconds).padStart(2, '0')}`
                    : `${String(promoTimeLeft.hours).padStart(2, '0')}:${String(promoTimeLeft.minutes).padStart(2, '0')}:${String(promoTimeLeft.seconds).padStart(2, '0')}`
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
            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-sm sm:text-xl px-6 sm:px-12 py-5 sm:py-7 rounded-full shadow-lg shadow-green-500/30 disabled:opacity-50"
          >
            {promoTimeLeft.expired ? "PROMOÇÃO EXPIRADA" : "GARANTIR MEU DESCONTO DE R$100"}
          </Button>
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
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-green-500/30 rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 relative my-4">
            <button 
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            <div className="text-center mb-4 sm:mb-6">
              <h3 className="text-xl sm:text-2xl font-bold mb-2">Finalize seu Cadastro</h3>
              <div className="text-gray-400 text-sm">12x de</div>
              <div className="text-3xl sm:text-4xl font-bold text-green-400">
                R$41
              </div>
              <p className="text-gray-400 text-xs sm:text-sm">ou R$397 à vista no PIX</p>
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
                <div className="relative">
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => validateUsername(e.target.value)}
                    placeholder="seunome"
                    className={`bg-gray-800 border-gray-700 text-white text-sm sm:text-base pr-10 ${
                      usernameError ? 'border-red-500' : 
                      usernameAvailable === true ? 'border-green-500' : ''
                    }`}
                    required
                  />
                  {checkingUsername && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  )}
                  {!checkingUsername && usernameAvailable === true && username.length >= 4 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-4 h-4 text-red-500" />
                    </div>
                  )}
                </div>
                {usernameError && (
                  <p className="text-red-400 text-[10px] sm:text-xs mt-1">{usernameError}</p>
                )}
                {checkingUsername && !usernameError && (
                  <p className="text-yellow-400 text-[10px] sm:text-xs mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando disponibilidade...
                  </p>
                )}
                {!checkingUsername && !usernameError && usernameAvailable === true && username.length >= 4 && (
                  <p className="text-green-400 text-[10px] sm:text-xs mt-1">✓ Usuário disponível!</p>
                )}
                {!checkingUsername && !usernameError && usernameAvailable === null && username.length < 4 && (
                  <p className="text-gray-500 text-[10px] sm:text-xs mt-1">
                    Apenas letras minúsculas, sem espaços ou números
                  </p>
                )}
              </div>
              
              <Button
                type="submit"
                disabled={checkoutLoading || promoTimeLeft.expired}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-5 sm:py-6 rounded-xl text-sm sm:text-base"
              >
                {checkoutLoading ? (
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

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-3 sm:px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-xs sm:text-sm">
          <p>© 2025 MRO - Mais Resultados Online. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default OfficialPartnerPromo;
