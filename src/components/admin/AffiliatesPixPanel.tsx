import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminSessionToken } from "@/lib/adminConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Affiliate { id: string; name: string; email: string; squarecloudUsername?: string; active: boolean; pixKey: string }

export default function AffiliatesPixPanel() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.functions.invoke("afiliadosx", { body: { action: "admin_list", admin_token: getAdminSessionToken() } });
      if (error || !data?.success) throw new Error(data?.error || "Não foi possível carregar os afiliados");
      setAffiliates(data.affiliates);
    } catch (error) { setError(error instanceof Error ? error.message : "Erro ao carregar"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);
  const filtered = affiliates.filter(a => `${a.name} ${a.email} ${a.id} ${a.squarecloudUsername || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="space-y-6">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div><h2 className="text-2xl font-bold">Afiliados e chaves Pix</h2><p className="text-sm text-muted-foreground">{affiliates.filter(a => a.active).length} ativos · {affiliates.length} cadastrados</p></div>
      <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
    </div>
    <Input aria-label="Buscar afiliado" placeholder="Buscar por nome, e-mail ou usuário" value={search} onChange={e => setSearch(e.target.value)} />
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {loading && !affiliates.length ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="overflow-x-auto">
      <table className="w-full text-sm"><thead><tr className="border-b border-border text-muted-foreground">{["Afiliado", "Login / identificador", "Status", "Chave Pix"].map(t => <th key={t} className="text-left py-3 pr-4">{t}</th>)}</tr></thead>
        <tbody>{filtered.map(a => <tr key={a.id} className="border-b border-border">
          <td className="py-4 pr-4"><strong>{a.name}</strong><p className="text-muted-foreground">{a.email}</p></td>
          <td className="pr-4">{a.squarecloudUsername || "—"}<p className="text-muted-foreground">{a.id}</p></td>
          <td className="pr-4"><Badge variant={a.active ? "default" : "secondary"}>{a.active ? "Ativo" : "Inativo"}</Badge></td>
          <td className="min-w-48 break-all">{a.pixKey || "Não informada"}{a.pixKey && <Button variant="ghost" size="icon" aria-label={`Copiar Pix de ${a.name}`} onClick={() => navigator.clipboard.writeText(a.pixKey).then(() => toast.success("Pix copiado"))}><Copy className="h-4 w-4" /></Button>}</td>
        </tr>)}</tbody>
      </table>{!filtered.length && !error && <p className="py-6 text-muted-foreground">Nenhum afiliado encontrado.</p>}
    </div>}
  </section>;
}