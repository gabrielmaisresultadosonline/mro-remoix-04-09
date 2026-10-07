import { WlLogoUpload } from './WlLogoUpload';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { brl, fmtDate, wlCall } from '@/lib/whitelabel';
import type { WlDashboard } from '@/pages/WhitelabelPainel';

const ytEmbed = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
};

export function WlHomeTab({ data, onChanged }: { data: WlDashboard; onChanged: () => void }) {
  const r = data.reseller;
  const days = r.active_until ? Math.max(0, Math.ceil((new Date(r.active_until).getTime() - Date.now()) / 864e5)) : null;

  const download = async () => {
    try { const { url } = await wlCall<{ url: string }>('download_url'); window.open(url, '_blank'); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Conta criada em</p><p className="text-lg font-bold">{fmtDate(r.created_at)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Ativo para revender</p><p className="text-lg font-bold">{days === null ? 'Sem prazo' : `${days} dias (até ${fmtDate(r.active_until)})`}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Clientes criados</p><p className="text-lg font-bold">{data.clients.length}</p></Card>
      </div>

      {(() => {
        // Faturamento: clientes manuais pelo preço oficial do plano + adicionais; vendas por link pelo valor pago.
        const manual = data.clients.filter((c) => c.origin === 'manual');
        const manualTotal = manual.reduce((a, c) => a + (c.plan === 'lifetime' ? 1200 + c.extras_added * 150 : 397 + c.extras_added * 100), 0);
        const linkTotal = data.sales.filter((s) => s.status === 'paid').reduce((a, s) => a + Number(s.amount), 0);
        const annual = data.clients.filter((c) => c.plan === 'annual').length;
        const lifetime = data.clients.length - annual;
        return (
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-xs text-muted-foreground">Faturamento total com vendas</p><p className="text-2xl font-bold text-primary">{brl(manualTotal + linkTotal)}</p></div>
              <p className="text-sm text-muted-foreground">Anual: {annual} · Vitalício: {lifetime} · Pelos links: {brl(linkTotal)}</p>
            </div>
            {data.clients.length > 0 && (
              <div className="max-h-64 overflow-auto text-sm divide-y divide-border">
                {data.clients.map((c) => (
                  <div key={c.id} className="flex flex-wrap justify-between gap-2 py-1">
                    <span>{fmtDate(c.created_at)} · {c.username}{c.email ? ` · ${c.email}` : ''}</span>
                    <span>{c.plan === 'lifetime' ? 'Vitalício' : 'Anual'}{c.extras_added ? ` +${c.extras_added} extras` : ''} · {c.origin === 'link' ? 'Link' : 'Manual'}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold">Sua ferramenta com sua marca</h2><p className="text-sm text-muted-foreground">{r.brand_file_name ?? 'O arquivo será disponibilizado pela MRO em breve.'}</p></div>
        <Button onClick={download} disabled={!r.brand_file_path}><Download className="w-4 h-4 mr-1" />Baixar</Button>
      </Card>

      <section className="space-y-3 py-3"><h2 className="font-bold">Logo da sua marca</h2><WlLogoUpload logoUrl={r.brand_logo_url} onChanged={onChanged} /></section>

      <Card className="p-4 space-y-2">
        <h2 className="font-bold">Como funcionam as comissões e vendas</h2>
        <p className="text-sm">O valor original do nosso site para vendas externas é o mínimo: <b>venda por esse valor ou mais, nunca menos</b>. Vale para todos os whitelabel.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-muted p-3"><b>Valores vendidos atualmente</b><br />Anual {brl(397)}<br />Vitalício {brl(1200)}<br />Adicional por conta anual {brl(100)}<br />Adicional por conta vitalício {brl(150)}</div>
          <div className="rounded-md bg-muted p-3"><b>Você paga à MRO</b><br />{brl(100)} por usuário anual criado<br />{brl(197)} por usuário vitalício (12 contas)<br />{brl(40)} por conta adicional</div>
        </div>
        <p className="text-xs text-muted-foreground">As taxas servem para manutenção e atualização das versões. Nas vendas pelos links MRO a taxa já é descontada do seu repasse.</p>
      </Card>

      {data.tutorials.map((t) => {
        const embed = t.video_url ? ytEmbed(t.video_url) : null;
        return (
          <Card key={t.id} className="p-4 space-y-2">
            <h3 className="font-bold">{t.title}</h3>
            {t.content && <p className="text-sm whitespace-pre-line">{t.content}</p>}
            {embed ? <iframe className="w-full aspect-video rounded-md" src={embed} title={t.title} allowFullScreen loading="lazy" />
              : t.video_url && <a className="text-primary underline text-sm" href={t.video_url} target="_blank" rel="noreferrer">Abrir vídeo</a>}
          </Card>
        );
      })}
    </div>
  );
}
