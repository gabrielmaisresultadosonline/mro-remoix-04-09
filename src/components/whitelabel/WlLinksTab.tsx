import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { brl, planLabel } from '@/lib/whitelabel';
import type { WlDashboard } from '@/pages/WhitelabelPainel';

export function WlLinksTab({ data }: { data: WlDashboard }) {
  const base = `${window.location.origin}/wl/${data.reseller.link_code}`;
  const links = [
    { label: 'Link Renda Extra', url: `${base}?tipo=renda_extra` },
    { label: 'Link Cliente Final', url: `${base}?tipo=cliente_final` },
  ];
  const copy = (u: string) => { navigator.clipboard.writeText(u); toast.success('Link copiado'); };

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-bold">Seus links de venda (pagamento MRO)</h2>
        <p className="text-sm text-muted-foreground">Ao aprovar, o cliente recebe o acesso automaticamente e você recebe um e-mail de venda aprovada. O valor (já sem a taxa) é repassado para o seu PIX.</p>
        {links.map((l) => (
          <div key={l.label}>
            <p className="text-sm font-semibold mb-1">{l.label}</p>
            <div className="flex gap-2"><Input readOnly value={l.url} /><Button variant="outline" onClick={() => copy(l.url)}><Copy className="w-4 h-4" /></Button></div>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <h2 className="font-bold mb-2">Histórico em tempo real</h2>
        <div className="space-y-1 text-sm">
          {data.sales.length === 0 && <p className="text-muted-foreground">Nenhuma tentativa ainda.</p>}
          {data.sales.map((s) => (
            <div key={s.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2">
              <span>{new Date(s.created_at).toLocaleString('pt-BR')} · {s.buyer_name || s.buyer_email} · {planLabel(s.plan)} · {s.link_type === 'renda_extra' ? 'Renda Extra' : 'Cliente Final'}</span>
              <span className="flex items-center gap-2">{brl(s.amount)}
                <Badge variant={s.status === 'paid' ? 'default' : 'secondary'}>{s.status === 'paid' ? (s.payout_status === 'paid' ? 'Pago e repassado' : 'Aprovada') : s.status === 'pending' ? 'Tentativa' : 'Expirada'}</Badge>
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
