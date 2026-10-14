import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, LogOut, Plus, Radio, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { StreamCard } from "@/components/aovivo/StreamCard";
import { AdminLimits } from "@/components/aovivo/AdminLimits";
import { aovivo, clearToken, formatDuration, getToken, type AoVivoMe } from "@/lib/aovivoApi";

const STEPS = [
  "No Instagram, toque em + → Ao vivo → Transmitir com software de streaming.",
  "Copie a URL do stream e a Chave de stream e cole aqui.",
  "Suba de 1 a 20 vídeos (no máximo 100MB somando todos) e clique em Iniciar ao vivo.",
  "Quando o Instagram mostrar a imagem, selecione Go live. A lista roda em loop até você pausar.",
];

const Login = ({ onDone }: { onDone: () => void }) => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try { await aovivo.login(identifier, password); onDone(); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="av-card w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size="md" />
          <h1 className="av-title text-2xl">AO VIVO <span className="av-ig-text">MRO</span></h1>
          <p className="text-sm text-muted-foreground">Entre com seu acesso da MRO Ferramenta</p>
        </div>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
        <div className="space-y-1"><Label htmlFor="av-id">Usuário ou e-mail</Label><Input id="av-id" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required /></div>
        <div className="space-y-1"><Label htmlFor="av-pw">Senha</Label><Input id="av-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <Button type="submit" className="av-ig-button w-full" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}</Button>
      </form>
    </main>
  );
};

const AoVivo = () => {
  const { toast } = useToast();
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [me, setMe] = useState<AoVivoMe | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { document.title = "Ao Vivo MRO — Live contínua no Instagram"; }, []);

  const load = useCallback(async () => {
    try { setMe(await aovivo.me()); setError(""); }
    catch (e) { if (!getToken()) setAuthed(false); setError((e as Error).message); }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [authed, load]);

  const create = async () => {
    try { await aovivo.create(`Live ${(me?.streams.length ?? 0) + 1}`); await load(); }
    catch (e) { toast({ title: "Ops", description: (e as Error).message, variant: "destructive" }); }
  };

  const liveCount = me?.streams.filter((s) => s.status === "running").length ?? 0;
  const totalSeconds = me?.streams.reduce((sum, s) => sum + s.total_seconds, 0) ?? 0;

  return (
    <div className="aovivo-theme min-h-screen">
      <div className="av-glow pointer-events-none fixed inset-0" aria-hidden />
      {!authed ? <Login onDone={() => setAuthed(true)} /> : (
        <main className="relative mx-auto max-w-6xl space-y-6 px-4 py-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Logo size="sm" />
              <div><h1 className="av-title text-xl md:text-2xl">AO VIVO <span className="av-ig-text">INSTAGRAM</span></h1>
                <p className="text-xs text-muted-foreground">{me ? `${me.kind === "admin" ? "Admin" : "@" + me.label}` : "Carregando…"}</p></div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { clearToken(); setAuthed(false); setMe(null); }}><LogOut className="mr-1 h-4 w-4" />Sair</Button>
          </header>

          <section className="av-hero rounded-2xl p-5 md:p-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-1 h-6 w-6 shrink-0" />
              <div><h2 className="text-lg font-bold md:text-xl">Fique sempre em primeiro para os seus seguidores</h2>
                <p className="mt-1 text-sm opacity-90">Quem está ao vivo aparece na frente de todos, no topo dos Stories e na lista dos seus seguidores. Mantendo sua live rodando em loop, seu perfil fica em destaque o tempo todo e reativa o algoritmo do Instagram.</p></div>
            </div>
          </section>

          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[{ icon: Radio, label: "Ao vivo agora", value: String(liveCount) },
              { icon: Activity, label: me?.kind === "admin" ? "Lives cadastradas" : "Suas lives", value: `${me?.streams.length ?? 0}${me?.kind === "user" ? ` / ${me.max_streams}` : ""}` },
              { icon: TrendingUp, label: "Tempo total no ar", value: formatDuration(totalSeconds) }].map((s) => (
              <div key={s.label} className="av-card rounded-2xl border border-border bg-card p-4">
                <s.icon className="h-5 w-5 text-primary" /><p className="mt-2 text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Como transmitir</h2>
            <ol className="mt-3 grid gap-2 md:grid-cols-2">
              {STEPS.map((s, i) => (<li key={s} className="flex gap-3 text-sm text-muted-foreground"><span className="av-step">{i + 1}</span>{s}</li>))}
            </ol>
          </section>

          {me?.kind === "admin" && <AdminLimits />}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{me?.kind === "admin" ? "Todas as lives" : "Minhas lives"}</h2>
            <Button className="av-ig-button" onClick={create} disabled={!me || (me.kind === "user" && me.streams.length >= me.max_streams)}><Plus className="mr-1 h-4 w-4" />Nova live</Button>
          </div>
          {!me ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : me.streams.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhuma live ainda. Clique em “Nova live” para começar.</p>
          ) : (
            <div className="space-y-4">
              {me.streams.map((s) => <StreamCard key={s.id} stream={s} maxBytes={me.max_playlist_bytes} showOwner={me.kind === "admin"} onChange={load} />)}
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default AoVivo;
