import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogOut, RefreshCw, Search } from "lucide-react";

interface Lead { id: string; nome: string; email: string; whatsapp: string; tem_computador: boolean | null; created_at: string }
const KEY = "grupowhatsapp_admin_token";

const GrupoWhatsappAdmin = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(KEY));
  const [creds, setCreds] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [link, setLink] = useState("");
  const [aba, setAba] = useState<"cadastros" | "config">("cadastros");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "sim" | "nao">("todos");

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("grupowhatsapp", { body });
    if (error || !data?.success) throw new Error(data?.error || "Erro na requisição");
    return data;
  };

  const sair = () => { localStorage.removeItem(KEY); setToken(null); };

  const carregar = async (t: string) => {
    setLoading(true);
    try {
      const d = await call({ action: "list", token: t });
      setLeads(d.leads ?? []); setLink(d.grupo_link ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Só desloga quando o token for realmente rejeitado; outros erros mantêm a sessão.
      if (/unauthorized/i.test(msg)) { toast.error("Sessão expirada, entre novamente"); sair(); }
      else toast.error(`Erro ao carregar cadastros: ${msg || "tente novamente"}`);
    } finally { setLoading(false); }
  };

  useEffect(() => { document.title = "Admin | Grupo WhatsApp MRO"; if (token) carregar(token); }, [token]); // eslint-disable-line

  const login = async () => {
    setLoading(true);
    try { const d = await call({ action: "login", ...creds }); localStorage.setItem(KEY, d.token); setToken(d.token); }
    catch (e) { toast.error(e instanceof Error && e.message !== "Erro na requisição" ? e.message : "Credenciais inválidas"); }
    finally { setLoading(false); }
  };

  const salvar = async () => {
    try { await call({ action: "save_settings", token, grupo_link: link.trim() }); toast.success("Link salvo"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
  };

  const inp = "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-white outline-none focus:border-yellow-400";
  const btn = "rounded-lg bg-yellow-400 px-4 py-2.5 font-bold text-black hover:bg-yellow-300 disabled:opacity-60";

  if (!token) return (
    <main className="flex min-h-screen items-center justify-center bg-black p-4">
      <form onSubmit={(e) => { e.preventDefault(); login(); }} className="w-full max-w-sm space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <h1 className="text-xl font-bold text-white">Admin Grupo WhatsApp</h1>
        <input className={inp} placeholder="E-mail" value={creds.email} onChange={(e) => setCreds({ ...creds, email: e.target.value })} />
        <input className={inp} type="password" placeholder="Senha" value={creds.password} onChange={(e) => setCreds({ ...creds, password: e.target.value })} />
        <button className={`${btn} w-full`} disabled={loading}>{loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Entrar"}</button>
      </form>
    </main>
  );

  const q = busca.trim().toLowerCase();
  const lista = leads.filter((l) =>
    (filtro === "todos" || (filtro === "sim" ? l.tem_computador === true : l.tem_computador !== true)) &&
    (!q || `${l.nome} ${l.email} ${l.whatsapp}`.toLowerCase().includes(q)));
  const comPc = leads.filter((l) => l.tem_computador).length;

  return (
    <main className="min-h-screen bg-black p-4 text-white sm:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Grupo WhatsApp <span className="text-yellow-400">MRO</span></h1>
          <div className="flex gap-2">
            <button onClick={() => carregar(token)} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-900"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button>
            <button onClick={sair} className="flex items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-900"><LogOut className="h-4 w-4" /> Sair</button>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-3">
          {[["Total", leads.length], ["Com computador", comPc], ["Sem computador", leads.length - comPc]].map(([t, v]) => (
            <div key={t} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4"><p className="text-xs text-neutral-400">{t}</p><p className="text-2xl font-bold text-yellow-400">{v}</p></div>
          ))}
        </div>

        <nav className="flex gap-2">
          {(["cadastros", "config"] as const).map((a) => (
            <button key={a} onClick={() => setAba(a)} className={`rounded-lg px-4 py-2 font-semibold ${aba === a ? "bg-yellow-400 text-black" : "bg-neutral-900 text-neutral-300"}`}>
              {a === "cadastros" ? "Cadastros" : "Configuração"}
            </button>
          ))}
        </nav>

        {aba === "config" ? (
          <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <h2 className="font-bold">Link do grupo (último botão do quiz)</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input className={inp} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://chat.whatsapp.com/..." />
              <button onClick={salvar} className={btn}>Salvar</button>
            </div>
          </section>
        ) : (
          <section className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                <input className={`${inp} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar nome, e-mail ou WhatsApp" />
              </div>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className={`${inp} sm:w-56`}>
                <option value="todos">Todos</option><option value="sim">Tem computador</option><option value="nao">Não tem computador</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="border-b border-neutral-800 text-left text-xs uppercase text-neutral-400">
                  <th className="py-2 pr-3">Nome</th><th className="py-2 pr-3">E-mail</th><th className="py-2 pr-3">WhatsApp</th><th className="py-2 pr-3">Computador</th><th className="py-2">Data</th>
                </tr></thead>
                <tbody>
                  {lista.map((l) => (
                    <tr key={l.id} className="border-b border-neutral-900">
                      <td className="py-2 pr-3">{l.nome}</td>
                      <td className="py-2 pr-3 text-neutral-300">{l.email}</td>
                      <td className="py-2 pr-3"><a className="text-yellow-400 hover:underline" href={`https://wa.me/55${l.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">{l.whatsapp}</a></td>
                      <td className="py-2 pr-3">{l.tem_computador ? <span className="text-yellow-400">Sim</span> : <span className="text-neutral-500">Não</span>}</td>
                      <td className="py-2 text-neutral-400">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                  {!lista.length && <tr><td colSpan={5} className="py-6 text-center text-neutral-500">{loading ? "Carregando..." : "Nenhum cadastro"}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default GrupoWhatsappAdmin;
