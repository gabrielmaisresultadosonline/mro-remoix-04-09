import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView, trackLead, trackInitiateCheckout } from "@/lib/facebookTracking";
import { toast } from "sonner";
import { CheckCircle2, Shield, X, Mail, User, CreditCard, Loader2, Phone, ShoppingCart, Sparkles } from "lucide-react";
import Ferramentammmr from "./Ferramentammmr";

// Planos em Libras Esterlinas (£) — valores e pagamento Stripe próprios desta página.
const PLANS = {
  pro: { name: "Pro", price: 397, accounts: 4 },
  agencia: { name: "Agência", price: 997, accounts: 10 },
} as const;
type PlanKey = keyof typeof PLANS;

const FEATURES = (accounts: number) => [
  "Ferramenta completa",
  "Inteligência artificial",
  "Suporte",
  "Grupo Vip no WhatsApp",
  `${accounts} contas fixas`,
  "Vídeos Passo a Passo",
];

/** Layout completo da /ferramentamropromo com vídeo, valores e Stripe da página Euro. */
const InstagramNovaEuro = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("pro");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackPageView("Sales Page - Instagram MRO Euro (GBP)");
  }, []);

  useEffect(() => {
    const success = searchParams.get("success");
    const sid = searchParams.get("session_id");
    if (success === "true" && sid) {
      setLoading(true);
      void verifyPayment(sid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const verifyPayment = async (sid: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-euro-payment", { body: { session_id: sid } });
      if (error) { toast.error("Erro ao verificar pagamento"); return; }
      if (data.status === "completed") {
        toast.success("Pagamento confirmado e acesso liberado!");
        navigate("/mroobrigado?euro=true&username=" + (data.order?.username || ""));
      } else if (data.status === "paid") {
        toast.success("Pagamento confirmado! Acesso será liberado em breve.");
      } else {
        toast.info("Pagamento ainda não confirmado. Aguarde alguns instantes.");
      }
    } catch (err) {
      console.error("Error verifying payment:", err);
      toast.error("Erro ao verificar pagamento");
    } finally {
      setLoading(false);
    }
  };

  const validateUsername = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
    setUsername(cleaned);
    if (value !== cleaned) setUsernameError("Apenas letras minúsculas, sem espaços ou números");
    else if (cleaned.length < 4) setUsernameError("Mínimo de 4 caracteres");
    else if (cleaned.length > 20) setUsernameError("Máximo de 20 caracteres");
    else setUsernameError("");
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { toast.error("Please enter a valid email"); return; }
    if (!username || username.length < 4) { toast.error("Username must have at least 4 characters"); return; }
    if (usernameError) { toast.error(usernameError); return; }
    setLoading(true);
    try {
      const plan = PLANS[selectedPlan];
      const { data, error } = await supabase.functions.invoke("create-euro-checkout", {
        body: {
          email: email.toLowerCase().trim(),
          username: username.toLowerCase().trim(),
          phone: phone.replace(/\D/g, "").trim(),
          planType: selectedPlan,
          amount: plan.price,
          checkUserExists: true,
        },
      });
      if (error) { toast.error("Erro ao criar link de pagamento. Tente novamente."); return; }
      if (data.userExists) {
        toast.error("Este nome de usuário já está em uso. Escolha outro.");
        setUsernameError("Usuário já existe, escolha outro");
        return;
      }
      if (!data.success) { toast.error(data.error || "Erro ao criar pagamento"); return; }
      trackInitiateCheckout(`Plano ${plan.name} GBP`, plan.price);
      window.location.href = data.payment_url;
    } catch (err) {
      console.error("Error:", err);
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const openPlan = (key: PlanKey) => {
    trackLead(`Instagram MRO GBP - Plano ${PLANS[key].name}`);
    setSelectedPlan(key);
    setShowCheckoutModal(true);
    trackInitiateCheckout(`Plano ${PLANS[key].name} GBP`, PLANS[key].price);
  };

  const heroVideo = (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border">
      <iframe
        src="https://www.youtube.com/embed/lecSwt54sa0?rel=0&modestbranding=1"
        title="Video MRO"
        className="w-full aspect-video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );

  const pricingContent = (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center mb-3 sm:mb-4">
        ESCOLHA SEU <span className="text-primary">PLANO</span>
      </h2>
      <p className="text-center text-muted-foreground mb-8 sm:mb-10 text-base sm:text-lg">Pagamento único em Libras (£) via Stripe</p>
      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        {(Object.keys(PLANS) as PlanKey[]).map((key) => {
          const plan = PLANS[key];
          return (
            <div key={key} className="bg-gradient-to-b from-card to-background border-2 border-border/60 rounded-2xl sm:rounded-3xl p-5 sm:p-8 relative overflow-hidden flex flex-col">
              {key === "pro" && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                  <div className="bg-primary text-primary-foreground font-bold px-4 sm:px-6 py-1.5 sm:py-2 rounded-b-xl text-xs sm:text-sm whitespace-nowrap">⭐ RECOMENDADO</div>
                </div>
              )}
              <div className="text-center mt-6 mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Plano {plan.name} Anual</h3>
                <p className="text-muted-foreground text-sm mb-4">{plan.accounts} contas simultâneas</p>
                <div className="text-primary text-5xl sm:text-6xl md:text-7xl font-black">£{plan.price}</div>
                <p className="text-muted-foreground mt-2 font-bold">Pagamento único via Stripe</p>
                <p className="text-muted-foreground text-xs sm:text-sm">Acesso por 1 ano</p>
              </div>
              <div className="space-y-3 mb-6 sm:mb-8 flex-1">
                {FEATURES(plan.accounts).map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm sm:text-base">{f}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => openPlan(key)} className="w-full bg-gradient-to-r from-card to-background text-foreground font-bold text-base sm:text-xl py-5 sm:py-7 rounded-xl shadow-lg shadow-primary/30 gap-2">
                <ShoppingCart className="w-5 h-5" /> ESCOLHER {plan.name.toUpperCase()}
              </Button>
              <div className="flex items-center justify-center gap-3 mt-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1"><Shield className="w-4 h-4" /><span>Compra Segura</span></div>
                <div className="flex items-center gap-1"><CreditCard className="w-4 h-4" /><span>Cartão via Stripe</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const plan = PLANS[selectedPlan];

  return (
    <Ferramentammmr heroVideo={heroVideo} pricingContent={pricingContent}>
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] bg-background/90 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setShowCheckoutModal(false)}>
          <div className="bg-card border border-border/30 rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 relative my-4" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" onClick={() => setShowCheckoutModal(false)} aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
              <h3 className="text-xl font-bold">Plano {plan.name}</h3>
              <p className="text-3xl font-bold text-primary mt-2">£{plan.price}</p>
              <p className="text-sm text-muted-foreground mt-1">Pagamento via Stripe (Libras)</p>
            </div>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><Mail className="w-4 h-4" />Your Email</label>
                <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><Phone className="w-4 h-4" />Phone (optional)</label>
                <Input type="tel" placeholder="+44 7000 000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><User className="w-4 h-4" />Username (will be your password too)</label>
                <Input type="text" placeholder="yourusername" value={username} onChange={(e) => validateUsername(e.target.value)} required />
                {usernameError && <p className="text-xs text-destructive mt-1">{usernameError}</p>}
                <p className="text-xs text-muted-foreground mt-1">Only lowercase letters, no spaces or numbers</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Username/Password</span><span className="font-mono">{username || "---"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-primary">£{plan.price}</span></div>
              </div>
              <Button type="submit" className="w-full font-bold py-5" disabled={loading || !!usernameError || !username || !email}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>) : (<><CreditCard className="mr-2 h-5 w-5" />Pay £{plan.price} with Stripe</>)}
              </Button>
              <p className="text-xs text-muted-foreground text-center">After payment, your access will be unlocked automatically</p>
            </form>
          </div>
        </div>
      )}
    </Ferramentammmr>
  );
};

export default InstagramNovaEuro;
