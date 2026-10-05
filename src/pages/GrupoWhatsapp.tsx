import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackLead } from "@/lib/facebookTracking";
import { Loader2, ArrowRight, Users, Laptop, AlertTriangle } from "lucide-react";
import logoMro from "@/assets/logo-mro.png";

type Step = "intro" | "nome" | "email" | "whatsapp" | "pc" | "final" | "sem-pc";

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const GrupoWhatsapp = () => {
  const [step, setStep] = useState<Step>("intro");
  const [form, setForm] = useState({ nome: "", email: "", whatsapp: "" });
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    document.title = "Grupo Grátis | A ferramenta inovadora MRO";
  }, []);

  const avancar = (next: Step, valido: boolean, msg: string) => {
    if (!valido) return setErro(msg);
    setErro("");
    setStep(next);
  };

  const finalizar = async (tem: boolean) => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("grupowhatsapp", {
        body: { action: "register", ...form, tem_computador: tem },
      });
      setLink(data?.grupo_link ?? "");
    } catch {
      /* segue o fluxo mesmo com falha de rede */
    }
    trackLead("Grupo WhatsApp MRO", { email: form.email, phone: form.whatsapp.replace(/\D/g, ""), content_name: "Grupo WhatsApp MRO" });
    setLoading(false);
    setStep(tem ? "final" : "sem-pc");
  };

  const input = "w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-4 text-xl font-medium text-white outline-none transition placeholder:text-neutral-500 focus:border-yellow-400";
  const btn = "flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-6 py-4 text-xl font-extrabold text-black transition hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-60";

  const campo = (key: "nome" | "email" | "whatsapp", label: string, next: Step, ok: boolean, msg: string, type = "text") => (
    <form onSubmit={(e) => { e.preventDefault(); avancar(next, ok, msg); }} className="space-y-4">
      <label className="block text-2xl font-extrabold leading-snug text-white sm:text-3xl">{label}</label>
      <input
        autoFocus type={type} inputMode={key === "whatsapp" ? "tel" : undefined}
        value={form[key]} maxLength={key === "email" ? 255 : 120}
        onChange={(e) => setForm({ ...form, [key]: key === "whatsapp" ? formatPhone(e.target.value) : e.target.value })}
        className={input}
        placeholder={key === "nome" ? "Seu nome" : key === "email" ? "seu@email.com" : "(00) 00000-0000"}
      />
      {erro && <p className="text-base font-semibold text-yellow-400">{erro}</p>}
      <button type="submit" className={btn}>Avançar <ArrowRight className="h-6 w-6" /></button>
    </form>
  );

  const progress = { intro: 0, nome: 25, email: 50, whatsapp: 75, pc: 90, final: 100, "sem-pc": 100 }[step];

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-black via-neutral-950 to-neutral-900 px-4 py-10">
      <div className="w-full max-w-md">
        <img
          src={logoMro}
          alt="I.A MRO"
          width={1350}
          height={594}
          className="mx-auto mb-6 h-16 w-auto object-contain sm:h-20"
        />
        {step !== "intro" && (
          <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
        <div key={step} className="animate-fade-in rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6 shadow-2xl sm:p-8">
          {step === "intro" && (
            <div className="space-y-6 text-center">
              <span className="inline-block rounded-full border border-yellow-400/40 px-5 py-1.5 text-sm font-bold uppercase tracking-widest text-yellow-400">Grupo gratuito</span>
              <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                A ferramenta inovadora <span className="text-yellow-400">MRO</span>
              </h1>
              <p className="text-xl font-semibold text-neutral-200 sm:text-2xl">Participe do GRUPO GRÁTIS e saiba mais!</p>
              <button onClick={() => setStep("nome")} className={`${btn} animate-pulse`}>
                <Users className="h-6 w-6" /> Participe do GRUPO GRÁTIS
              </button>
            </div>
          )}
          {step === "nome" && campo("nome", "Qual é o seu nome?", "email", form.nome.trim().length >= 2, "Digite seu nome.")}
          {step === "email" && campo("email", "Qual é o seu e-mail?", "whatsapp", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()), "Digite um e-mail válido.", "email")}
          {step === "whatsapp" && campo("whatsapp", "Qual é o seu WhatsApp?", "pc", form.whatsapp.replace(/\D/g, "").length >= 10, "Digite um número válido com DDD.")}
          {step === "pc" && (
            <div className="space-y-5 text-center">
              <Laptop className="mx-auto h-14 w-14 text-yellow-400" />
              <h2 className="text-2xl font-extrabold leading-snug text-white sm:text-3xl">Já tem computador, notebook ou Mac?</h2>
              <div className="grid grid-cols-2 gap-3">
                <button disabled={loading} onClick={() => finalizar(true)} className={btn}>
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Sim"}
                </button>
                <button disabled={loading} onClick={() => finalizar(false)} className="rounded-xl border border-neutral-600 bg-neutral-800 px-6 py-4 text-xl font-extrabold text-white transition hover:bg-neutral-700 disabled:opacity-60">
                  Não
                </button>
              </div>
            </div>
          )}
          {step === "final" && (
            <div className="space-y-5 text-center">
              <h2 className="text-3xl font-extrabold text-white">Tudo pronto, {form.nome.split(" ")[0]}!</h2>
              <p className="text-lg font-semibold text-neutral-200">Clique abaixo para entrar no grupo.</p>
              {link ? (
                <a href={link} target="_blank" rel="noopener noreferrer" className={btn}>
                  <Users className="h-6 w-6" /> Clique para entrar no grupo
                </a>
              ) : (
                <p className="text-lg font-semibold text-yellow-400">O link do grupo será liberado em instantes. Tente novamente mais tarde.</p>
              )}
            </div>
          )}
          {step === "sem-pc" && (
            <div className="space-y-4 text-center">
              <AlertTriangle className="mx-auto h-14 w-14 text-yellow-400" />
              <h2 className="text-2xl font-extrabold text-white">Infelizmente...</h2>
              <p className="text-lg font-semibold leading-relaxed text-neutral-200">
                Para conseguir aplicar a ferramenta, você precisa de pelo menos um notebook básico, um computador de mesa ou MacBook.
                Compre algum e volte aqui novamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default GrupoWhatsapp;
