import { useEffect, useState, type FormEvent } from "react";
import { Download, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Teste002Features } from "@/components/teste002/Teste002Features";
import { MRO_LOGO, fmtDate, loadTeste002Fonts, teste002Call, type Teste002Test } from "@/lib/teste002";

interface Session { name: string; test: Teste002Test; video_url: string; install_url: string }
const KEY = "teste002_login";

const embed = (url: string) => {
  const yt = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  if (yt) return { kind: "iframe" as const, src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "iframe" as const, src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: "video" as const, src: url };
};

/** /teste002/dashboard — área do usuário de teste (vídeo, instalar e funções liberadas). */
const Teste002Dashboard = () => {
  const [creds, setCreds] = useState({ username: "", password: "" });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (c: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const r = await teste002Call<Session>({ action: "user_login", ...c });
      setSession(r);
      sessionStorage.setItem(KEY, JSON.stringify(c));
    } catch (err) {
      sessionStorage.removeItem(KEY);
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeste002Fonts();
    document.title = "Meu Teste Grátis | MRO";
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      try { void login(JSON.parse(saved)); } catch { sessionStorage.removeItem(KEY); }
    }
  }, []);

  const submit = (e: FormEvent) => { e.preventDefault(); void login(creds); };
  const sair = () => { sessionStorage.removeItem(KEY); setSession(null); };

  if (!session) {
    return (
      <main className="teste002-theme relative flex min-h-screen items-center justify-center px-4">
        <div className="t2-glow pointer-events-none absolute inset-0" aria-hidden />
        <form onSubmit={submit} className="t2-rise relative w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6">
          <img src={MRO_LOGO} alt="MRO" className="mx-auto h-12 w-auto" />
          <h1 className="t2-title text-center text-2xl">Acessar meu teste</h1>
          <div className="space-y-1.5"><Label htmlFor="t2-u">Usuário</Label>
            <Input id="t2-u" required autoCapitalize="none" value={creds.username} onChange={(e) => setCreds({ ...creds, username: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="t2-p">Senha</Label>
            <Input id="t2-p" type="password" required value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} /></div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading} className="w-full font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "ENTRAR"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Usuário e senha foram enviados para o seu e-mail.</p>
        </form>
      </main>
    );
  }

  const { test } = session;
  const media = session.video_url ? embed(session.video_url) : null;

  return (
    <main className="teste002-theme relative min-h-screen px-4 py-8">
      <div className="t2-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-4xl space-y-8">
        <header className="flex items-center justify-between gap-3">
          <img src={MRO_LOGO} alt="MRO" className="h-10 w-auto" />
          <Button variant="outline" size="sm" onClick={sair} className="gap-2"><LogOut className="h-4 w-4" aria-hidden />Sair</Button>
        </header>

        <section className="t2-rise text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-primary">Olá, {session.name.split(" ")[0]}</p>
          <h1 className="t2-title mt-1 text-2xl md:text-4xl">TESTE DE 1 DIA · APENAS 1 CONTA DO INSTAGRAM</h1>
          <p className="mt-2 text-muted-foreground">
            Instagram do teste: <strong className="text-foreground">@{test.instagram}</strong> · {test.expired ? "Teste encerrado" : `Termina em ${fmtDate(test.expires_at)}`}
          </p>
        </section>

        {test.expired ? (
          <section className="rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden />
            <p className="mt-2 font-bold text-destructive">Seu teste terminou. O acesso foi bloqueado e o Instagram @{test.instagram} foi registrado como teste já feito.</p>
            <Button asChild className="mt-4 font-bold"><a href="/ferramentamropromo">QUERO CONTINUAR COM O PLANO</a></Button>
          </section>
        ) : null}

        <section className="t2-rise overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-video w-full bg-background">
            {media?.kind === "iframe" ? (
              <iframe src={media.src} title="Vídeo do teste MRO" className="h-full w-full" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
            ) : media ? (
              <video src={media.src} controls playsInline className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">Vídeo em breve</div>
            )}
          </div>
          <div className="p-5">
            <Button asChild={Boolean(session.install_url)} disabled={!session.install_url || test.expired} className="w-full py-6 text-base font-bold">
              {session.install_url ? (
                <a href={session.install_url} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-5 w-5" aria-hidden />INSTALAR A FERRAMENTA</a>
              ) : (<span>Link de instalação em breve</span>)}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="t2-title text-xl">O que está liberado no seu teste</h2>
          <p className="text-sm text-muted-foreground">
            No teste grátis só estão liberados <strong className="text-primary">SEGUIR, CURTIR e BOAS-VINDAS</strong>. Todo o resto está bloqueado e libera apenas no plano.
          </p>
          <Teste002Features />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          Esse é um teste para mostrar a eficácia do sistema e que somos reais com o que entregamos. Após o teste, caso deseje continuar,
          o acesso será bloqueado e seu Instagram será reconhecido como teste já feito — ou seja, não será possível usar o teste de novo no
          mesmo Instagram, apenas comprando o plano.
        </section>
      </div>
    </main>
  );
};

export default Teste002Dashboard;
