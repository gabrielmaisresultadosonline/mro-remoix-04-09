import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView, trackLead } from "@/lib/facebookTracking";
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
  MousePointerClick
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
  annual: { name: "Anual", price: 397.00, days: 365, description: "Acesso por 1 ano" },
  lifetime: { name: "Vitalício", price: 797.00, days: 999999, description: "Acesso para sempre" },
};

const VendasCompleta = () => {
  const [searchParams] = useSearchParams();
  const partnerSlug = searchParams.get('p');
  const [partner, setPartner] = useState<{id: string, name: string} | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [timeLeft, setTimeLeft] = useState({ hours: 47, minutes: 59, seconds: 59 });
  const [promoTimeLeft, setPromoTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, expired: false });
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const [salesSettings, setSalesSettings] = useState<SalesSettings>({
    whatsappNumber: '+55 51 9203-6540',
    whatsappMessage: 'Gostaria de saber sobre a promoção.',
    ctaButtonText: 'Gostaria de aproveitar a promoção'
  });
  
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"annual" | "lifetime">("annual");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
      window.location.href = checkData.payment_link;
    } catch (error) { console.error("Error:", error); toast.error("Erro ao processar. Tente novamente."); } finally { setLoading(false); }
  };

  useEffect(() => { trackPageView('Sales Page - Instagram MRO'); }, []);

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
    { q: "Quais são os planos disponíveis hoje?", a: "Oferecemos dois planos: o Plano Anual de 12 meses, que dá acesso completo por um ano, e o Plano Pagamento Único Vitalício, onde você paga apenas uma vez e tem acesso para sempre, incluindo todas as atualizações sem custo adicional." },
    { q: "O que é a automação de Direct (DM) em massa?", a: "É uma funcionalidade exclusiva da V7+ Plus que permite enviar mensagens automáticas no Direct para novos seguidores, seus seguidores atuais e até seguidores de qualquer outra página — tudo com copy otimizada pelo Corretor de IA exclusivo MRO." },
    { q: "O que são os Filtros Inteligentes (Público Quente)?", a: "São filtros avançados de segmentação que identificam pessoas que já demonstraram interesse no seu nicho — como quem curtiu posts, comentou ou segue perfis concorrentes. Isso garante mais precisão, mais respostas e mais conversões." },
    { q: "Isso em massa não gera bloqueio?", a: "Não. Nosso sistema simula um humano com tela ligada, interações espaçadas e pausas naturais. Você deixa rodando por 7 a 8 horas diárias com segurança. O algoritmo entende como uso real, evitando bloqueios." },
    { q: "Funciona só em computador?", a: "Sim, nossa ferramenta é compatível apenas com computadores de mesa, notebooks ou MacBooks. Não funciona em celulares, tablets ou dispositivos móveis." },
    { q: "Como funciona a IA exclusiva da MRO?", a: "Nossa IA analisa seu perfil completo, gera estratégias de conteúdo, engajamento e vendas, otimiza sua BIO e entrega relatórios de acompanhamento — tudo personalizado para o seu nicho." },
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logoMro} alt="MRO" className="h-10 object-contain" />
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => {
                trackLead("Instagram Nova - Header WhatsApp");
                openWhatsAppChat(salesSettings.whatsappNumber, salesSettings.whatsappMessage);
              }} 
              className="hidden sm:flex items-center gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white font-bold"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Falar no WhatsApp
            </Button>
            <a
              href="/instagram"
              className="rounded-full border border-amber-500/60 bg-amber-500/10 px-4 py-1.5 text-xs sm:text-sm font-bold text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              Fazer Login
            </a>
            <Button 
              onClick={scrollToPricing}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs sm:text-sm px-4"
            >
              Garantir Acesso
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-28 pb-16 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[60px] md:blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-[50px] md:blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-40 bg-gradient-to-t from-purple-500/5 to-transparent" />
        </div>
        <div className="max-w-5xl mx-auto text-center relative">
          <img src={logoMro} alt="MRO" className="h-20 md:h-28 mx-auto mb-6 object-contain" />
          
          {/* V7+ Badge */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/50 rounded-full px-6 py-2 mb-6">
            <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
            <span className="text-white font-bold text-sm md:text-base">NOVA VERSÃO V7+ PLUS — A MAIS COMPLETA</span>
            <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
          </div>
          
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 blur-3xl rounded-full" />
            <h1 className="relative text-3xl md:text-5xl lg:text-6xl font-black mb-3 leading-tight">
               <span className="bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent">NÃO GASTE MAIS COM ANÚNCIOS</span>
             </h1>
             <h2 className="relative text-xl md:text-3xl lg:text-4xl font-black mb-3">
              <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                Utilize a MRO Inteligente!
              </span>
            </h2>
            <p className="relative mt-3 text-sm md:text-base text-gray-400">
              Instale em seu notebook, macbook ou computador de mesa!
            </p>
          </div>

          <div className="mt-10 max-w-4xl mx-auto" id="hero-video">
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


          <div className="mt-8 max-w-4xl mx-auto">
            <img 
              src={zeroAnunciosBanner} 
              alt="Zero Anúncios. Resultados Reais." 
              className="w-full h-auto rounded-2xl"
            />
          </div>

          <div className="mt-10 animate-bounce">
            <ChevronDown className="w-10 h-10 text-gray-500 mx-auto" />
          </div>
        </div>
      </section>

      {/* Active Clients section removed as requested */}

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
      <section ref={pricingRef} className="py-20 px-4 bg-black relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">

          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4">
              ESCOLHA SEU <span className="text-amber-400">PLANO</span>
            </h2>
            <p className="text-gray-400 text-lg mb-6">
              A solução definitiva para crescer no Instagram sem gastar com anúncios
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Plano Anual */}
            <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-blue-500 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl">
              <h3 className="text-2xl font-bold mb-2 text-center text-blue-400">Plano Anual</h3>
              <p className="text-gray-400 text-center mb-6 text-sm">Acesso completo por 12 meses</p>
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-lg sm:text-xl text-gray-400">12x de</span>
                  <span className="text-5xl sm:text-6xl font-black text-blue-400">R$41</span>
                </div>
                <p className="text-gray-400 mt-2">ou à vista PIX <span className="text-white font-bold">R$397</span></p>
              </div>
              <div className="space-y-2 mb-6">
                {annualFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-gray-300">{f}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-gray-500 pt-1"><span>• {affiliateBonus}</span></div>
              </div>
              <Button size="lg" className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 rounded-xl hover:scale-105 transition-transform"
                onClick={() => { trackLead('Instagram MRO - Plano Anual'); setSelectedPlan("annual"); setShowCheckoutModal(true); }}>
                GARANTIR PLANO ANUAL
              </Button>
            </div>

            {/* Plano Vitalício */}
            <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-amber-500 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl shadow-amber-500/30">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap">⭐ MAIS POPULAR</div>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-center text-amber-400 mt-2">Plano Vitalício</h3>
              <p className="text-gray-400 text-center mb-6 text-sm">Acesso completo para sempre</p>
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-lg sm:text-xl text-gray-400">12x de</span>
                  <span className="text-5xl sm:text-6xl font-black text-amber-400">R$81</span>
                </div>
                <p className="text-gray-400 mt-2">ou à vista PIX <span className="text-white font-bold">R$797</span></p>
              </div>
              <div className="space-y-2 mb-6">
                {lifetimeFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-gray-300">{f}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-gray-500 pt-1"><span>• {affiliateBonus}</span></div>
              </div>
              <Button size="lg" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold py-4 rounded-xl hover:scale-105 transition-transform"
                onClick={() => { trackLead('Instagram MRO - Plano Vitalício'); setSelectedPlan("lifetime"); setShowCheckoutModal(true); }}>
                GARANTIR PLANO VITALÍCIO
              </Button>
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

      {/* Still Have Doubts */}
      <section className="py-20 px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ainda está com <span className="text-amber-400">dúvidas</span>?</h2>
            <p className="text-gray-400 text-lg">Veja no vídeo abaixo como nossa ferramenta pode transformar seus resultados</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <div onClick={() => openVideo("htcmVvznaBs")} className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-2xl border border-gray-700">
              <img src="https://img.youtube.com/vi/htcmVvznaBs/maxresdefault.jpg" alt="Video Final" className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-colors">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                  <Play className="w-8 h-8 text-white ml-1" fill="white" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Zap, title: "Resultados Rápidos", desc: "Em apenas 7 horas utilizando nossa ferramenta você já começa a ver os primeiros resultados" },
              { icon: Star, title: "Engajamento Garantido", desc: "Aumente significativamente o engajamento do seu público sem depender de anúncios pagos" },
              { icon: Target, title: "Mais Vendas", desc: "Método comprovado que gera clientes e aumenta suas vendas de forma consistente" },
            ].map((item, i) => (
              <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-center">
                <item.icon className="w-10 h-10 text-amber-400 mx-auto mb-4" />
                <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                <p className="text-gray-400 text-sm">{item.desc}</p>
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

      {/* WhatsApp Link to Landing Page */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            trackLead("Instagram Nova - Floating WhatsApp");
            window.location.href = "/whatsapp";
          }}
          className="w-16 h-16 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
          title="Falar no WhatsApp"
        >
          <WhatsAppIcon className="w-8 h-8" />
        </button>
      </div>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-gradient-to-b from-gray-950 to-black">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Pronto para <span className="text-amber-400">Escalar</span> seu Instagram?
          </h2>
          <p className="text-xl text-gray-400 mb-10">Junte-se a milhares de empreendedores que já transformaram seus perfis com a V7+ Plus</p>
          <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold text-base sm:text-lg md:text-xl px-6 sm:px-12 py-6 sm:py-8 rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all hover:scale-105 whitespace-normal h-auto min-h-[60px] leading-tight"
            onClick={() => {
              trackLead("Instagram Nova - Final CTA Scroll");
              scrollToPricing();
            }}>
            <span className="flex items-center justify-center gap-2 flex-wrap text-center">
              <span>GARANTIR MEU ACESSO AGORA</span>
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
          </Button>
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
              <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${selectedPlan === "annual" ? "bg-blue-500/20" : "bg-gradient-to-br from-amber-500/20 to-orange-500/20"}`}>
                <Sparkles className={`w-7 h-7 ${selectedPlan === "annual" ? "text-blue-400" : "text-amber-400"}`} />
              </div>
              <h3 className="text-xl font-bold text-white">Plano {PLANS[selectedPlan].name}</h3>
              <p className="text-2xl font-bold mt-2">
                <span className={selectedPlan === "annual" ? "text-blue-400" : "text-amber-400"}>
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
                <div className="flex justify-between"><span className="text-zinc-400">Total</span><span className={`font-bold ${selectedPlan === "annual" ? "text-blue-400" : "text-amber-400"}`}>R$ {PLANS[selectedPlan].price.toFixed(2).replace(".", ",")}</span></div>
              </div>
              <Button type="submit" className={`w-full font-bold py-5 ${selectedPlan === "annual" ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700" : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black"}`}
                disabled={loading || !!usernameError || !username || !email || !phone}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>) : (<><CreditCard className="mr-2 h-5 w-5" />Ir para Pagamento</>)}
              </Button>
              <p className="text-xs text-zinc-500 text-center">Após o pagamento, seu acesso será liberado automaticamente</p>
            </form>
          </div>
        </div>
      )}

      <FloatingWhatsAppHelp scrollTargetId="hero-video" />
    </div>

  );
};

export default VendasCompleta;
