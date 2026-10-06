import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { brl, summarize, wlAdmin, type WlClient, type WlFee, type WlReseller, type WlSale, type WlTutorial, type WlUser } from '@/lib/whitelabel';
import { WhitelabelResellerCard } from './whitelabel/WhitelabelResellerCard';
import { WhitelabelResellerDialog } from './whitelabel/WhitelabelResellerDialog';
import { WhitelabelTutorialsAdmin } from './whitelabel/WhitelabelTutorialsAdmin';

interface Data { resellers: WlReseller[]; clients: WlClient[]; users: WlUser[]; fees: WlFee[]; sales: WlSale[]; tutorials: WlTutorial[] }

/** Menu "Whitelabel" do /admin: revendedores, clientes, financeiro e tutoriais. */
export default function WhitelabelPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<WlReseller | null | 'new'>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await wlAdmin<Data>('admin_list')); } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const total = summarize(data.fees, data.sales);
  const q = search.trim().toLowerCase();
  const list = data.resellers.filter((r) => !q || [r.name, r.username, r.email ?? ''].some((v) => v.toLowerCase().includes(q)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Whitelabel</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /></Button>
          <Button size="sm" onClick={() => setEditing('new')}><Plus className="w-4 h-4 mr-1" />Novo revendedor</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        {[['Revendedores', String(data.resellers.length)], ['Clientes criados', String(data.clients.length)], ['Taxas a receber (manuais)', brl(total.manualPending)], ['Repasses pendentes', brl(total.payoutPending)]].map(([k, v]) => (
          <div key={k} className="rounded-md bg-muted p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-bold text-lg">{v}</p></div>
        ))}
      </div>
      <Tabs defaultValue="resellers">
        <TabsList><TabsTrigger value="resellers">Revendedores</TabsTrigger><TabsTrigger value="tutorials">Tutoriais e avisos</TabsTrigger></TabsList>
        <TabsContent value="resellers" className="space-y-3">
          <Input placeholder="Buscar revendedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {list.map((r) => (
            <WhitelabelResellerCard key={r.id} reseller={r}
              clients={data.clients.filter((c) => c.reseller_id === r.id)} users={data.users}
              fees={data.fees.filter((f) => f.reseller_id === r.id)} sales={data.sales.filter((s) => s.reseller_id === r.id)}
              onEdit={() => setEditing(r)} onChanged={load} />
          ))}
          {list.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhum revendedor.</p>}
        </TabsContent>
        <TabsContent value="tutorials"><WhitelabelTutorialsAdmin tutorials={data.tutorials} onChanged={load} /></TabsContent>
      </Tabs>
      {editing && (
        <WhitelabelResellerDialog key={editing === 'new' ? 'new' : editing.id} open reseller={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={load} />
      )}
    </div>
  );
}
