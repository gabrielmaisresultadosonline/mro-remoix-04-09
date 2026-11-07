import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasCadastroRendOptOut, initializeCadastroRendPixel, isCadastroRendLeadEligible, refuseCadastroRendAdvertising, reportCadastroRendLead } from "@/lib/cadastroRendLead";
import { Loader2, ArrowRight, Users, Laptop, AlertTriangle, Instagram } from "lucide-react";
import logoMro from "@/assets/logo-mro.png";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Step = "intro" | "nome" | "whatsapp" | "email" | "pc" | "final" | "sem-pc";

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const CadastroRend = () => {
  const [step, setStep] = useState<Step>("intro");
  const [form, setForm] = useState({ nome: "", email: "", whatsapp: "" });
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const submitting = useRef(false);
  const [advertisingRefused, setAdvertisingRefused] = useState(hasCadastroRendOptOut);
  const isPrivacyPage = new URLSearchParams(window.location.search).get("privacidade") === "1";
  const [privacyOpen, setPrivacyOpen] = useState(isPrivacyPage);

  useEffect(() => {
    document.title = "Utilize a MRO você também! | Grupo grátis";
    if (!isPrivacyPage) void initializeCadastroRendPixel();
    const syncChoice = () => {
      setAdvertisingRefused(hasCadastroRendOptOut());
      if (hasCadastroRendOptOut()) window.fbq?.("consent", "revoke");
    };
    window.addEventListener("storage", syncChoice);
    if (!sessionStorage.getItem("cadastrorend_visit")) {
      sessionStorage.setItem("cadastrorend_visit", "1");
      supabase.functions.invoke("cadastrorend", { body: { action: "visit" } }).catch(() => {});
    }
    return () => window.removeEventListener("storage", syncChoice);
  }, []);

  const avancar = (next: Step, valido: boolean, msg: string) => {
    if (!valido) return setErro(msg);
    setErro("");
    setStep(next);
  };

  const finalizar = async (tem: boolean) => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setErro("");
    try {
      const { data, error } = await supabase.functions.invoke("cadastrorend", {
        body: { action: "register", ...form, tem_computador: tem },
      });
      if (error || data?.success !== true) throw new Error("registration failed");
      const grupo = typeof data.grupo_link === "string" ? data.grupo_link.trim() : "";
      setLink(tem ? grupo : "");
      setStep(tem ? "final" : "sem-pc");
      if (isCadastroRendLeadEligible(tem, data.success, grupo)) {
        void reportCadastroRendLead(crypto.randomUUID());
      }
    } catch {
      setErro("Não conseguimos salvar seu cadastro. Tente novamente.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  const input = "w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-4 text-xl font-medium text-white outline-none transition placeholder:text-neutral-500 focus:border-yellow-400";
  const btn = "flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-4 text-xl font-extrabold text-black transition hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-60";

  // Instagram oficial: clicou, abre o perfil no Instagram.
  const INSTAGRAM_URL = "https://www.instagram.com/maisresultadosonline/";
  const instagramLink = (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-auto flex w-fit items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-base font-bold text-white transition hover:border-yellow-400 hover:text-yellow-400"
    >
      <Instagram className="h-5 w-5 shrink-0 text-yellow-400" />
      Siga nosso Instagram <span className="text-yellow-400">@maisresultadosonline</span>
    </a>
  );

  const campo = (key: "nome" | "email" | "whatsapp", label: string, next: Step, ok: boolean, msg: string, type = "text") => (
    <form onSubmit={(e) => { e.preventDefault(); avancar(next, ok, msg); }} className="space-y-4">
      <label className="block text-2xl font-extrabold leading-snug text-white sm:text-3xl">{label}</label>
      <input
        autoFocus type={type} inputMode={key === "whatsapp" ? "tel" : undefined}
        value={form[key]} maxLength={key === "email" ? 255 : 120}
        onChange={(e) => setForm({ ...form, [key]: key === "whatsapp" ? formatPhone(e.target.value) : e.target.value })}
        className={input}
        placeholder={key === "nome" ? "Seu nome completo" : key === "email" ? "seu@email.com" : "(00) 00000-0000"}
      />
      {erro && <p className="text-base font-semibold text-yellow-400">{erro}</p>}
      <button type="submit" className={btn}>Avançar <ArrowRight className="h-6 w-6" /></button>
    </form>
  );

  const progress = { intro: 0, nome: 25, whatsapp: 50, email: 75, pc: 90, final: 100, "sem-pc": 100 }[step];

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-black px-4 py-10">
      <div className="w-full max-w-md">
        <img src={logoMro} alt="MRO" width={1350} height={594} className="mx-auto mb-6 h-16 w-auto object-contain sm:h-20" />
        {step !== "intro" && (
          <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
        <div key={step} className="animate-fade-in rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl sm:p-8">
          {step === "intro" && (
            <div className="space-y-6 text-center">
              <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                Utilize a <span className="text-yellow-400">MRO</span> você também!
              </h1>
              <p className="text-xl font-semibold text-neutral-200 sm:text-2xl">
                Participe <span className="text-yellow-400">GRÁTIS</span> do nosso <span className="text-yellow-400">GRUPO</span> no WhatsApp e aprenda como fazer tudo!
              </p>
              <button onClick={() => setStep("nome")} className={`${btn} animate-pulse`}>
                <Users className="h-6 w-6" /> PARTICIPAR AGORA
              </button>
            </div>
          )}
          {step === "nome" && campo("nome", "Qual é o seu nome completo?", "whatsapp", form.nome.trim().split(/\s+/).length >= 2, "Digite seu nome completo.")}
          {step === "whatsapp" && campo("whatsapp", "Qual é o seu número de WhatsApp?", "email", form.whatsapp.replace(/\D/g, "").length >= 10, "Digite um número válido com DDD.")}
          {step === "email" && campo("email", "Qual é o seu e-mail?", "pc", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()), "Digite um e-mail válido.", "email")}
          {step === "pc" && (
            <div className="space-y-5 text-center">
              <Laptop className="mx-auto h-14 w-14 text-yellow-400" />
              <h2 className="text-2xl font-extrabold leading-snug text-white sm:text-3xl">Tem notebook, computador de mesa ou MacBook?</h2>
              <div className="grid gap-3">
                {erro && <p role="alert" className="text-base font-semibold text-yellow-400">{erro}</p>}
                <button disabled={loading} onClick={() => finalizar(true)} className={btn}>
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sim"}
                </button>
                <button disabled={loading} onClick={() => finalizar(false)} className="rounded-xl border border-neutral-600 bg-neutral-800 px-6 py-4 text-xl font-extrabold text-white transition hover:bg-neutral-700 disabled:opacity-60">
                  Não, apenas celular/tablet
                </button>
              </div>
            </div>
          )}
          {step === "final" && (
            <div className="space-y-5 text-center">
              <h2 className="text-3xl font-extrabold text-white">Link <span className="text-yellow-400">liberado!</span></h2>
              <p className="text-lg text-neutral-300">Obrigado, {form.nome.split(" ")[0]}! Clique abaixo para entrar no grupo.</p>
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className={btn}>
                  <Users className="h-6 w-6" /> ENTRAR NO GRUPO
                </a>
              ) : (
                <p className="text-base text-yellow-400">O link do grupo ainda não foi configurado. Entraremos em contato pelo WhatsApp.</p>
              )}
            </div>
          )}
          {step === "sem-pc" && (
            <div className="space-y-5 text-center">
              <AlertTriangle className="mx-auto h-14 w-14 text-yellow-400" />
              <p className="text-xl font-semibold leading-relaxed text-white">
                Infelizmente não é possível usar a MRO em celular ou tablet, apenas em computador de mesa, notebook ou MacBook.
              </p>
              <p className="text-lg text-neutral-300">
                Quando estiver com algum desses, entre em contato conosco novamente para poder aplicar!
              </p>
              <p className="text-lg font-bold text-yellow-400">Obrigado pelo contato.</p>
              <div className="pt-2">{instagramLink}</div>
            </div>
          )}
        </div>
        <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
          <div className="mt-3 text-center">
            <DialogTrigger asChild>
              <Button variant="link" className="h-auto px-2 py-1 text-[10px] font-normal text-muted-foreground">Política de privacidade</Button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg border-border bg-background text-foreground">
            <DialogHeader className="pr-6">
              <DialogTitle className="leading-snug">Privacidade</DialogTitle>
              <DialogDescription className="sr-only">Dados do cadastro</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm leading-relaxed">
              <p>Seu nome, e-mail e WhatsApp são guardados pela MRO apenas para liberar o grupo e entrar em contato. Esta página também mede anúncios (Meta).</p>
              <label className="flex items-start gap-2 text-xs text-muted-foreground"><input className="mt-0.5 shrink-0" type="checkbox" checked={advertisingRefused} disabled={advertisingRefused} onChange={() => { refuseCadastroRendAdvertising(); setAdvertisingRefused(true); }} /> Não permitir medição de anúncios</label>
            </div>
            <Button variant="outline" onClick={() => setPrivacyOpen(false)}>Voltar ao cadastro</Button>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
};

export default CadastroRend;
