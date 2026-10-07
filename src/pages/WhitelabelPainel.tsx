import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { WL_TOKEN_KEY, wlCall, type WlClient, type WlFee, type WlReseller, type WlSale, type WlTutorial, type WlUser } from '@/lib/whitelabel';
import { WlHomeTab } from '@/components/whitelabel/WlHomeTab';
import { WlClientsTab } from '@/components/whitelabel/WlClientsTab';
import { WlFinanceTab } from '@/components/whitelabel/WlFinanceTab';
import { WlLinksTab } from '@/components/whitelabel/WlLinksTab';

export interface WlDashboard {
  reseller: WlReseller; clients: WlClient[]; users: WlUser[]; fees: WlFee[]; sales: WlSale[]; tutorials: WlTutorial[];
}

/** Painel do revendedor whitelabel (/whitelabel). */
export default function WhitelabelPainel() {
  const [token, setToken] = useState(() => localStorage.getItem(WL_TOKEN_KEY));
  const [data, setData] = useState<WlDashboard | null>(null);
  const [form, setForm] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);

  const logout = useCallback(() => { localStorage.removeItem(WL_TOKEN_KEY); setToken(null); setData(null); }, []);
  const load = useCallback(async () => {
    try { setData(await wlCall<WlDashboard>('me')); }
    catch (e) { toast.error((e as Error).message); logout(); }
  }, [logout]);

  useEffect(() => { document.title = 'Painel Whitelabel MRO'; if (token) load(); }, [token, load]);
  // Atualização automática do histórico de vendas a cada 15s.
  useEffect(() => { if (!token) return; const t = setInterval(load, 15000); return () => clearInterval(t); }, [token, load]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await wlCall<{ token: string }>('login', form);
      localStorage.setItem(WL_TOKEN_KEY, r.token); setToken(r.token);
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-1">Whitelabel MRO</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Acesso do revendedor</p>
          <form onSubmit={login} className="space-y-4">
            <div><Label htmlFor="u">Usuário</Label><Input id="u" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
            <div><Label htmlFor="p">Senha</Label><Input id="p" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <Button className="w-full" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</Button>
          </form>
        </Card>
      </main>
    );
  }

  if (!data) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div><h1 className="text-xl font-bold">Painel Whitelabel</h1><p className="text-xs text-muted-foreground">{data.reseller.name}</p></div>
          <Button variant="outline" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-1" />Sair</Button>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="home">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="home">Início</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="links">Links de venda</TabsTrigger>
            <TabsTrigger value="finance">Taxas e recebimento</TabsTrigger>
          </TabsList>
          <TabsContent value="home"><WlHomeTab data={data} onChanged={load} /></TabsContent>
          <TabsContent value="clients"><WlClientsTab data={data} onChanged={load} /></TabsContent>
          <TabsContent value="links"><WlLinksTab data={data} /></TabsContent>
          <TabsContent value="finance"><WlFinanceTab data={data} onChanged={load} /></TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
