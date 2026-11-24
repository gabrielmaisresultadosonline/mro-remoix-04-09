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
  pro: { name: "Pro", price: 397.00, days: 365, installment: "41", accounts: 4 },
  agencia: { name: "Agência", price: 997.00, days: 365, installment: "81", accounts: 10 },
};

const InstagramNovaWS = () => {
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
  const [showSecondaryVideo, setShowSecondaryVideo] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "agencia">("pro");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimeoutRef = useRef<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setContentVisible(true);
    }, 60000); // 1 minute delay
    return () => clearTimeout(timer);
  }, []);

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


          {contentVisible && (
            <>
              <div className="mt-8 mb-4">
                <Button 
                  onClick={scrollToPricing}
                  className="bg-[#39FF14] hover:bg-[#32e612] text-black font-black px-12 py-7 rounded-full text-lg shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all hover:scale-105"
                >
                  VER PLANOS DISPONÍVEIS
                </Button>
              </div>

              <div className="mt-6 animate-bounce">
                <ChevronDown className="w-10 h-10 text-gray-500 mx-auto" />
              </div>
            </>
          )}
        </div>
      </section>

      {contentVisible && (
        <>
          {/* Active Clients section removed as requested */}


      <section className="py-20 px-4 bg-gradient-to-b from-black via-gray-950 to-black">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
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
              A Solução Mais <span className="text-emerald-400">Acessível</span> do Mercado
            </h2>
            <p className="text-gray-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
              Libere o poder da automação e IA no seu Instagram hoje mesmo. Planos flexíveis que cabem no seu bolso.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6">
              <Button 
                onClick={scrollToPricing}
                className="bg-[#39FF14] hover:bg-[#32e612] text-black font-black px-12 py-7 rounded-full text-lg shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-all hover:scale-105"
              >
                VER TODOS OS PLANOS
              </Button>
            </div>
          </div>
        </div>
      </div>
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
            <span className="inline-block bg-amber-500/10 text-amber-500 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
              Planos Anuais
            </span>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              ESCOLHA SEU <span className="text-amber-400">PLANO ANUAL</span>
            </h2>
            <p className="text-gray-400 text-lg mb-6">
              A solução definitiva para crescer no Instagram sem gastar com anúncios
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* Plano Pro */}
            <div className={`relative bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl transition-all hover:scale-[1.05] z-10 ${selectedPlan === 'pro' ? 'border-amber-500 ring-4 ring-amber-500/20' : 'border-amber-500/50'}`}>
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-black text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap">⭐ RECOMENDADO</div>
              </div>
              <h3 className="text-3xl font-black mb-2 text-center text-amber-400 mt-2">Plano Pro Anual</h3>
              <p className="text-gray-400 text-center mb-6 text-sm">4 contas simultâneas</p>
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-lg sm:text-xl text-gray-400">12x de</span>
                  <span className="text-6xl sm:text-7xl font-[1000] text-amber-400">R$41</span>
                </div>
                <p className="text-gray-400 mt-2 font-bold">R$397 à vista</p>
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
                  <span className="text-gray-300 font-bold">Suporte</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Grupo Vip no WhatsApp</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300">4 contas fixas</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-gray-300">Vídeos Passo a Passo</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" className="w-full bg-[#39FF14] hover:bg-[#32e612] text-black font-black py-7 rounded-xl shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:shadow-[0_0_30px_rgba(57,255,20,0.6)] transition-all hover:scale-105 flex items-center justify-center gap-2"
                  onClick={() => { 
                    trackLead('Instagram MRO - Plano Pro'); 
                    setSelectedPlan("pro"); 
                    setShowCheckoutModal(true); 
                    trackInitiateCheckout('Plano Pro', 397.00);
                  }}>
                  <ShoppingCart className="w-6 h-6" />
                  ESCOLHER PRO
                </Button>
                <span className="text-amber-500/70 font-bold text-xs uppercase tracking-widest">( ANUAL )</span>
              </div>
            </div>

            {/* Plano Agência */}
            <div className={`relative bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl transition-all hover:scale-[1.02] ${selectedPlan === 'agencia' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-zinc-700'}`}>
              <h3 className="text-2xl font-black mb-2 text-center text-white">Plano Agência Anual</h3>
              <p className="text-gray-400 text-center mb-6 text-sm">10 contas simultâneas</p>
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-lg sm:text-xl text-gray-400">12x de</span>
                  <span className="text-6xl sm:text-7xl font-[1000] text-purple-400">R$81</span>
                </div>
                <p className="text-gray-400 mt-2 font-bold">R$997 à vista</p>
              </div>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Ferramenta completa</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Inteligência artificial</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Suporte</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-gray-300 font-bold">Grupo Vip no WhatsApp</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-gray-300">10 contas fixas</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-gray-300">Vídeos Passo a Passo</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" className="w-full bg-[#39FF14] hover:bg-[#32e612] text-black font-black py-7 rounded-xl shadow-[0_0_20px_rgba(57,255,20,0.4)] hover:shadow-[0_0_30px_rgba(57,255,20,0.6)] transition-all hover:scale-105 flex items-center justify-center gap-2"
                  onClick={() => { 
                    trackLead('Instagram MRO - Plano Agência'); 
                    setSelectedPlan("agencia"); 
                    setShowCheckoutModal(true); 
                    trackInitiateCheckout('Plano Agência', 997.00);
                  }}>
                  <ShoppingCart className="w-6 h-6" />
                  ESCOLHER AGÊNCIA
                </Button>
                <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest">( ANUAL )</span>
              </div>
            </div>
          </div>
          
          <div className="mt-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-2xl md:text-3xl font-black text-white mb-4">Ficou com dúvidas?</h3>
            <p className="text-gray-400 mb-6 text-lg">Fale no WhatsApp agora mesmo para falar com um especialista.</p>
            <Button 
              onClick={() => {
                trackLead("Instagram Nova - WhatsApp CTA Below Pricing");
                window.location.href = "/whatsapp";
              }}
              className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-lg px-10 py-7 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 flex items-center gap-3 mx-auto"
            >
              <WhatsAppIcon className="w-7 h-7" />
              CONVERSAR NO WHATSAPP
            </Button>
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

      {/* Posso usar trafego pago e a ferramenta MRO? Section */}
      <section className="py-20 px-4 bg-zinc-950/50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-black/60 backdrop-blur-sm border border-emerald-500/20 rounded-3xl p-8 md:p-12 relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
            
            <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
              Posso usar tráfego pago e a ferramenta MRO?
            </h2>
            
            <div className="space-y-6 text-gray-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
              <p>
                Sim! A ferramenta MRO foi desenhada para <strong className="text-emerald-400">potencializar</strong> seus resultados. 
                Enquanto o tráfego pago traz novas pessoas para o seu perfil, a MRO garante que essas pessoas se tornem seguidores e clientes fiéis através da nossa automação inteligente.
              </p>
              <p className="text-base text-gray-400 italic">
                Veja o vídeo abaixo para entender como essa combinação pode acelerar o seu crescimento.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              {showSecondaryVideo ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                  <iframe
                    src="https://www.youtube.com/embed/EHTtdvtoI_A?rel=0&autoplay=1"
                    title="Tráfego Pago e MRO"
                    className="w-full aspect-video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <Button 
                  onClick={() => setShowSecondaryVideo(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 py-6 rounded-xl shadow-lg transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                >
                  <Play className="w-6 h-6 fill-current" />
                  VER O VÍDEO
                </Button>
              )}
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
              <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${selectedPlan === "pro" ? "bg-amber-500/20" : "bg-purple-500/20"}`}>
                <Sparkles className={`w-7 h-7 ${selectedPlan === "pro" ? "text-amber-400" : "text-purple-400"}`} />
              </div>
              <h3 className="text-xl font-bold text-white">Plano {PLANS[selectedPlan].name}</h3>
              <p className="text-2xl font-bold mt-2">
                <span className={selectedPlan === "pro" ? "text-amber-400" : "text-purple-400"}>
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
                <div className="flex justify-between"><span className="text-zinc-400">Total</span><span className={`font-bold ${selectedPlan === "pro" ? "text-amber-400" : "text-purple-400"}`}>R$ {PLANS[selectedPlan].price.toFixed(2).replace(".", ",")}</span></div>
              </div>
              <Button type="submit" className={`w-full font-bold py-5 ${selectedPlan === "pro" ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black" : "bg-purple-600 hover:bg-purple-700 text-white"}`}
                disabled={loading || !!usernameError || !username || !email || !phone}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>) : (<><CreditCard className="mr-2 h-5 w-5" />Ir para Pagamento</>)}
              </Button>
              <p className="text-xs text-zinc-500 text-center">Após o pagamento, seu acesso será liberado automaticamente</p>
            </form>
          </div>
        </div>
      )}

      {/* Floating help removed as requested to be only at bottom */}
        </>
      )}
    </div>
  );
};

export default InstagramNovaWS;
