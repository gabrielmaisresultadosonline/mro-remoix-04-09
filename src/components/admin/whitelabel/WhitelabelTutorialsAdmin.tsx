import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { wlAdmin, type WlTutorial } from '@/lib/whitelabel';

const empty = { id: '', title: '', content: '', video_url: '', order_index: 0 };

/** Tutoriais e avisos exibidos no painel de todos os revendedores. */
export function WhitelabelTutorialsAdmin({ tutorials, onChanged }: { tutorials: WlTutorial[]; onChanged: () => void }) {
  const [form, setForm] = useState(empty);
  const save = async () => {
    try { await wlAdmin('admin_save_tutorial', { ...form, id: form.id || undefined }); toast.success('Salvo'); setForm(empty); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
  };
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">{form.id ? 'Editar' : 'Novo'} tutorial / aviso</h3>
        <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input placeholder="Link de vídeo (YouTube, opcional)" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
        <Textarea placeholder="Texto / informações" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <Input type="number" placeholder="Ordem" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })} className="w-32" />
        <div className="flex gap-2"><Button onClick={save}>Salvar</Button>{form.id && <Button variant="ghost" onClick={() => setForm(empty)}>Cancelar</Button>}</div>
      </Card>
      {tutorials.map((t) => (
        <Card key={t.id} className="p-3 flex justify-between gap-2 items-start">
          <div><b>{t.title}</b><p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-3">{t.content}</p></div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setForm({ id: t.id, title: t.title, content: t.content ?? '', video_url: t.video_url ?? '', order_index: t.order_index })}>Editar</Button>
            <Button size="sm" variant="destructive" onClick={() => confirm('Excluir?') && wlAdmin('admin_delete_tutorial', { id: t.id }).then(onChanged)}>Excluir</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
