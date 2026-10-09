import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackLead } from "@/lib/facebookTracking";
import { MRO_LOGO, loadTeste002Fonts, teste002Call } from "@/lib/teste002";

interface Form { full_name: string; email: string; whatsapp: string }

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** /teste002 — cadastro do TESTE GRÁTIS de 1 dia da Ferramenta MRO. */
const Teste002 = () => {
  const [form, setForm] = useState<Form>({ full_name: "", email: "", whatsapp: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ username: string; email_sent: boolean } | null>(null);

  useEffect(() => {
    loadTeste002Fonts();
    document.title = "Teste Grátis Ferramenta MRO";
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await teste002Call<{ username: string; email_sent: boolean }>({ action: "register", ...form });
      trackLead("Teste Grátis MRO", { email: form.email, phone: form.whatsapp.replace(/\D/g, ""), content_name: "Teste Grátis MRO" });
      setDone(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === "whatsapp" ? maskPhone(e.target.value) : e.target.value }));

  return (
    <main className="teste002-theme relative min-h-screen overflow-hidden px-4 py-10">
      <div className="t2-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-lg">
        <img src={MRO_LOGO} alt="MRO" className="mx-auto mb-6 h-14 w-auto" />
        <p className="t2-rise text-center text-sm font-bold uppercase tracking-widest text-primary">Teste grátis · 1 dia</p>
        <h1 className="t2-title t2-rise mt-2 text-center text-3xl md:text-5xl">TESTE GRÁTIS FERRAMENTA MRO</h1>
        <p className="t2-rise mt-3 text-center text-muted-foreground">
          Veja na prática que somos reais e entregamos o que prometemos. Teste em 1 conta do Instagram com Seguir, Curtir e Boas-vindas. O Instagram é cadastrado direto na extensão, na hora de usar.
        </p>

        <section className="t2-rise mt-8 rounded-2xl border border-border bg-card p-6 shadow-2xl">
          {done ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-primary" aria-hidden />
              <h2 className="t2-title text-2xl">Cadastro feito!</h2>
              <p className="text-muted-foreground">
                {done.email_sent ? (
                  <><Mail className="mr-1 inline h-4 w-4" aria-hidden />Enviamos seu acesso para o seu e-mail.</>
                ) : "Seu acesso está pronto."}
              </p>
              <div className="rounded-xl border border-primary/40 bg-background p-4 text-left text-sm">
                <p><strong>Usuário:</strong> {done.username}</p>
                <p><strong>Senha:</strong> {done.username}</p>
              </div>
              <Button asChild className="w-full font-bold"><Link to="/teste002/dashboard">ACESSAR MEU TESTE</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="t2-nome">Nome completo</Label>
                <Input id="t2-nome" required value={form.full_name} onChange={set("full_name")} autoComplete="name" /></div>
              <div className="space-y-1.5"><Label htmlFor="t2-email">E-mail</Label>
                <Input id="t2-email" type="email" required value={form.email} onChange={set("email")} autoComplete="email" /></div>
              <div className="space-y-1.5"><Label htmlFor="t2-wpp">WhatsApp</Label>
                <Input id="t2-wpp" inputMode="tel" required value={form.whatsapp} onChange={set("whatsapp")} placeholder="(11) 99999-9999" /></div>
              {error ? <p role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={loading} className="w-full py-6 text-base font-bold">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "QUERO MEU TESTE GRÁTIS"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Cada Instagram pode fazer o teste só uma vez (o dia de teste começa quando você cadastra o Instagram na extensão). Após o teste, o acesso é bloqueado e o perfil fica registrado como teste já realizado.
              </p>
            </form>
          )}
        </section>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já se cadastrou? <Link to="/teste002/dashboard" className="font-bold text-primary underline">Entrar</Link>
        </p>
      </div>
    </main>
  );
};

export default Teste002;
