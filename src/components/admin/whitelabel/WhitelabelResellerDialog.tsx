import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { wlAdmin, type WlReseller } from '@/lib/whitelabel';

interface Props { reseller: WlReseller | null; open: boolean; onClose: () => void; onSaved: () => void }

/** Criação/edição de revendedor whitelabel no /admin. */
export function WhitelabelResellerDialog({ reseller, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    name: reseller?.name ?? '', username: reseller?.username ?? '', email: reseller?.email ?? '', password: '',
    active_until: reseller?.active_until?.slice(0, 10) ?? '', status: reseller?.status ?? 'active', notes: reseller?.notes ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await wlAdmin('admin_save_reseller', { id: reseller?.id, ...form });
      toast.success('Revendedor salvo');
      onSaved(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{reseller ? 'Editar revendedor' : 'Novo revendedor whitelabel'}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Nome / marca</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Usuário</Label><Input value={form.username} onChange={(e) => set('username', e.target.value)} /></div>
            <div><Label>{reseller ? 'Nova senha (opcional)' : 'Senha'}</Label><Input value={form.password} onChange={(e) => set('password', e.target.value)} placeholder={reseller?.password_plain ?? ''} /></div>
          </div>
          <div><Label>E-mail (recebe avisos de venda)</Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Ativo para revender até</Label><Input type="date" value={form.active_until} onChange={(e) => set('active_until', e.target.value)} /></div>
            <div><Label>Status</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">Ativo</option><option value="blocked">Bloqueado</option>
              </select>
            </div>
          </div>
          <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></div>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
