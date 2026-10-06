import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { brl, wlCall, type WlPlan } from '@/lib/whitelabel';

/** Página pública de venda pelo link do revendedor (/wl/:code). */
export default function WhitelabelCheckout() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const linkType = params.get('tipo') === 'renda_extra' ? 'renda_extra' : 'cliente_final';
  const [info, setInfo] = useState<{ ok: boolean; prices?: Record<string, number> } | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; username: string; plan: WlPlan }>({ name: '', email: '', username: '', plan: 'annual' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Ferramenta MRO — Assinatura';
    wlCall<{ success: boolean; prices: Record<string, number> }>('public_link_info', { code })
      .then((r) => setInfo({ ok: true, prices: r.prices })).catch(() => setInfo({ ok: false }));
  }, [code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const { checkout_url } = await wlCall<{ checkout_url: string }>('public_checkout', { code, link_type: linkType, ...form });
      window.location.href = checkout_url;
    } catch (err) { toast.error((err as Error).message); setBusy(false); }
  };

  if (!info) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!info.ok) return <div className="min-h-screen flex items-center justify-center bg-background p-4"><p className="text-muted-foreground">Link indisponível.</p></div>;

  if (params.get('pago')) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 max-w-md text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Pagamento recebido!</h1>
          <p className="text-muted-foreground">Assim que for aprovado, seu acesso à Ferramenta MRO chega no seu e-mail.</p>
        </Card>
      </main>
    );
  }

  const prices = info.prices ?? { annual: 397, lifetime: 1200 };
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center">Ferramenta MRO</h1>
        <p className="text-sm text-muted-foreground text-center mb-5">{linkType === 'renda_extra' ? 'Comece sua renda extra com a ferramenta inovadora' : 'Cresça seu Instagram com a ferramenta inovadora'}</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['annual', 'lifetime'] as WlPlan[]).map((p) => (
              <button type="button" key={p} onClick={() => setForm({ ...form, plan: p })}
                className={`rounded-md border p-3 text-left ${form.plan === p ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <p className="font-bold">{p === 'annual' ? 'Anual' : 'Vitalício'}</p>
                <p className="text-sm">{brl(prices[p])}</p>
                <p className="text-xs text-muted-foreground">{p === 'annual' ? '4 contas' : '12 contas'}</p>
              </button>
            ))}
          </div>
          <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><Label>Usuário desejado (será também sua senha)</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required minLength={3} /></div>
          <Button className="w-full" size="lg" disabled={busy}>{busy ? 'Abrindo pagamento...' : 'Pagar e liberar acesso'}</Button>
        </form>
      </Card>
    </main>
  );
}
