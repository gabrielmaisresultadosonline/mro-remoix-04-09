import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { brl, fmtDate, summarize, wlCall } from '@/lib/whitelabel';
import type { WlDashboard } from '@/pages/WhitelabelPainel';

export function WlFinanceTab({ data, onChanged }: { data: WlDashboard; onChanged: () => void }) {
  const s = summarize(data.fees, data.sales);
  const [pix, setPix] = useState({ pix_type: data.reseller.pix_type ?? 'CPF', pix_key: data.reseller.pix_key ?? '' });
  const [paying, setPaying] = useState(false);

  const pay = async () => {
    setPaying(true);
    try { const { checkout_url } = await wlCall<{ checkout_url: string }>('pay_fees'); window.location.href = checkout_url; }
    catch (e) { toast.error((e as Error).message); setPaying(false); }
  };
  const savePix = async () => {
    try { await wlCall('save_pix', pix); toast.success('PIX salvo'); onChanged(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Taxas a pagar', brl(s.manualPending)], ['Taxas já pagas', brl(s.feesPaid)], ['Vendido pelos links', brl(s.soldTotal)], ['A receber (já sem taxas)', brl(s.payoutPending)]].map(([k, v]) => (
          <Card key={k} className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="text-lg font-bold">{v}</p></Card>
        ))}
      </div>

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold">Pagar taxas pendentes</h2><p className="text-sm text-muted-foreground">Pagamento via InfiniPay, liquidado automaticamente após aprovação.</p></div>
        <Button onClick={pay} disabled={paying || s.manualPending <= 0}>{paying ? 'Abrindo...' : `Pagar ${brl(s.manualPending)}`}</Button>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Método de recebimento (PIX)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div><Label>Tipo</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={pix.pix_type} onChange={(e) => setPix({ ...pix, pix_type: e.target.value })}>
              {['CPF', 'CNPJ', 'E-mail', 'Telefone', 'Aleatória'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div><Label>Chave PIX</Label><Input value={pix.pix_key} onChange={(e) => setPix({ ...pix, pix_key: e.target.value })} /></div>
          <Button onClick={savePix}>Salvar PIX</Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Extrato de taxas</h2>
        <div className="space-y-1 text-sm">
          {data.fees.length === 0 && <p className="text-muted-foreground">Nenhuma taxa.</p>}
          {data.fees.map((f) => (
            <div key={f.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1">
              <span>{fmtDate(f.created_at)} · {f.description}{f.sale_id && ' (descontada do repasse)'}</span>
              <span>{brl(f.amount)} · <b className={f.status === 'paid' ? 'text-primary' : 'text-destructive'}>{f.status === 'paid' ? 'Pago' : 'Pendente'}</b></span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
