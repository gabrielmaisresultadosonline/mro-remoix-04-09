import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView, trackLead, trackInitiateCheckout } from "@/lib/facebookTracking";
import { toast } from "sonner";
import { CheckCircle2, Shield, X, Mail, User, CreditCard, Loader2, Phone, ShoppingCart, Sparkles } from "lucide-react";
import Ferramentammmr from "./Ferramentammmr";
import { PromoHlsVideo } from "@/components/sales/PromoHlsVideo";

// Planos em Libras Esterlinas (£) — valores e pagamento Stripe próprios desta página.
const PLANS = {
  pro: { name: "Pro", price: 397, accounts: 4 },
  agencia: { name: "Agencia", price: 997, accounts: 10 },
} as const;
type PlanKey = keyof typeof PLANS;

const FEATURES = (accounts: number) => [
  "Herramienta completa",
  "Inteligencia artificial",
  "Soporte",
  "Grupo VIP en WhatsApp",
  `${accounts} cuentas fijas`,
  "Videos Paso a Paso",
];

/** Layout completo da /ferramentamropromo com vídeo, valores e Stripe da página Euro, em espanhol. */
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
      if (error) { toast.error("Error al verificar el pago"); return; }
      if (data.status === "completed") {
        toast.success("¡Pago confirmado y acceso liberado!");
        navigate("/mroobrigado?euro=true&username=" + (data.order?.username || ""));
      } else if (data.status === "paid") {
        toast.success("¡Pago confirmado! El acceso se liberará en breve.");
      } else {
        toast.info("El pago aún no se ha confirmado. Espera unos instantes.");
      }
    } catch (err) {
      console.error("Error verifying payment:", err);
      toast.error("Error al verificar el pago");
    } finally {
      setLoading(false);
    }
  };

  const validateUsername = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
    setUsername(cleaned);
    if (value !== cleaned) setUsernameError("Solo letras minúsculas, sin espacios ni números");
    else if (cleaned.length < 4) setUsernameError("Mínimo de 4 caracteres");
    else if (cleaned.length > 20) setUsernameError("Máximo de 20 caracteres");
    else setUsernameError("");
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { toast.error("Introduce un correo electrónico válido"); return; }
    if (!username || username.length < 4) { toast.error("El nombre de usuario debe tener al menos 4 caracteres"); return; }
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
      if (error) { toast.error("Error al crear el enlace de pago. Inténtalo de nuevo."); return; }
      if (data.userExists) {
        toast.error("Este nombre de usuario ya está en uso. Elige otro.");
        setUsernameError("El nombre de usuario ya existe, elige otro");
        return;
      }
      if (!data.success) { toast.error(data.error || "Error al crear el pago"); return; }
      trackInitiateCheckout(`Plano ${plan.name} GBP`, plan.price);
      window.location.href = data.payment_url;
    } catch (err) {
      console.error("Error:", err);
      toast.error("Error al procesar. Inténtalo de nuevo.");
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

  const youtubeFallback = (
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

  // Vídeo enviado pelo /instagram-nova-euro/admin (HLS); sem vídeo configurado, mantém o vídeo atual.
  const heroVideo = <PromoHlsVideo source="euro" trackPageView={false} fallback={youtubeFallback} />;

  useEffect(() => {
    supabase.functions.invoke("euro-page-admin", { body: { action: "track_visit", path: window.location.pathname } }).catch(() => {});
  }, []);

  const pricingContent = (
    <div className="max-w-6xl mx-auto">
      <div className="mb-10 sm:mb-12 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-4 sm:py-5 text-center">
        <p className="text-base sm:text-xl font-bold text-foreground">🇧🇷 Herramienta brasileña con más de <span className="text-primary">1.800 empresas</span> usándola</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Garantía de 30 días · Soporte en portugués</p>
      </div>
      <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center mb-3 sm:mb-4">
        ELIGE TU <span className="text-primary">PLAN</span>
      </h2>
      <p className="text-center text-muted-foreground mb-8 sm:mb-10 text-base sm:text-lg">Pago único en Libras (£) vía Stripe</p>
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
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Plan {plan.name} {key === "agencia" ? "Vitalicio" : "Anual"}</h3>
                <p className="text-muted-foreground text-sm mb-4">{plan.accounts} cuentas simultáneas</p>
                <div className="text-primary text-5xl sm:text-6xl md:text-7xl font-black">£{plan.price}</div>
                <p className="text-muted-foreground mt-2 font-bold">Pago único vía Stripe</p>
                <p className="text-muted-foreground text-xs sm:text-sm">{key === "agencia" ? "Acceso de por vida" : "Acceso por 1 año"}</p>
                <div className="mt-4 flex flex-col items-center gap-1.5 text-xs sm:text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary font-semibold"><Shield className="w-4 h-4" /> Garantía de 30 días</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-muted-foreground">Soporte en portugués</span>
                </div>
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
                <ShoppingCart className="w-5 h-5" /> ELEGIR {plan.name.toUpperCase()}
              </Button>
              <div className="flex items-center justify-center gap-3 mt-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1"><Shield className="w-4 h-4" /><span>Compra Segura</span></div>
                <div className="flex items-center gap-1"><CreditCard className="w-4 h-4" /><span>Tarjeta vía Stripe</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const plan = PLANS[selectedPlan];

  return (
    <Ferramentammmr lang="es" showWhatsApp={false} heroVideo={heroVideo} pricingContent={pricingContent}>
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] bg-background/90 flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setShowCheckoutModal(false)}>
          <div className="bg-card border border-border/30 rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 relative my-4" onClick={(e) => e.stopPropagation()}>
            <button className="absolute top-3 right-3 text-muted-foreground hover:text-foreground" onClick={() => setShowCheckoutModal(false)} aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
              <h3 className="text-xl font-bold">Plan {plan.name}</h3>
              <p className="text-3xl font-bold text-primary mt-2">£{plan.price}</p>
              <p className="text-sm text-muted-foreground mt-1">Pago vía Stripe (Libras)</p>
            </div>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><Mail className="w-4 h-4" />Tu Correo Electrónico</label>
                <Input type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><Phone className="w-4 h-4" />Teléfono (opcional)</label>
                <Input type="tel" placeholder="+44 7000 000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-2 mb-2"><User className="w-4 h-4" />Nombre de usuario (también será tu contraseña)</label>
                <Input type="text" placeholder="tunombre" value={username} onChange={(e) => validateUsername(e.target.value)} required />
                {usernameError && <p className="text-xs text-destructive mt-1">{usernameError}</p>}
                <p className="text-xs text-muted-foreground mt-1">Solo letras minúsculas, sin espacios ni números</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Usuario/Contraseña</span><span className="font-mono">{username || "---"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold text-primary">£{plan.price}</span></div>
              </div>
              <Button type="submit" className="w-full font-bold py-5" disabled={loading || !!usernameError || !username || !email}>
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generando...</>) : (<><CreditCard className="mr-2 h-5 w-5" />Pagar £{plan.price} con Stripe</>)}
              </Button>
              <p className="text-xs text-muted-foreground text-center">Después del pago, tu acceso se liberará automáticamente</p>
            </form>
          </div>
        </div>
      )}
    </Ferramentammmr>
  );
};

export default InstagramNovaEuro;
