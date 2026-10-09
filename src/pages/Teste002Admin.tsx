import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, LogOut, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MRO_LOGO, fmtDate, loadTeste002Fonts, teste002Call, type Teste002AdminUser } from "@/lib/teste002";

const KEY = "teste002_admin_token";
interface ListResponse { users: Teste002AdminUser[]; video_url: string; install_url: string }

/** /teste002/admin — lista de cadastros do teste grátis e configuração do vídeo/instalação. */
const Teste002Admin = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(KEY));
  const [creds, setCreds] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Teste002AdminUser[]>([]);
  const [cfg, setCfg] = useState({ video_url: "", install_url: "" });
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"cadastros" | "config">("cadastros");

  const carregar = async (t: string) => {
    setLoading(true);
    try {
      const r = await teste002Call<ListResponse>({ action: "list", token: t });
      setUsers(r.users);
      setCfg({ video_url: r.video_url, install_url: r.install_url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg === "Unauthorized") { localStorage.removeItem(KEY); setToken(null); }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeste002Fonts(); if (token) void carregar(token); }, [token]);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await teste002Call<{ token: string }>({ action: "login", ...creds });
      localStorage.setItem(KEY, r.token);
      setToken(r.token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Credenciais inválidas");
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    try {
      await teste002Call({ action: "save_settings", token, ...cfg });
      toast.success("Configuração salva");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => [u.full_name, u.email, u.whatsapp, u.instagram_username].some((f) => f?.toLowerCase().includes(t)));
  }, [users, busca]);
  const ativos = users.filter((u) => Date.parse(u.expires_at) > Date.now()).length;

  if (!token) {
    return (
      <main className="teste002-theme flex min-h-screen items-center justify-center px-4">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6">
          <img src={MRO_LOGO} alt="MRO" className="mx-auto h-12 w-auto" />
          <h1 className="t2-title text-center text-xl">Admin · Teste Grátis</h1>
          <div className="space-y-1.5"><Label htmlFor="a-e">E-mail</Label>
            <Input id="a-e" type="email" required value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="a-p">Senha</Label>
            <Input id="a-p" type="password" required value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} /></div>
          <Button type="submit" disabled={loading} className="w-full font-bold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "ENTRAR"}</Button>
        </form>
      </main>
    );
  }

  return (
    <main className="teste002-theme min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><img src={MRO_LOGO} alt="MRO" className="h-9 w-auto" /><h1 className="t2-title text-xl">Teste Grátis · Admin</h1></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => token && void carregar(token)} className="gap-2"><RefreshCw className="h-4 w-4" />Atualizar</Button>
            <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem(KEY); setToken(null); }} className="gap-2"><LogOut className="h-4 w-4" />Sair</Button>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3">
          {[["Cadastros", users.length], ["Em teste", ativos], ["Encerrados", users.length - ativos]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="t2-title text-2xl text-primary">{v}</p></div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant={aba === "cadastros" ? "default" : "outline"} onClick={() => setAba("cadastros")}>Cadastros</Button>
          <Button size="sm" variant={aba === "config" ? "default" : "outline"} onClick={() => setAba("config")}>Configuração</Button>
        </div>

        {aba === "config" ? (
          <section className="max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="space-y-1.5"><Label htmlFor="c-v">Link do vídeo (YouTube, Vimeo ou MP4)</Label>
              <Input id="c-v" value={cfg.video_url} onChange={(e) => setCfg({ ...cfg, video_url: e.target.value })} placeholder="https://..." /></div>
            <div className="space-y-1.5"><Label htmlFor="c-i">Link do botão Instalar</Label>
              <Input id="c-i" value={cfg.install_url} onChange={(e) => setCfg({ ...cfg, install_url: e.target.value })} placeholder="https://..." /></div>
            <Button onClick={() => void salvar()} className="font-bold">Salvar</Button>
          </section>
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input className="pl-9" placeholder="Buscar nome, e-mail, WhatsApp ou @" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar cadastros" />
            </div>
            {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <tr><th className="px-3 py-3">Nome</th><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">WhatsApp</th><th className="px-3 py-3">Instagram</th><th className="px-3 py-3">Cadastro</th><th className="px-3 py-3">Término</th><th className="px-3 py-3">Último acesso</th><th className="px-3 py-3">Status</th></tr>
                  </thead>
                  <tbody>
                    {filtrados.map((u) => {
                      const ativo = Date.parse(u.expires_at) > Date.now();
                      return (
                        <tr key={u.id} className="border-b border-border/60 last:border-0">
                          <td className="px-3 py-3 font-medium">{u.full_name}</td>
                          <td className="px-3 py-3 text-muted-foreground">{u.email}{u.email_sent ? "" : " (e-mail não enviado)"}</td>
                          <td className="px-3 py-3"><a className="text-primary underline" href={`https://wa.me/55${u.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">{u.whatsapp}</a></td>
                          <td className="px-3 py-3">@{u.instagram_username}</td>
                          <td className="px-3 py-3 text-muted-foreground">{fmtDate(u.created_at)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{fmtDate(u.expires_at)}</td>
                          <td className="px-3 py-3 text-muted-foreground">{fmtDate(u.last_access)}</td>
                          <td className="px-3 py-3"><Badge variant={ativo ? "default" : "secondary"}>{ativo ? "Em teste" : "Encerrado"}</Badge></td>
                        </tr>
                      );
                    })}
                    {filtrados.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum cadastro</td></tr> : null}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default Teste002Admin;
