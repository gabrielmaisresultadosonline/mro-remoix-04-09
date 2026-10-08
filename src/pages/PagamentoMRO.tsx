import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView, trackInitiateCheckout } from "@/lib/facebookTracking";
import { toast } from "sonner";
import {
  CheckCircle2,
  Shield,
  Loader2,
  Users,
  Bot,
  MessageCircle,
  Monitor,
  Crown,
  Sparkles,
  Lock,
  ArrowLeft,
  Zap,
  Infinity as InfinityIcon,
} from "lucide-react";
import logoMro from "@/assets/logo-mro.png";

type PlanKey = "solo" | "pro" | "lifetime" | "trial";

const PLANS: Record<PlanKey, {
  name: string;
  price: number;
  installment: string;
  accounts: number;
  planType: string;
  durationLabel: string;
  badge?: string;
  highlight?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  solo: {
    name: "Anual Solo",
    price: 247.0,
    installment: "25",
    accounts: 1,
    planType: "solo",
    durationLabel: "1 ano de acesso",
    icon: Crown,
  },
  pro: {
    name: "Anual Pro",
    price: 397.0,
    installment: "40",
    accounts: 4,
    planType: "pro",
    durationLabel: "1 ano de acesso",
    badge: "MAIS VENDIDO",
    highlight: true,
    icon: Sparkles,
  },
  lifetime: {
    name: "Agência Vitalício",
    price: 1197.0,
    installment: "122",
    accounts: 12,
    planType: "lifetime",
    durationLabel: "Pagamento único · Vitalício",
    badge: "MELHOR CUSTO",
    icon: InfinityIcon,
  },
  trial: {
    name: "Teste 1 Dia",
    price: 97.0,
    installment: "8",
    accounts: 4,
    planType: "trial",
    durationLabel: "1 dia · liberação imediata",
    badge: "COMECE AQUI",
    icon: Zap,
  },
};

const BENEFITS = [
  { icon: Bot, text: "Ferramenta MRO completa (Instagram)" },
  { icon: Monitor, text: "Área de Membros completa" },
  { icon: Crown, text: "Grupo VIP Vitalício" },
  { icon: MessageCircle, text: "Suporte via WhatsApp" },
  { icon: Users, text: "Suporte via AnyDesk" },
  { icon: Sparkles, text: "Inteligência Artificial integrada" },
];

const formatBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

const PagamentoMRO = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("pro");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const usernameCheckTimeoutRef = useRef<any | null>(null);

  useEffect(() => {
    trackPageView("Pagamento MRO - Checkout Direto");
  }, []);

  const checkUsernameAvailability = async (u: string): Promise<boolean | null> => {
    if (u.length < 4) { setUsernameAvailable(null); return null; }
    setCheckingUsername(true);
    try {
      const body = new URLSearchParams({ nome: u, numero: u });
      const response = await fetch("https://dashboardmroinstagramvini-online.squareweb.app/verificar-numero", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setUsernameAvailable(null); return null; }
      if (data?.senhaCorrespondente === true) {
        setUsernameAvailable(false);
        setUsernameError("Usuário já em uso. Utilize outro usuário");
        return false;
      }
      if (data?.senhaCorrespondente === false) {
        setUsernameAvailable(true);
        setUsernameError("");
        return true;
      }
      return null;
    } catch { return null; } finally { setCheckingUsername(false); }
  };

  const validateUsername = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z]/g, "");
    setUsername(cleaned); setUsernameAvailable(null);
    if (usernameCheckTimeoutRef.current) clearTimeout(usernameCheckTimeoutRef.current);
    if (value !== cleaned) { setUsernameError("Apenas letras minúsculas, sem espaços ou números"); return; }
    if (cleaned.length < 4) { setUsernameError("Mínimo de 4 caracteres"); return; }
    if (cleaned.length > 20) { setUsernameError("Máximo de 20 caracteres"); return; }
    setUsernameError("");
    usernameCheckTimeoutRef.current = setTimeout(() => { void checkUsernameAvailability(cleaned); }, 500);
  };

  const handleSelectPlan = (key: PlanKey) => {
    setSelectedPlan(key);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) { toast.error("Informe seu nome"); return; }
    if (!email || !email.includes("@")) { toast.error("Email inválido"); return; }
    if (!phone || phone.replace(/\D/g, "").length < 10) { toast.error("WhatsApp inválido com DDD"); return; }
    if (!username || username.length < 4) { toast.error("Usuário deve ter no mínimo 4 caracteres"); return; }
    if (usernameError) { toast.error(usernameError); return; }
    if (checkingUsername) { toast.error("Aguarde a verificação do usuário"); return; }
    const availability = usernameAvailable ?? (await checkUsernameAvailability(username.toLowerCase().trim()));
    if (availability === false) { toast.error("Este usuário já está em uso"); return; }

    setLoading(true);
    try {
      const plan = PLANS[selectedPlan];
      const { data, error } = await supabase.functions.invoke("create-mro-checkout", {
        body: {
          email: email.toLowerCase().trim(),
          username: username.toLowerCase().trim(),
          phone: phone.replace(/\D/g, "").trim(),
          name: name.trim(),
          planType: plan.planType,
          amount: plan.price,
          checkUserExists: true,
          redirectTo: "https://maisresultadosonline.com.br/pagamentomro/obrigado",
        },
      });
      if (error) { toast.error("Erro ao criar link de pagamento"); return; }
      if (data.userExists) {
        toast.error("Este usuário já está em uso.");
        setUsernameError("Usuário já existe, escolha outro");
        return;
      }
      if (!data.success) { toast.error(data.error || "Erro ao criar pagamento"); return; }
      trackInitiateCheckout(`Plano ${plan.name}`, plan.price);
      window.location.href = data.payment_link;
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const plan = PLANS[selectedPlan];
  // Teste primeiro, depois Pro (mais vendido), Solo e Vitalício
  // Ordem: Teste → Solo → Pro → Agência Vitalício
  const planKeys: PlanKey[] = ["trial", "solo", "pro", "lifetime"];

  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-amber-300/60">
      {/* Ambient gradients (light) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute top-40 -right-32 w-[520px] h-[520px] rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-yellow-100/60 blur-3xl" />
      </div>

      <header className="border-b border-zinc-200/70 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logoMro} alt="MRO" className="h-8" />
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium">
            <Lock className="w-3.5 h-3.5" />
            Checkout 100% seguro
          </div>
        </div>
      </header>


      <main className="max-w-6xl mx-auto px-4 py-8 md:py-14 animate-fade-in">
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8 text-xs">
          <span className={`px-3 py-1.5 rounded-full font-bold transition-all ${step === 1 ? "bg-zinc-900 text-white shadow-md" : "bg-emerald-500 text-white"}`}>
            1 · Escolha o plano
          </span>
          <span className="w-8 h-px bg-zinc-300" />
          <span className={`px-3 py-1.5 rounded-full font-bold transition-all ${step === 2 ? "bg-zinc-900 text-white shadow-md" : "bg-zinc-100 text-zinc-500"}`}>
            2 · Seus dados
          </span>
        </div>

        {step === 1 && (
          <>
            <div className="text-center mb-10 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-4 border border-amber-200">
                <Sparkles className="w-3 h-3" /> Ferramenta MRO Instagram
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 leading-[1.05]">
                Escolha seu{" "}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600 bg-clip-text text-transparent">
                    plano MRO
                  </span>
                  <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full opacity-60" />
                </span>
              </h1>
              <p className="text-zinc-600 text-base md:text-lg max-w-2xl mx-auto">
                Comece pelo <strong className="text-emerald-600">Teste 1 Dia</strong> ou vá direto para o plano que faz mais sentido pra você.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
              {planKeys.map((key, idx) => {
                const p = PLANS[key];
                const Icon = p.icon;
                // Paleta única por plano
                const theme = {
                  trial: {
                    card: "border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-white shadow-[0_20px_50px_-15px_rgba(16,185,129,0.35)] hover:shadow-[0_30px_70px_-15px_rgba(16,185,129,0.5)] ring-4 ring-emerald-500/15",
                    iconBox: "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/40",
                    badge: "bg-emerald-500 text-white",
                    button: "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 group-hover:shadow-xl group-hover:shadow-emerald-500/60 group-hover:from-emerald-600 group-hover:to-emerald-700",
                  },
                  solo: {
                    card: "border-sky-400 bg-gradient-to-br from-sky-50 via-white to-white shadow-[0_20px_50px_-15px_rgba(14,165,233,0.3)] hover:shadow-[0_30px_70px_-15px_rgba(14,165,233,0.45)] ring-2 ring-sky-400/10",
                    iconBox: "bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/40",
                    badge: "bg-sky-500 text-white",
                    button: "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 group-hover:shadow-xl group-hover:shadow-sky-500/60 group-hover:from-sky-600 group-hover:to-blue-700",
                  },
                  pro: {
                    card: "border-amber-500 bg-gradient-to-br from-amber-50 via-white to-yellow-50 shadow-[0_25px_60px_-15px_rgba(245,158,11,0.4)] hover:shadow-[0_35px_80px_-15px_rgba(245,158,11,0.55)] ring-4 ring-amber-500/20 scale-100 lg:scale-[1.03]",
                    iconBox: "bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-500 text-white shadow-lg shadow-amber-500/50",
                    badge: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
                    button: "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white shadow-lg shadow-amber-500/50 group-hover:shadow-xl group-hover:shadow-amber-500/70 group-hover:from-amber-600 group-hover:via-orange-600 group-hover:to-yellow-600",
                  },
                  lifetime: {
                    card: "border-violet-500 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 shadow-[0_20px_50px_-15px_rgba(139,92,246,0.35)] hover:shadow-[0_30px_70px_-15px_rgba(139,92,246,0.5)] ring-2 ring-violet-500/15",
                    iconBox: "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/40",
                    badge: "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white",
                    button: "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/40 group-hover:shadow-xl group-hover:shadow-violet-500/60 group-hover:from-violet-600 group-hover:to-fuchsia-700",
                  },
                }[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectPlan(key)}
                    style={{ animationDelay: `${idx * 60}ms` }}
                    className={`group relative text-left p-6 rounded-2xl border-2 bg-white transition-all duration-300 hover:-translate-y-2 animate-fade-in ${theme.card}`}
                  >
                    {p.badge && (
                      <span className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black px-3 py-1 rounded-full shadow-md tracking-wider ${theme.badge}`}>
                        {p.badge}
                      </span>
                    )}

                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 transition-transform group-hover:scale-110 group-hover:rotate-3 ${theme.iconBox}`}>
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="font-bold text-lg text-zinc-900 mb-1">{p.name}</div>
                    <div className="text-[11px] text-zinc-500 mb-3">{p.durationLabel}</div>

                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-4xl font-black text-zinc-900">
                        {formatBRL(p.price).replace("R$ ", "R$")}
                      </span>
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mb-4 border border-emerald-200">
                      12x de R$ {p.installment}
                    </div>

                    <div className="space-y-2 text-sm text-zinc-700 border-t border-zinc-100 pt-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span><strong>{p.accounts}</strong> {p.accounts === 1 ? "conta" : "contas"} Instagram</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        Ferramenta MRO completa
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        Área VIP + Suporte
                      </div>
                    </div>

                    <div className={`mt-5 w-full text-center py-3 rounded-xl font-black text-sm transition-all group-hover:scale-[1.02] ${theme.button}`}>
                      Selecionar plano →
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Benefícios rápidos */}
            <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-3">
              {BENEFITS.map((b, i) => {
                const Icon = b.icon;
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-zinc-200 hover:border-amber-300 hover:shadow-sm transition-all">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs md:text-sm font-medium text-zinc-700">{b.text}</span>
                  </div>
                );
              })}
            </div>

            {/* Garantia */}
            <div className="mt-10 max-w-2xl mx-auto relative overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-6 shadow-lg shadow-emerald-500/10">
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Shield className="w-8 h-8" />
                </div>
                <div>
                  <p className="font-black text-emerald-700 text-xl">
                    Garantia incondicional de 30 dias
                  </p>
                  <p className="text-sm text-zinc-600">
                    Se não gostar, devolvemos 100% do seu dinheiro. Sem perguntas.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-5 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Trocar plano
            </button>

            <div className="grid lg:grid-cols-5 gap-6">
              <form onSubmit={handleCheckout} className="lg:col-span-3 space-y-5">
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div>
                    <h2 className="font-black text-xl text-zinc-900">Seus dados</h2>
                    <p className="text-xs text-zinc-500 mt-1">Envelope enviado por email após o pagamento.</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700">Nome completo</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como devemos te chamar" className="mt-1 bg-white border-zinc-300" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-zinc-700">Email</label>
                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1 bg-white border-zinc-300" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-zinc-700">WhatsApp (com DDD)</label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="mt-1 bg-white border-zinc-300" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-700">Usuário de acesso</label>
                    <Input
                      value={username}
                      onChange={(e) => validateUsername(e.target.value)}
                      placeholder="apenas letras minúsculas"
                      className="mt-1 bg-white border-zinc-300"
                    />
                    {usernameError && <p className="text-xs text-red-500 mt-1 font-medium">{usernameError}</p>}
                    {usernameAvailable === true && !usernameError && (
                      <p className="text-xs text-emerald-600 mt-1 font-medium">✓ Usuário disponível</p>
                    )}
                    {checkingUsername && <p className="text-xs text-zinc-500 mt-1">Verificando…</p>}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 text-base font-black bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:via-orange-600 hover:to-yellow-600 text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all hover:scale-[1.02]"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando link…</>
                    ) : (
                      <>🚀 Pagar agora · {formatBRL(plan.price)}</>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <Lock className="w-3 h-3" /> Pagamento processado com segurança pela InfiniPay
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-5">
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <Shield className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="font-black text-emerald-700 text-lg">
                        Garantia de 30 dias
                      </p>
                      <p className="text-sm text-zinc-600">
                        100% do seu dinheiro de volta.
                      </p>
                    </div>
                  </div>
                </div>
              </form>

              <aside className="lg:col-span-2">
                <div className="sticky top-24 bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-lg">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h2 className="font-black text-zinc-900">Resumo do pedido</h2>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-4">
                    <div className="text-[11px] uppercase tracking-wider font-bold text-amber-700 mb-1">Plano selecionado</div>
                    <div className="font-black text-xl text-zinc-900">{plan.name}</div>
                    <div className="text-4xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mt-2">
                      {formatBRL(plan.price)}
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md mt-2 border border-emerald-200">
                      12x de R$ {plan.installment}
                    </div>
                    <div className="text-xs text-zinc-600 mt-3 font-medium">
                      {plan.accounts} {plan.accounts === 1 ? "conta" : "contas"} · {plan.durationLabel}
                    </div>
                  </div>
                  <ul className="space-y-2.5">
                    {BENEFITS.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-sm text-zinc-700">{b.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-6 mt-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-zinc-500">
          © MRO · Todos os direitos reservados · Gabriel Fernandes da Silva · CNPJ 54.840.738/0001-96
        </div>
      </footer>
    </div>
  );
};

export default PagamentoMRO;
