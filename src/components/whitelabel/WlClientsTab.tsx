import { useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { brl, fmtDate, planLabel, wlCall, type WlPlan } from '@/lib/whitelabel';
import type { WlDashboard } from '@/pages/WhitelabelPainel';

export function WlClientsTab({ data, onChanged }: { data: WlDashboard; onChanged: () => void }) {
  const [form, setForm] = useState<{ username: string; email: string; plan: WlPlan }>({ username: '', email: '', plan: 'annual' });
  const [busy, setBusy] = useState(false);
  const canSell = data.reseller.can_sell !== false;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = form.plan === 'lifetime' ? 197 : 100;
    if (!confirm(`Criar ${form.username} (${planLabel(form.plan)})? Será lançada a taxa de ${brl(fee)}.`)) return;
    setBusy(true);
    try { await wlCall('create_client', form); toast.success('Cliente criado e acesso enviado por e-mail'); setForm({ username: '', email: '', plan: 'annual' }); onChanged(); }
    catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  const act = async (action: string, body: Record<string, unknown>, ok: string) => {
    try { await wlCall(action, body); toast.success(ok); onChanged(); } catch (e) { toast.error((e as Error).message); }
  };

  const [accessOpen, setAccessOpen] = useState<string | null>(null);
  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copiado`); };
  const copyMessage = (username: string, password: string) => {
    const msg = `Seu acesso à Ferramenta MRO está pronto!\n\nLink: ${window.location.origin}/dashboard\nUsuário: ${username}\nSenha: ${password}\n\nQualquer dúvida, estou à disposição.`;
    copy(msg, 'Mensagem de acesso');
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4">
        <h2 className="font-bold mb-3">Criar usuário da MRO Ferramenta</h2>
        {!canSell && <p className="text-sm text-destructive mb-2">Seu período de revenda expirou. Fale com a MRO.</p>}
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label>Usuário (também será a senha)</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} /></div>
          <div><Label>E-mail do cliente</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><Label>Plano</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as WlPlan })}>
              <option value="annual">Anual (4 contas) — taxa {brl(100)}</option>
              <option value="lifetime">Vitalício (12 contas) — taxa {brl(197)}</option>
            </select>
          </div>
          <Button disabled={busy || !canSell}>{busy ? 'Criando...' : 'Criar e enviar acesso'}</Button>
        </form>
      </Card>

      <div className="space-y-2">
        {data.clients.length === 0 && <p className="text-center text-muted-foreground py-6">Nenhum cliente ainda.</p>}
        {data.clients.map((c) => {
          const u = data.users.find((x) => x.id === c.mro_user_id);
          return (
            <Card key={c.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <b>{c.username}</b> <span className="text-muted-foreground">· {c.email}</span> <Badge variant="secondary">{planLabel(c.plan)}</Badge>
                {u && !u.is_active && <Badge variant="destructive" className="ml-1">Bloqueado</Badge>}
                <p className="text-xs text-muted-foreground">Criado {fmtDate(c.created_at)} · Contas {u?.plan_accounts ?? '—'} + {u?.extra_accounts ?? 0} adicionais · Testes usados {u?.trials_used ?? 0}/5{u?.expires_at && ` · Vence ${fmtDate(u.expires_at)}`}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={!canSell} onClick={() => {
                  const q = prompt(`Quantas contas adicionais? (taxa ${brl(40)} cada)`, '1');
                  if (q) act('add_extras', { client_id: c.id, quantity: Number(q) }, 'Adicionais liberados');
                }}>+ Adicionais</Button>
                <Button size="sm" variant="outline" onClick={() => act('reset_trials', { client_id: c.id }, 'Testes zerados')}>Zerar testes</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
