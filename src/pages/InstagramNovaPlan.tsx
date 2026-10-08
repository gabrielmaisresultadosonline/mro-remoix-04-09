import { MroIntelligentIntro } from '@/components/sales/MroIntelligentIntro';
import { MroIntelligentFeatures } from '@/components/sales/MroIntelligentFeatures';
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useParams } from "react-router-dom";
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

import { MRO_ANNUAL_OFFER } from '../../supabase/functions/_shared/mro-sales';
import { wlCall, type WlSalesContext } from '@/lib/whitelabel';
import { WlBrandOrbit } from '@/components/whitelabel/WlBrandOrbit';

interface SalesSettings {
  whatsappNumber: string;
  whatsappMessage: string;
  ctaButtonText: string;
}

const DEFAULT_PLANS = {
  pro: { name: "Pro", price: MRO_ANNUAL_OFFER.price, days: MRO_ANNUAL_OFFER.days, installment: MRO_ANNUAL_OFFER.installment, accounts: MRO_ANNUAL_OFFER.accounts },
  agencia: { name: "Agência", price: 997.00, days: 365, installment: "81", accounts: 10 },
};

interface InstagramNovaPlanProps {
  whitelabel?: WlSalesContext;
  videoSlot?: React.ReactNode;
  prefillEmail?: string;
  prefillPhone?: string;
  hideContactFields?: boolean;
}
const InstagramNovaPlan = ({ videoSlot, prefillEmail, prefillPhone, hideContactFields, whitelabel }: InstagramNovaPlanProps = {}) => {
  const PLANS = whitelabel ? { ...DEFAULT_PLANS, agencia: { name: 'Vitalício', price: whitelabel.prices.lifetime, days: 999999, installment: '', accounts: 12 } } : DEFAULT_PLANS;
  const [searchParams] = useSearchParams();
  const { affiliateId } = useParams<{ affiliateId?: string }>();
  const partnerSlug = !whitelabel && (affiliateId || searchParams.get('p') || '').toLowerCase() || null;
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
  const [email, setEmail] = useState(prefillEmail || "");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState(prefillPhone || "");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
    if (prefillPhone) setPhone(prefillPhone);
  }, [prefillEmail, prefillPhone]);

  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean | null> => {
    if (usernameToCheck.length < 4) { setUsernameAvailable(null); return null; }
    setCheckingUsername(true);
    try {
      const { data, error } = await supabase.functions.invoke('mro-tool-api', {
        body: { action: 'check_username', username: usernameToCheck },
      });
      if (error || !data || data.success !== true) { setUsernameAvailable(null); return null; }
      if (data.available === true) {
        setUsernameAvailable(true);
        setUsernameError((prev) => prev === "Usuário já em uso. Utilize outro usuário" ? "" : prev);
        return true;
      }
      setUsernameAvailable(false);
      setUsernameError("Usuário já em uso. Utilize outro usuário");
      return false;
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
      if (whitelabel) {
        const { checkout_url } = await wlCall<{ checkout_url: string }>('public_checkout', {
          code: whitelabel.code, link_type: whitelabel.linkType, plan: selectedPlan === 'pro' ? 'annual' : 'lifetime',
          email, username, name: username, phone: phone.replace(/\D/g, ''),
        });
        trackInitiateCheckout(`Whitelabel ${plan.name}`, plan.price);
        window.location.href = checkout_url;
        return;
      }
      
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
    } catch (error) { console.error("Error:", error); toast.error(whitelabel && error instanceof Error ? error.message : "Erro ao processar. Tente novamente."); } finally { setLoading(false); }
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
    { q: "O que é a automação de Direct (DM) em massa?", a: "É uma funcionalidade da MRO Inteligente que permite enviar mensagens automáticas no Direct para novos seguidores, seus seguidores atuais e até seguidores de qualquer outra página — tudo com copy otimizada pelo Corretor de IA exclusivo MRO." },
    { q: "O que são os Filtros Inteligentes (Público Quente)?", a: "São filtros avançados de segmentação que identificam pessoas que já demonstraram interesse no seu nicho — como quem curtiu posts, comentou ou segue perfis concorrentes. Isso garante mais precisão, mais respostas e mais conversões." },
    { q: "Isso em massa não gera bloqueio?", a: "Toda automação exige cuidado. Configure pausas e limites, respeite as regras do Instagram e evite mensagens indesejadas. Nenhuma ferramenta pode garantir ausência de bloqueios." },
    { q: "Funciona só em computador?", a: "Sim, nossa ferramenta é compatível apenas com computadores de mesa, notebooks ou MacBooks. Não funciona em celulares, tablets ou dispositivos móveis." },
    { q: "Como funciona a IA exclusiva da MRO?", a: "Nossa IA analisa seu perfil completo, gera estratégias de conteúdo, engajamento e vendas, otimiza sua BIO e entrega relatórios de acompanhamento — tudo personalizado para o seu nicho." },
  ];

  return (
    <div className="mro-intelligent-sales min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* Hero Section */}
      <section className="relative pt-10 md:pt-16 pb-12 px-4">
        <div className="max-w-5xl mx-auto text-center relative">
          <MroIntelligentIntro branding={whitelabel ? <WlBrandOrbit logoUrl={whitelabel.logoUrl} name={whitelabel.name} /> : undefined} />

          <div className="mt-6 max-w-4xl mx-auto" id="hero-video">
            {videoSlot ? (
              videoSlot
            ) : (
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border">
                <iframe
                  src="https://www.youtube.com/embed/lecSwt54sa0?rel=0&modestbranding=1"
                  title="Video MRO"
                  className="w-full aspect-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>



            <div className="mt-8 mb-4">
              <Button 
                onClick={scrollToPricing}
                className="bg-primary hover:bg-primary text-primary-foreground font-black px-12 py-7 rounded-full text-lg shadow-lg transition-all hover:scale-105"
              >
                GARANTIR MEU ACESSO AGORA
              </Button>
            </div>

            <div className="mt-6 animate-bounce">
              <ChevronDown className="w-10 h-10 text-muted-foreground mx-auto" />
            </div>
        </div>
      </section>

      <MroIntelligentFeatures />

      <section className="py-20 px-4 bg-gradient-to-b from-card to-background">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-card/80 to-background border-2 border-border/50 rounded-3xl p-8 md:p-14 text-center shadow-2xl shadow-primary/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-card/5 to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-center mb-6">
              
              <div className="relative w-24 h-24 rounded-full bg-primary/20 border-2 border-border/40 flex items-center justify-center">
                <Shield className="w-12 h-12 text-primary" />
              </div>
            </div>
            <span className="text-primary font-bold text-xs tracking-[0.3em] uppercase">GARANTIA TOTAL</span>
            <h2 className="text-3xl md:text-5xl font-black mt-3 mb-6 leading-tight">
              30 Dias de Resultados <span className="text-primary">Garantidos</span>
            </h2>
            <div className="bg-primary/10 border border-border/30 rounded-2xl px-6 py-5 max-w-2xl mx-auto mb-8">
              <p className="text-foreground text-lg md:text-xl leading-relaxed">
                Se em <strong className="text-primary">30 dias</strong> não tiver os resultados prometidos, <strong className="text-foreground">devolvemos o seu dinheiro.</strong>
              </p>
              <p className="text-primary font-bold text-lg mt-2">Nós garantimos resultados. Sem risco para você.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
              {[
                { emoji: "🔒", label: "Compra 100% Segura" },
                { emoji: "💰", label: "Reembolso Garantido" },
                { emoji: "✅", label: "Satisfação ou Dinheiro de Volta" }
              ].map((item, i) => (
                <div key={i} className="bg-primary/10 border border-border/20 rounded-xl px-4 py-3 flex items-center gap-2 justify-center">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-primary text-sm font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-sm">Garantia válida por 30 dias após a data da compra.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={pricingRef} className="py-20 px-4 bg-background relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/5 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">

          <div className="text-center mb-12">
            <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
              Planos Anuais
            </span>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              ESCOLHA SEU <span className="text-primary">PLANO ANUAL</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-6">
              A solução definitiva para crescer no Instagram sem gastar com anúncios
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 max-w-xl mx-auto">

            {/* Plano Pro */}
            <div className={`relative bg-gradient-to-br from-card to-background border-2 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl transition-all hover:scale-[1.05] z-10 ${selectedPlan === 'pro' ? 'border-border ring-4 ring-ring/20' : 'border-border/50'}`}>
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <div className="bg-gradient-to-r from-card to-background text-primary-foreground text-xs font-black px-4 py-1.5 rounded-full whitespace-nowrap">⭐ RECOMENDADO</div>
              </div>
              <h3 className="text-3xl font-black mb-2 text-center text-primary mt-2">Plano Pro Anual</h3>
              <p className="text-muted-foreground text-center mb-6 text-sm">4 contas simultâneas</p>
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-lg sm:text-xl text-muted-foreground">12x de</span>
                  <span className="text-6xl sm:text-7xl font-[1000] text-primary">R${MRO_ANNUAL_OFFER.installment}</span>
                </div>
                <p className="text-muted-foreground mt-2 font-bold">R${MRO_ANNUAL_OFFER.price} à vista</p>
              </div>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground font-bold">Ferramenta completa</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground font-bold">Inteligência artificial</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground font-bold">Suporte</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground font-bold">Grupo Vip no WhatsApp</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">4 contas fixas</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Vídeos Passo a Passo</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button size="lg" className="w-full bg-primary hover:bg-primary text-primary-foreground font-black py-7 rounded-xl shadow-lg hover:shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
                  onClick={() => { 
                    trackLead('Instagram MRO - Plano Pro'); 
                    setSelectedPlan("pro"); 
                    setShowCheckoutModal(true); 
                    trackInitiateCheckout('Plano Pro', MRO_ANNUAL_OFFER.price);
                  }}>
                  <ShoppingCart className="w-6 h-6" />
                  ESCOLHER PRO
                </Button>
                <span className="text-primary/70 font-bold text-xs uppercase tracking-widest">( ANUAL )</span>
              </div>
            </div>
          </div>
          
          {whitelabel && <div className="max-w-xl mx-auto mt-6 text-center space-y-2">
            <h3 className="text-xl font-bold">Plano Vitalício — 12 contas</h3>
            <p>R$ {whitelabel.prices.lifetime.toFixed(2).replace('.', ',')}</p>
            <Button variant="outline" onClick={() => { setSelectedPlan('agencia'); setShowCheckoutModal(true); }}>Escolher Vitalício</Button>
          </div>}
          <div className="mt-16 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-2xl md:text-3xl font-black text-foreground mb-4">Ficou com dúvidas?</h3>
            <p className="text-muted-foreground mb-6 text-lg">Fale no WhatsApp agora mesmo para falar com um especialista.</p>
            <Button 
              onClick={() => {
                trackLead("Instagram Nova - WhatsApp CTA Below Pricing");
                window.location.href = "/whatsapp";
              }}
              className="bg-primary hover:bg-primary text-foreground font-bold text-lg px-10 py-7 rounded-2xl shadow-lg shadow-primary/20 transition-all hover:scale-105 flex items-center gap-3 mx-auto"
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
        <div className="absolute inset-0 bg-gradient-to-br from-card via-background to-background" />
        <div className="absolute inset-0 opacity-20" />
        
        {/* Borda brilhante superior e inferior */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-background to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-background to-transparent" />
        
        <div className="relative max-w-5xl mx-auto">
          {/* Pergunta inicial */}
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight text-foreground">
              Sabia que você pode prestar serviço e faturar com essa ferramenta mais de 5 mil mensal?
            </h2>
            <Button 
              onClick={() => setShowBonusDetails(!showBonusDetails)}
              className="bg-primary hover:bg-primary text-primary-foreground font-black text-lg px-10 py-6 rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105"
            >
              SABER COMO {showBonusDetails ? <ChevronDown className="ml-2 rotate-180" /> : <ChevronDown className="ml-2" />}
            </Button>
          </div>

          {showBonusDetails && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              {/* Badge exclusivo */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-3 bg-primary/20 border-2 border-border/50 rounded-full px-6 py-3 mb-6 shadow-lg shadow-primary/20">
                  <span className="text-2xl">💰</span>
                  <span className="text-primary text-base font-black tracking-wider uppercase">Bônus Exclusivo</span>
                  <span className="text-2xl">💰</span>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-black mb-3 leading-tight">
                  <span className="text-foreground">PRESTE SERVIÇO COM A MRO</span>
                </h2>
                <h3 className="text-3xl md:text-4xl font-black mb-6">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-card via-background to-background">FATURE MAIS DE R$5.000/MÊS</span>
                </h3>
                <p className="text-primary font-bold text-xl max-w-2xl mx-auto">
                  Rode esse sistema para outras empresas e ganhe mensalmente com isso!
                </p>
              </div>

              {/* Cards informativos */}
              <div className="grid md:grid-cols-3 gap-6 mb-10">
                <div className="bg-background/40 backdrop-blur-sm border border-border/30 rounded-2xl p-6 text-center hover:border-border/60 transition-all hover:scale-105">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Laptop className="w-7 h-7 text-primary" />
                  </div>
                  <h4 className="text-foreground font-bold text-lg mb-2">Trabalhe de Qualquer Lugar</h4>
                  <p className="text-muted-foreground text-sm">Tudo pode ser feito do seu notebook, de qualquer lugar do mundo</p>
                </div>
                <div className="bg-background/40 backdrop-blur-sm border border-border/30 rounded-2xl p-6 text-center hover:border-border/60 transition-all hover:scale-105">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-primary" />
                  </div>
                  <h4 className="text-foreground font-bold text-lg mb-2">4 contas fixas</h4>
                  <p className="text-muted-foreground text-sm">+ 5 testes grátis por mês para apresentar o serviço aos clientes</p>
                </div>
                <div className="bg-background/40 backdrop-blur-sm border border-border/30 rounded-2xl p-6 text-center hover:border-border/60 transition-all hover:scale-105">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-7 h-7 text-primary" />
                  </div>
                  <h4 className="text-foreground font-bold text-lg mb-2">Renda Recorrente</h4>
                  <p className="text-muted-foreground text-sm">Cobra uma mensalidade dos clientes e gera renda recorrente</p>
                </div>
              </div>

              {/* Bloco explicativo */}
              <div className="bg-background/60 backdrop-blur-sm border border-border/20 rounded-3xl p-8 md:p-10 mb-10 relative overflow-hidden">
                
                <div className="relative space-y-5 text-muted-foreground text-lg leading-relaxed">
                  <p>Temos um <strong className="text-primary">método completo</strong> no qual você pode prestar serviços utilizando essa ferramenta, fechando contratos com empresas que buscam engajamento, clientes e vendas.</p>
                  <p>Você roda a ferramenta para o cliente, cobra uma mensalidade, e gera uma <strong className="text-primary">renda recorrente</strong>.</p>
                  <p>Os testes servem para apresentar o serviço: você roda a ferramenta por até 6 horas, o cliente vê o resultado e você <strong className="text-foreground">fecha um contrato mensal</strong> com ele.</p>
                  
                  <div className="bg-gradient-to-r from-card/10 via-background/10 to-background/10 border border-border/30 rounded-2xl p-6 mt-8">
                    <p className="text-2xl md:text-3xl font-black text-center text-primary leading-tight">
                      OU SEJA, VOCÊ PODE FATURAR MAIS DE<br />
                      <span className="text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-card to-background">R$5.000,00/MÊS</span><br />
                      <span className="text-xl text-primary">PRESTANDO SERVIÇO COM ESSA FERRAMENTA!</span>
                    </p>
                  </div>
                  
                  <p className="text-center text-muted-foreground text-sm mt-4">Caso precise de mais contas no futuro, cobramos R$150 por conta adicional para quem já utiliza o sistema.</p>
                </div>
              </div>

              {/* Vídeo */}
              <div className="max-w-3xl mx-auto">
                <h4 className="text-center text-xl font-bold mb-6 text-primary">🎬 CONFIRA UMA APRESENTAÇÃO DE COMO DESENVOLVEMOS ESSA SOLUÇÃO:</h4>
                <div onClick={() => openVideo("WQwnAHNvSMU")} className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-2xl shadow-primary/10 border-2 border-border/30 hover:border-border/60 transition-all">
                  <img src="https://img.youtube.com/vi/WQwnAHNvSMU/maxresdefault.jpg" alt="Video 5K" className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-background/40 flex items-center justify-center group-hover:bg-background/30 transition-colors">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-primary/40">
                      <Play className="w-8 h-8 text-foreground ml-1" fill="currentColor" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Posso usar trafego pago e a ferramenta MRO? Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-background/60 backdrop-blur-sm border border-border/20 rounded-3xl p-8 md:p-12 relative overflow-hidden text-center">
            
            
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-6">
              Posso usar tráfego pago e a ferramenta MRO?
            </h2>
            
            <div className="space-y-6 text-muted-foreground text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
              <p>
                Sim! A ferramenta MRO foi desenhada para <strong className="text-primary">potencializar</strong> seus resultados. 
                Enquanto o tráfego pago traz novas pessoas para o seu perfil, a MRO garante que essas pessoas se tornem seguidores e clientes fiéis através da nossa automação inteligente.
              </p>
              <p className="text-base text-muted-foreground italic">
                Veja o vídeo abaixo para entender como essa combinação pode acelerar o seu crescimento.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              {showSecondaryVideo ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border">
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
                  className="bg-primary hover:bg-primary text-foreground font-bold px-8 py-6 rounded-xl shadow-lg transition-all hover:scale-105 flex items-center gap-3 mx-auto"
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
      <section className="py-20 px-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Perguntas <span className="text-primary">Frequentes</span>
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-card/50 border border-border rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                  <span className="font-semibold pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-primary transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && <div className="px-5 pb-5 text-muted-foreground">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Computer Only Note */}
      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-card/50 border border-border rounded-2xl p-6 flex items-center gap-4">
            <div className="flex gap-2">
              <Monitor className="w-8 h-8 text-muted-foreground" />
              <Laptop className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Nota:</strong> Nossa ferramenta é compatível apenas com computadores de mesa, notebooks ou MacBooks.
            </p>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto text-center text-muted-foreground">
          <img src={logoMro} alt="MRO" className="h-10 mx-auto mb-4 object-contain" />
          <p className="font-medium text-muted-foreground">Mais Resultados Online</p>
          <p className="text-sm mt-1">Gabriel Fernandes da Silva</p>
          <p className="text-sm mt-1">CNPJ: 54.840.738/0001-96</p>
          <p className="text-sm mt-3">© 2024. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-4" onClick={() => setShowVideoModal(false)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-card/10 hover:bg-card/20 transition-colors" onClick={() => setShowVideoModal(false)}>
            <X className="w-6 h-6" />
          </button>
          <div className="w-full max-w-5xl aspect-video" onClick={e => e.stopPropagation()}>
            <iframe src={`https://www.youtube.com/embed/${currentVideoUrl}?autoplay=1`} className="w-full h-full rounded-xl" allow="autoplay; encrypted-media" allowFullScreen />
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-background/90 z-50 flex items-center justify-center p-4" onClick={() => setShowCheckoutModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 p-2 rounded-full bg-card/10 hover:bg-card/20 transition-colors" onClick={() => setShowCheckoutModal(false)}>
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3 ${selectedPlan === "pro" ? "bg-primary/20" : "bg-primary/20"}`}>
                <Sparkles className={`w-7 h-7 ${selectedPlan === "pro" ? "text-primary" : "text-primary"}`} />
              </div>
              <h3 className="text-xl font-bold text-foreground">Plano {PLANS[selectedPlan].name}</h3>
              <p className="text-2xl font-bold mt-2">
                <span className={selectedPlan === "pro" ? "text-primary" : "text-primary"}>
                  R$ {PLANS[selectedPlan].price.toFixed(2).replace(".", ",")}
                </span>
              </p>
            </div>
            <form onSubmit={handleCheckout} className="space-y-4">
              {!hideContactFields && (
                <>
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><Mail className="w-4 h-4" />Seu Email</label>
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card/50 border-border text-foreground placeholder:text-muted-foreground" required />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><Phone className="w-4 h-4" />Celular com DDD</label>
                    <Input type="tel" placeholder="(51) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-card/50 border-border text-foreground placeholder:text-muted-foreground" required />
                  </div>
                </>
              )}
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><User className="w-4 h-4" />Nome de Usuário (será sua senha também)</label>
                <Input type="text" placeholder="seuusuario" value={username} onChange={(e) => validateUsername(e.target.value)} className={`bg-card/50 border-border text-foreground placeholder:text-muted-foreground ${usernameError ? "border-border" : ""}`} required />
                {usernameError && <p className="text-xs text-primary mt-1">{usernameError}</p>}
                <p className="text-xs text-muted-foreground mt-1">Apenas letras minúsculas, sem espaços ou números</p>
              </div>
              <div className="bg-card/30 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Usuário/Senha</span><span className="text-foreground font-mono">{username || "---"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className={`font-bold ${selectedPlan === "pro" ? "text-primary" : "text-primary"}`}>R$ {PLANS[selectedPlan].price.toFixed(2).replace(".", ",")}</span></div>
              </div>
              <Button type="submit" className={`w-full font-bold py-5 ${selectedPlan === "pro" ? "bg-gradient-to-r from-card to-background hover:from-card hover:to-background text-primary-foreground" : "bg-primary hover:bg-primary text-foreground"}`}
                disabled={loading || !!usernameError || !username || !email || !phone}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>) : (<><CreditCard className="mr-2 h-5 w-5" />Ir para Pagamento</>)}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Após o pagamento, seu acesso será liberado automaticamente</p>
            </form>
          </div>
        </div>
      )}

      {/* Floating help removed as requested to be only at bottom */}
    </div>

  );
};

export default InstagramNovaPlan;
