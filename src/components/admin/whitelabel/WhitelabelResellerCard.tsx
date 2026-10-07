import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, Pencil, Trash2, Upload } from 'lucide-react';
import { adminSupabase } from '@/lib/adminSupabase';
import { brl, fmtDate, planLabel, summarize, wlAdmin, type WlClient, type WlFee, type WlReseller, type WlSale, type WlUser } from '@/lib/whitelabel';
import { WlLogoUpload } from '@/components/whitelabel/WlLogoUpload';
import { WhitelabelClientRow } from './WhitelabelClientRow';

interface Props {
  reseller: WlReseller; clients: WlClient[]; users: WlUser[]; fees: WlFee[]; sales: WlSale[];
  onEdit: () => void; onChanged: () => void;
}

export function WhitelabelResellerCard({ reseller: r, clients, users, fees, sales, onEdit, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = summarize(fees, sales);
  const expired = r.active_until && new Date(r.active_until) < new Date();

  const run = async (action: string, body: Record<string, unknown>, ok: string) => {
    try { await wlAdmin(action, { id: r.id, ...body }); toast.success(ok); onChanged(); } catch (e) { toast.error((e as Error).message); }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const { path, token } = await wlAdmin<{ path: string; token: string }>('admin_upload_url', { id: r.id, file_name: file.name });
      const { error } = await adminSupabase.storage.from('whitelabel-files').uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await wlAdmin('admin_set_file', { id: r.id, path, file_name: file.name });
      toast.success('Arquivo enviado'); onChanged();
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  };

  const del = (withClients: boolean) => {
    const msg = withClients ? `Excluir ${r.name} E TODOS os ${clients.length} clientes criados por ele?` : `Excluir apenas ${r.name}? Os clientes continuam ativos.`;
    if (confirm(msg)) run('admin_delete_reseller', { with_clients: withClients }, 'Excluído');
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg">{r.name}</h3>
            <Badge variant={r.status === 'active' && !expired ? 'default' : 'destructive'}>{r.status === 'blocked' ? 'Bloqueado' : expired ? 'Vencido' : 'Ativo'}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Usuário: <b>{r.username}</b> · Senha: <b>{r.password_plain ?? '—'}</b> · {r.email ?? 'sem e-mail'}</p>
          <p className="text-xs text-muted-foreground">Criado {fmtDate(r.created_at)} · Revende até {fmtDate(r.active_until)} · PIX: {r.pix_key ? `${r.pix_type ?? ''} ${r.pix_key}` : 'não cadastrado'}</p>
          <p className="text-xs text-muted-foreground">Arquivo: {r.brand_file_name ?? 'nenhum'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" />{uploading ? 'Enviando...' : 'Arquivo'}</Button>
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="w-4 h-4 mr-1" />Editar</Button>
          <Button size="sm" variant="outline" onClick={() => run('admin_save_reseller', { ...r, status: r.status === 'active' ? 'blocked' : 'active', password: '' }, 'Status alterado')}>{r.status === 'active' ? 'Bloquear' : 'Desbloquear'}</Button>
          <Button size="sm" variant="destructive" onClick={() => del(false)}><Trash2 className="w-4 h-4 mr-1" />Só ele</Button>
          <Button size="sm" variant="destructive" onClick={() => del(true)}>Ele + clientes</Button>
        </div>
      </div>

      <WlLogoUpload resellerId={r.id} logoUrl={r.brand_logo_url} onChanged={onChanged} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
        {[
          ['Clientes', String(clients.length)], ['Vendido pelos links', brl(s.soldTotal)], ['Taxas totais', brl(s.feesTotal)],
          ['Taxas a pagar (manuais)', brl(s.manualPending)], ['Repasse pendente', brl(s.payoutPending)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md bg-muted p-2"><p className="text-xs text-muted-foreground">{k}</p><p className="font-bold">{v}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => confirm('Dar baixa nas taxas manuais pendentes?') && run('admin_mark_fees_paid', {}, 'Taxas quitadas')} disabled={s.manualPending <= 0}>Dar baixa nas taxas</Button>
        <Button size="sm" onClick={() => confirm(`Confirmar repasse de ${brl(s.payoutPending)} via PIX? As taxas descontadas também serão quitadas.`) && run('admin_payout', {}, 'Repasse baixado')} disabled={s.payoutPending <= 0}>Dar baixa no repasse</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Clientes e vendas</Button>
      </div>

      {open && (
        <div className="space-y-4">
          <div className="space-y-2">
            {clients.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente criado.</p>}
            {clients.map((c) => <WhitelabelClientRow key={c.id} client={c} user={users.find((u) => u.id === c.mro_user_id)} onChanged={onChanged} />)}
          </div>
          <div>
            <h4 className="font-semibold mb-2">Vendas pelos links</h4>
            <div className="space-y-1 text-xs">
              {sales.length === 0 && <p className="text-muted-foreground">Nenhuma venda.</p>}
              {sales.map((v) => (
                <div key={v.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1">
                  <span>{fmtDate(v.created_at)} · {v.buyer_email} · {planLabel(v.plan)} · {v.link_type === 'renda_extra' ? 'Renda Extra' : 'Cliente Final'}</span>
                  <span>{brl(v.amount)} · <b>{v.status === 'paid' ? 'Pago' : v.status === 'pending' ? 'Tentativa' : 'Expirado'}</b>{v.status === 'paid' && ` · repasse ${v.payout_status === 'paid' ? 'feito' : 'pendente'}`}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
