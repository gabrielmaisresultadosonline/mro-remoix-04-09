import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView, trackLead, trackInitiateCheckout, trackPurchase } from "@/lib/facebookTracking";
import { openWhatsAppChat } from "@/lib/whatsapp";
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
  Send,
  Filter,
  TrendingUp,
  BarChart3,
  FileText,
  Rocket,
  Crown,
  Flame,
  MousePointerClick,
  ShoppingCart
} from "lucide-react";
import logoMro from "@/assets/logo-mro.png";
import zeroAnunciosBanner from "@/assets/zero-anuncios-banner.png";
// import ActiveClientsSection from "@/components/ActiveClientsSection"; // Removed as requested
import FloatingWhatsAppHelp from "@/components/FloatingWhatsAppHelp";
import { MessageCircle as WhatsAppIcon } from "lucide-react";

interface SalesSettings {
  whatsappNumber: string;
  whatsappMessage: string;
  ctaButtonText: string;
}

const PLANS = {
  trial: { name: "Teste 30 Dias", price: 97.00, days: 30, installment: "97", accounts: 4 },
};

const InstagramPromo30Dias = () => {
  const [searchParams] = useSearchParams();
  const partnerSlug = searchParams.get('p');
  const [partner, setPartner] = useState<{id: string, name: string} | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [timeLeft, setTimeLeft] = useState({ hours: 47, minutes: 59, seconds: 59 });
  const [promoTimeLeft, setPromoTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, expired: false });
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showBonusDetails, setShowBonusDetails] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);
  const [salesSettings, setSalesSettings] = useState<SalesSettings>({
    whatsappNumber: '+55 51 9203-6540',
    whatsappMessage: 'Gostaria de saber sobre a promoção.',
    ctaButtonText: 'Gostaria de aproveitar a promoção'
  });
  
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"trial">("trial");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimeoutRef = useRef<any | null>(null);
  const [loading, setLoading] = useState(false);

  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean | null> => {
    if (usernameToCheck.length < 4) { setUsernameAvailable(null); return null; }
    setCheckingUsername(true);
    try {
      const body = new URLSearchParams({ nome: usernameToCheck, numero: usernameToCheck });
      const response = await fetch('https://dashboardmroinstagramvini-online.squareweb.app/verificar-numero', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setUsernameAvailable(null); return null; }
      if (data?.senhaCorrespondente === true) { setUsernameAvailable(false); setUsernameError("Usuário já em uso. Utilize outro usuário"); return false; }
      if (data?.senhaCorrespondente === false) { setUsernameAvailable(true); setUsernameError((prev) => prev === "Usuário já em uso. Utilize outro usuário" ? "" : prev); return true; }
      setUsernameAvailable(null); return null;
    } catch { setUsernameAvailable(null); return null; } finally { setCheckingUsername(false); }
  };

  const validateUsername = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
    setUsername(cleaned); setUsernameAvailable(null);
    if (usernameCheckTimeoutRef.current) clearTimeout(usernameCheckTimeoutRef.current);
    if (value !== cleaned) { setUsernameError("Apenas letras minúsculas, sem espaços ou números"); return; }
    else if (cleaned.length < 4) { setUsernameError("Mínimo de 4 caracteres"); return; }
    else if (cleaned.length > 20) { setUsernameError("Máximo de 20 caracteres"); return; }
    setUsernameError("");
    usernameCheckTimeoutRef.current = setTimeout(() => { void checkUsernameAvailability(cleaned); }, 500);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { toast.error("Por favor, insira um email válido"); return; }
    if (!phone || phone.replace(/\D/g, "").length < 10) { toast.error("Por favor, insira um celular válido com DDD"); return; }
    if (!username || username.length < 4) { toast.error("Nome de usuário deve ter no mínimo 4 caracteres"); return; }
    if (usernameError) { toast.error(usernameError); return; }
    if (checkingUsername) { toast.error("Aguarde a verificação do usuário"); return; }
    const availability = usernameAvailable ?? (await checkUsernameAvailability(username.toLowerCase().trim()));
    if (availability === false) { toast.error("Este nome de usuário já está em uso. Escolha outro."); return; }
    setLoading(true);
    try {
      const plan = PLANS[selectedPlan];
      
      // Email attribution logic for tracking
      const attributedEmail = partnerSlug 
        ? `${partnerSlug}:${email.toLowerCase().trim()}`
        : email.toLowerCase().trim();

      const { data: checkData, error: checkError } = await supabase.functions.invoke("create-mro-checkout", {
        body: { 
          email: attributedEmail, 
          username: username.toLowerCase().trim(), 
          phone: phone.replace(/\D/g, "").trim(), 
          planType: selectedPlan, 
          amount: plan.price, 
          checkUserExists: true,
          partner_id: partner?.id || null
        }
      });
      if (checkError) { console.error("Error creating checkout:", checkError); toast.error("Erro ao criar link de pagamento. Tente novamente."); return; }
      if (checkData.userExists) { toast.error("Este nome de usuário já está em uso. Escolha outro."); setUsernameError("Usuário já existe, escolha outro"); return; }
      if (!checkData.success) { toast.error(checkData.error || "Erro ao criar pagamento"); return; }
      // Track initiate checkout intent (Lead) - this is correct as it happens before payment
      trackInitiateCheckout(`Plano ${plan.name}`, plan.price);
      window.location.href = checkData.payment_link;
    } catch (error) { console.error("Error:", error); toast.error("Erro ao processar. Tente novamente."); } finally { setLoading(false); }
  };

  useEffect(() => { trackPageView('Sales Page - Instagram MRO - Nova'); }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('modules-storage', { body: { action: 'load-call-settings' } });
        if (!error && data?.success && data?.data?.salesPageSettings) setSalesSettings(data.data.salesPageSettings);
        
        // Also load global WhatsApp settings
        const { data: waData } = await supabase.from('whatsapp_page_settings').select('whatsapp_number').limit(1).single();
        if (waData?.whatsapp_number) {
          setSalesSettings(prev => ({
            ...prev,
            whatsappNumber: waData.whatsapp_number
          }));
        }
      } catch (err) { console.error('Error loading sales settings:', err); }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const loadPartner = async () => {
      if (!partnerSlug) return;
      const { data } = await supabase
        .from('partners')
        .select('id, name')
        .eq('slug', partnerSlug)
        .eq('status', 'active')
        .single();
      
      if (data) {
        setPartner(data);
        // Track visit if partner found
        await supabase.from('partner_visits').insert([{
          partner_id: data.id,
          user_agent: navigator.userAgent,
          referer: document.referrer
        }]);
      }
    };
    loadPartner();
  }, [partnerSlug]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 47, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const promoEndDate = new Date('2026-01-06T16:00:00-03:00');
    const updatePromoCountdown = () => {
      const now = new Date();
      const diff = promoEndDate.getTime() - now.getTime();
      if (diff <= 0) { setPromoTimeLeft({ days: 0, hours: 0, minutes: 0, expired: true }); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setPromoTimeLeft({ days, hours, minutes, expired: false });
    };
    updatePromoCountdown();
    const timer = setInterval(updatePromoCountdown, 60000);
    return () => clearInterval(timer);
  }, []);

  const scrollToPricing = () => { pricingRef.current?.scrollIntoView({ behavior: 'smooth' }); };
  const openVideo = (url: string) => { setCurrentVideoUrl(url); setShowVideoModal(true); };

  const annualFeatures = [
    "Ferramenta completa para Instagram",
    "Acesso a 4 contas simultâneas fixas",
    "5 testes todo mês para testar em seus clientes/outras contas",
    "Área de membros por 1 ano",
    "Vídeos estratégicos passo a passo",
    "Grupo VIP no WhatsApp",
    "Suporte prioritário"
  ];

  const lifetimeFeatures = [
    "Ferramenta completa para Instagram",
    "Acesso a 6 contas simultâneas fixas",
    "5 testes todo mês para testar em seus clientes/outras contas",
    "Área de membros VITALÍCIA",
    "Vídeos estratégicos passo a passo",
    "Grupo VIP no WhatsApp",
    "Suporte prioritário",
    "Atualizações gratuitas para sempre"
  ];

  const affiliateBonus = "Cadastro Afiliado - Comissão de R$97 Por venda";

  const faqs = [
    { q: "Quais são os planos disponíveis hoje?", a: "Oferecemos duas opções de planos anuais: Plano Pro (4 contas fixas + 5 testes mensais) e Plano Agência (10 contas fixas + 10 testes mensais). Ambos os planos são assinaturas anuais que garantem acesso total à ferramenta e suporte especializado." },
    { q: "O que é a automação de Direct (DM) em massa?", a: "É uma funcionalidade exclusiva da V7+ Plus que permite enviar mensagens automáticas no Direct para novos seguidores, seus seguidores atuais e até seguidores de qualquer outra página — tudo com copy otimizada pelo Corretor de IA exclusivo MRO." },
    { q: "O que são os Filtros Inteligentes (Público Quente)?", a: "São filtros avançados de segmentação que identificam pessoas que já demonstraram interesse no seu nicho — como quem curtiu posts, comentou ou segue perfis concorrentes. Isso garante mais precisão, mais respostas e mais conversões." },
    { q: "Isso em massa não gera bloqueio?", a: "Não. Nosso sistema simula um humano com tela ligada, interações espaçadas e pausas naturais. Você deixa rodando por 7 a 8 horas diárias com segurança. O algoritmo entende como uso real, evitando bloqueios." },
    { q: "Funciona só em computador?", a: "Sim, nossa ferramenta é compatível apenas com computadores de mesa, notebooks ou MacBooks. Não funciona em celulares, tablets ou dispositivos móveis." },
    { q: "Como funciona a IA exclusiva da MRO?", a: "Nossa IA analisa seu perfil completo, gera estratégias de conteúdo, engajamento e vendas, otimiza sua BIO e entrega relatórios de acompanhamento — tudo personalizado para o seu nicho." },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Expired Discount Popup - REMOVED TO PREVENT BLACK SCREEN ISSUES */}
      {/* 
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
        <div className="relative max-w-md w-full bg-gradient-to-br from-gray-900 to-black border border-red-500/40 rounded-2xl p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-black mb-3 text-white">Esse desconto acabou</h2>
          <p className="text-gray-300 mb-6">
            A promoção desta página foi encerrada. Acesse a página principal para conhecer as ofertas disponíveis.
          </p>
          <a
            href="/instagram-nova"
            className="inline-flex items-center justify-center gap-2 w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 font-bold text-black hover:opacity-90 transition-opacity"
          >
            Acessar página principal
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </div>
      */}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logoMro} alt="MRO" className="h-10 object-contain" />
          <div className="flex items-center gap-3">
            <a
              href="/instagram"
              className="rounded-full border border-amber-500/60 bg-amber-500/10 px-4 py-1.5 text-xs sm:text-sm font-bold text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              Fazer Login
            </a>
            <Button 
              onClick={scrollToPricing}
              className="bg-[#39FF14] hover:bg-[#32e612] text-black font-black text-xs sm:text-sm px-4 shadow-[0_0_15px_rgba(57,255,20,0.4)]"
            >
              Garantir Acesso
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-8 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[60px] md:blur-[60px] md:blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-[50px] md:blur-[50px] md:blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-40 bg-gradient-to-t from-purple-500/5 to-transparent" />
        </div>
        <div className="max-w-5xl mx-auto text-center relative">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 blur-3xl rounded-full" />
            <h1 className="relative text-4xl md:text-6xl lg:text-8xl font-[1000] mb-2 leading-tight tracking-tighter filter drop-shadow-[0_0_1px_rgba(255,255,255,0.8)]">
               <span className="bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent">NÃO GASTE MAIS COM ANÚNCIOS</span>
             </h1>
             <h2 className="relative text-2xl md:text-4xl lg:text-5xl font-[1000] mb-4">
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-clip-text text-transparent uppercase tracking-tight">
                Utilize a MRO Inteligente!
              </span>
            </h2>
            
            <div className="relative mt-4 mb-4 flex flex-col items-center">
              <div className="inline-flex items-center gap-2 bg-amber-400 border border-amber-500 rounded-full px-6 py-2 mb-1 shadow-[0_0_15px_rgba(251,191,36,0.4)]">
                <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
                <span className="text-black font-bold text-base tracking-wide uppercase">Apenas R$97</span>
              </div>
            </div>

            <p className="relative mt-2 text-sm md:text-base text-gray-400">
              Instale em seu notebook, macbook ou computador de mesa!
            </p>
          </div>

          <div className="mt-6 max-w-4xl mx-auto" id="hero-video">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
              <iframe
                src="https://www.youtube.com/embed/lecSwt54sa0?rel=0&modestbranding=1"
                title="Video MRO"
                className="w-full aspect-video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>



          <div className="mt-10 animate-bounce">
            <ChevronDown className="w-10 h-10 text-gray-500 mx-auto" />
          </div>
        </div>
      </section>

      {/* Active Clients section removed as requested */}


      <div className="py-16 text-center bg-zinc-900/40 border-y border-zinc-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4">
          <h3 className="text-2xl md:text-4xl font-black text-white mb-4 leading-tight">
            TESTE A FERRAMENTA COMPLETA <br className="hidden md:block" />
            <span className="text-emerald-400">POR APENAS R$97</span>
          </h3>
          <p className="text-gray-400 mb-8 text-lg">4 contas por 30 dias — teste agora sem compromisso</p>
          <Button 
            onClick={scrollToPricing}
            className="bg-[#39FF14] hover:bg-[#32e612] text-black font-black px-12 py-7 rounded-full text-lg shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all hover:scale-105"
          >
            R$97 — TESTAR AGORA
          </Button>
        </div>
      </div>
      <section className="py-20 px-4 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 rounded-full px-6 py-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-bold text-sm">O QUE HÁ DE NOVO</span>
            </div>
            <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto mb-2">
              Totalmente otimizada com mais automação, mais inteligência e mais resultados
            </p>
            <p className="text-2xl md:text-3xl font-black mt-4 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              🎁 O que você vai receber no Plano MRO!
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-8 md:p-12 text-left space-y-8">
            <div>
              <h3 className="text-xl font-black text-blue-400 mb-4">NOVO: Automação de Direct (DM) em Massa</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Envio automático para novos seguidores</li>
                <li>• Envio para seus seguidores atuais</li>
                <li>• Envio para seguidores de qualquer página</li>
                <li>• Copy otimizada com Corretor de IA exclusivo MRO</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-black text-purple-400 mb-4">NOVO: Filtros Inteligentes (Público Quente)</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Segmentação avançada para atingir quem realmente tem interesse</li>
                <li>• Mais precisão = mais respostas e conversões</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-black text-amber-400 mb-4">PRINCIPAL: Automação Completa de Crescimento</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Seguir em massa</li>
                <li>• Curtir fotos automaticamente</li>
                <li>• Curtir stories</li>
                <li>• Deixar de seguir</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-black text-green-400 mb-4">AVANÇADO: Captura Avançada de Público</h3>
              <p className="text-gray-400 mb-3">Extraia leads altamente qualificados:</p>
              <ul className="space-y-2 text-gray-300">
                <li>• Pessoas que curtem posts</li>
                <li>• Pessoas que comentam</li>
                <li>• Seguidores de qualquer perfil</li>
                <li>• Quem o perfil está seguindo</li>
              </ul>
              <p className="mt-4 text-green-400 font-bold">👉 Você atinge exatamente quem já demonstra interesse.</p>
            </div>

            <div>
              <h3 className="text-xl font-black text-pink-400 mb-4">IA EXCLUSIVA: Inteligência Artificial Exclusiva</h3>
              <p className="text-gray-400 mb-3">A MRO V7+ vai além da automação:</p>
              <ul className="space-y-2 text-gray-300">
                <li>• Análise completa do seu perfil</li>
                <li>• Estratégias de conteúdo</li>
                <li>• Estratégias de engajamento</li>
                <li>• Estratégias de vendas</li>
                <li>• Otimização da BIO</li>
                <li>• Relatórios e acompanhamento</li>
              </ul>
            </div>
          </div>
        </div>
      </section>



      <div className="py-20 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none blur-3xl rounded-full translate-x-1/2" />
        <div className="max-w-5xl mx-auto px-4 relative z-10 text-center">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 md:p-12">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6">
              Teste por <span className="text-emerald-400">30 dias</span> sem compromisso
            </h2>
            <p className="text-gray-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
              Libere o poder da automação e IA no seu Instagram hoje mesmo. Teste em 4 contas por 30 dias.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <div className="text-left">
                <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest mb-1">Início imediato</p>
                <p className="text-white text-2xl font-black">Apenas <span className="text-emerald-400">R$97</span> / 30 dias</p>
              </div>
              <div className="h-12 w-px bg-zinc-800 hidden md:block" />
              <Button 
                onClick={scrollToPricing}
                className="bg-[#39FF14] hover:bg-[#32e612] text-black font-black px-12 py-7 rounded-full text-lg shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all hover:scale-105"
              >
                R$97 — TESTE AGORA
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <section ref={pricingRef} className="py-20 px-4 bg-black relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">

          <div className="text-center mb-12">
            <span className="inline-block bg-amber-500/10 text-amber-500 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
              Promoção Especial
            </span>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              TESTE POR <span className="text-amber-400">30 DIAS</span>
            </h2>
            <p className="text-gray-400 text-lg mb-6">
              Apenas <span className="text-amber-400 font-black">R$97</span> — teste a ferramenta completa por 30 dias em até 4 contas
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 max-w-xl mx-auto">
            {/* Plano Teste 30 Dias */}
            <div className="relative bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl transition-all hover:scale-[1.03] z-10 border-amber-500 ring-4 ring-amber-500/20">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap">⭐ TESTE 30 DIAS</div>
              </div>
              <h3 className="text-3xl font-black mb-2 text-center text-amber-400 mt-2">Plano Teste 30 Dias</h3>
              <p className="text-gray-400 text-center mb-6 text-sm">4 contas por 30 dias</p>
              <div className="text-center mb-6">
                <div className="text-6xl sm:text-7xl font-[1000] text-amber-400">R$97</div>
                <div className="flex items-baseline justify-center gap-1 mt-2">
                  <span className="text-lg sm:text-xl text-gray-400">teste por</span>
                  <span className="text-3xl font-bold text-white">30 dias</span>
                </div>
              </div>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Ferramenta completa</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Inteligência artificial</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Suporte básico</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Grupo Vip no WhatsApp</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300">4 contas por 30 dias</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300">Vídeos Passo a Passo</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" className="w-full bg-[#39FF14] hover:bg-[#32e612] text-black font-black py-7 rounded-xl shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:shadow-[0_0_30px_rgba(57,255,20,0.6)] transition-all hover:scale-105 flex items-center justify-center gap-2"
                  onClick={() => {
                    trackLead('Instagram MRO - Teste 30 Dias');
                    setSelectedPlan("trial");
                    setShowCheckoutModal(true);
                    trackInitiateCheckout('Teste 30 Dias', 97.00);
                  }}>
                  <ShoppingCart className="w-6 h-6" />
                  TESTAR AGORA POR R$97
                </Button>
                <span className="text-amber-500/70 font-bold text-xs uppercase tracking-widest">( 30 DIAS )</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bonus 5K Section - Design único e diferenciado */}
      <section className="relative py-24 px-4 overflow-hidden">
        {/* Background gradiente especial */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-gray-950 to-emerald-950" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(245, 158, 11, 0.2) 0%, transparent 50%)' }} />
        
        {/* Borda brilhante superior e inferior */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
        
        <div className="relative max-w-5xl mx-auto">
          {/* Pergunta inicial */}
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight text-white">
              Sabia que você pode prestar serviço e faturar com essa ferramenta mais de 5 mil mensal?
            </h2>
            <Button 
              onClick={() => setShowBonusDetails(!showBonusDetails)}
              className="bg-emerald-500 hover:bg-emerald-600 text-black font-black text-lg px-10 py-6 rounded-full shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
            >
              SABER COMO {showBonusDetails ? <ChevronDown className="ml-2 rotate-180" /> : <ChevronDown className="ml-2" />}
            </Button>
          </div>

          {showBonusDetails && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              {/* Badge exclusivo */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-3 bg-emerald-500/20 border-2 border-emerald-400/50 rounded-full px-6 py-3 mb-6 shadow-lg shadow-emerald-500/20">
                  <span className="text-2xl">💰</span>
                  <span className="text-emerald-300 text-base font-black tracking-wider uppercase">Bônus Exclusivo</span>
                  <span className="text-2xl">💰</span>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-black mb-3 leading-tight">
                  <span className="text-white">PRESTE SERVIÇO COM A MRO</span>
                </h2>
                <h3 className="text-3xl md:text-4xl font-black mb-6">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-400">FATURE MAIS DE R$5.000/MÊS</span>
                </h3>
                <p className="text-amber-400 font-bold text-xl max-w-2xl mx-auto">
                  Rode esse sistema para outras empresas e ganhe mensalmente com isso!
                </p>
              </div>

              {/* Cards informativos */}
              <div className="grid md:grid-cols-3 gap-6 mb-10">
                <div className="bg-black/40 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6 text-center hover:border-emerald-400/60 transition-all hover:scale-105">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <Laptop className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2">Trabalhe de Qualquer Lugar</h4>
                  <p className="text-gray-400 text-sm">Tudo pode ser feito do seu notebook, de qualquer lugar do mundo</p>
                </div>
                <div className="bg-black/40 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6 text-center hover:border-emerald-400/60 transition-all hover:scale-105">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2">4 Contas Vitalícias</h4>
                  <p className="text-gray-400 text-sm">+ 5 testes grátis por mês para apresentar o serviço aos clientes</p>
                </div>
                <div className="bg-black/40 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6 text-center hover:border-emerald-400/60 transition-all hover:scale-105">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-7 h-7 text-emerald-400" />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-2">Renda Recorrente</h4>
                  <p className="text-gray-400 text-sm">Cobra uma mensalidade dos clientes e gera renda recorrente</p>
                </div>
              </div>

              {/* Bloco explicativo */}
              <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/20 rounded-3xl p-8 md:p-10 mb-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
                <div className="relative space-y-5 text-gray-300 text-lg leading-relaxed">
                  <p>Temos um <strong className="text-emerald-400">método completo</strong> no qual você pode prestar serviços utilizando essa ferramenta, fechando contratos com empresas que buscam engajamento, clientes e vendas.</p>
                  <p>Você roda a ferramenta para o cliente, cobra uma mensalidade, e gera uma <strong className="text-emerald-400">renda recorrente</strong>.</p>
                  <p>Os testes servem para apresentar o serviço: você roda a ferramenta por 1 dia, o cliente vê o resultado e você <strong className="text-white">fecha um contrato mensal</strong> com ele.</p>
                  
                  <div className="bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-emerald-500/10 border border-amber-400/30 rounded-2xl p-6 mt-8">
                    <p className="text-2xl md:text-3xl font-black text-center text-amber-400 leading-tight">
                      OU SEJA, VOCÊ PODE FATURAR MAIS DE<br />
                      <span className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">R$5.000,00/MÊS</span><br />
                      <span className="text-xl text-amber-300">PRESTANDO SERVIÇO COM ESSA FERRAMENTA!</span>
                    </p>
                  </div>
                  
                  <p className="text-center text-gray-500 text-sm mt-4">Caso precise de mais contas no futuro, cobramos R$150 por conta adicional para quem já utiliza o sistema.</p>
                </div>
              </div>

              {/* Vídeo */}
              <div className="max-w-3xl mx-auto">
                <h4 className="text-center text-xl font-bold mb-6 text-emerald-300">🎬 CONFIRA UMA APRESENTAÇÃO DE COMO DESENVOLVEMOS ESSA SOLUÇÃO:</h4>
                <div onClick={() => openVideo("WQwnAHNvSMU")} className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-2xl shadow-emerald-500/10 border-2 border-emerald-500/30 hover:border-emerald-400/60 transition-all">
                  <img src="https://img.youtube.com/vi/WQwnAHNvSMU/maxresdefault.jpg" alt="Video 5K" className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/40">
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-black">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Perguntas <span className="text-amber-400">Frequentes</span>
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="font-semibold pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-amber-400 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <div className="px-5 pb-5 text-gray-400">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Computer Only Note */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gray-900/50 border border-gray-700 rounded-2xl p-6 flex items-center gap-4">
            <div className="flex gap-2">
              <Monitor className="w-8 h-8 text-gray-400" />
              <Laptop className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-400 text-sm">
              <strong className="text-white">Nota:</strong> Nossa ferramenta é compatível apenas com computadores de mesa, notebooks ou MacBooks.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Pronto para <span className="text-amber-400">Escalar</span> seu Instagram?
          </h2>
          <p className="text-xl text-gray-400 mb-10">Junte-se a milhares de empreendedores que já transformaram seus perfis com a V7+ Plus</p>
          
          <div className="flex flex-col items-center gap-10">
            <Button size="lg" className="bg-[#39FF14] hover:bg-[#32e612] text-black font-black text-base sm:text-lg md:text-xl px-6 sm:px-12 py-6 sm:py-8 rounded-xl shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all hover:scale-105 whitespace-normal h-auto min-h-[60px] leading-tight"
              onClick={() => {
                trackLead("Instagram Nova - Final CTA Scroll");
                scrollToPricing();
              }}>
              <span className="flex items-center justify-center gap-2 flex-wrap text-center">
                <span>GARANTIR MEU ACESSO AGORA</span>
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
            </Button>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-8 md:p-12 relative overflow-hidden max-w-2xl mx-auto w-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                  <WhatsAppIcon className="w-9 h-9 text-white" />
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">Ficou com dúvidas?</h3>
                <p className="text-gray-300 mb-8 text-lg">Entre em contato conosco agora mesmo pelo WhatsApp para falar com um especialista.</p>
                <Button 
                  onClick={() => {
                    trackLead("Instagram Nova - Final WhatsApp CTA");
                    window.location.href = "/whatsapp";
                  }}
                  className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-lg px-10 py-7 rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 flex items-center gap-3 w-full sm:w-auto"
                >
                  FALAR COM SUPORTE NO WHATSAPP
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center text-gray-500">
          <img src={logoMro} alt="MRO" className="h-10 mx-auto mb-4 object-contain" />
          <p className="font-medium text-gray-400">Mais Resultados Online</p>
          <p className="text-sm mt-1">Gabriel Fernandes da Silva</p>
          <p className="text-sm mt-1">CNPJ: 54.840.738/0001-96</p>
          <p className="text-sm mt-3">© 2024. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4" onClick={() => setShowVideoModal(false)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" onClick={() => setShowVideoModal(false)}>
            <X className="w-6 h-6" />
          </button>
          <div className="w-full max-w-5xl aspect-video" onClick={e => e.stopPropagation()}>
            <iframe src={`https://www.youtube.com/embed/${currentVideoUrl}?autoplay=1`} className="w-full h-full rounded-xl" allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setShowCheckoutModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors" onClick={() => setShowCheckoutModal(false)}>
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 bg-amber-500/20">
                <Sparkles className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Plano {PLANS[selectedPlan].name}</h3>
              <p className="text-2xl font-bold mt-2">
                <span className="text-amber-400">
                  R$ {PLANS[selectedPlan].price.toFixed(2).replace(".", ",")}
                </span>
              </p>
            </div>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="text-sm text-zinc-300 flex items-center gap-2 mb-2"><Mail className="w-4 h-4" />Seu Email</label>
                <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-zinc-800/50 border-zinc-600 text-white placeholder:text-zinc-500" required />
              </div>
              <div>
                <label className="text-sm text-zinc-300 flex items-center gap-2 mb-2"><Phone className="w-4 h-4" />Celular com DDD</label>
                <Input type="tel" placeholder="(51) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-zinc-800/50 border-zinc-600 text-white placeholder:text-zinc-500" required />
              </div>
              <div>
                <label className="text-sm text-zinc-300 flex items-center gap-2 mb-2"><User className="w-4 h-4" />Nome de Usuário (será sua senha também)</label>
                <Input type="text" placeholder="seuusuario" value={username} onChange={(e) => validateUsername(e.target.value)} className={`bg-zinc-800/50 border-zinc-600 text-white placeholder:text-zinc-500 ${usernameError ? "border-red-500" : ""}`} required />
                {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
                <p className="text-xs text-zinc-500 mt-1">Apenas letras minúsculas, sem espaços ou números</p>
              </div>
              <div className="bg-zinc-800/30 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">Usuário/Senha</span><span className="text-white font-mono">{username || "---"}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Total</span><span className="font-bold text-amber-400">R$ {PLANS[selectedPlan].price.toFixed(2).replace(".", ",")}</span></div>
              </div>
              <Button type="submit" className="w-full font-bold py-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black"
                disabled={loading || !!usernameError || !username || !email || !phone}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>) : (<><CreditCard className="mr-2 h-5 w-5" />Ir para Pagamento</>)}
              </Button>
              <p className="text-xs text-zinc-500 text-center">Após o pagamento, seu acesso será liberado automaticamente</p>
            </form>
          </div>
        </div>
      )}

      {/* Floating help removed as requested to be only at bottom */}
    </div>

  );
};

export default InstagramPromo30Dias;
