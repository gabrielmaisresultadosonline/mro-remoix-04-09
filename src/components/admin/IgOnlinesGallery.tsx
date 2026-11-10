import React, { useCallback, useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { adminSupabase } from '@/lib/adminSupabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Layers, RefreshCw, Trash2, X } from 'lucide-react';
import { IG_GALLERY_PUBLIC_PATH } from '@/lib/igGallery';

interface GalleryImage {
  id: string; instagram_username: string; publication_id: string | null; image_index?: number | null; caption: string | null;
  size_bytes: number; created_at: string; expires_at: string | null; url: string;
}
interface Summary { profiles: number; online: number; followers_total: number | null; growth_period: number | null; welcome_period: number; welcome_total: number }

/** Dashboard único: resumo das métricas + todas as imagens aprovadas enviadas pela extensão. */
const IgOnlinesGallery: React.FC = () => {
  const { toast } = useToast();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [clients, setClients] = useState<{ instagram: string; total: number }[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [openGroup, setOpenGroup] = useState<GalleryImage[] | null>(null);
  const [idx, setIdx] = useState(0);
  const open = openGroup ? openGroup[Math.min(idx, openGroup.length - 1)] : null;
  const setOpen = (v: null) => { setOpenGroup(v); setIdx(0); };

  const call = async <T,>(action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await adminSupabase.functions.invoke('ig-online-api', { body: { action, ...extra } });
    const r = data as (T & { success?: boolean; error?: string }) | null;
    if (error || !r?.success) throw new Error(r?.error || error?.message || 'Falha');
    return r;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, m] = await Promise.all([
        call<{ images: GalleryImage[]; clients: { instagram: string; total: number }[] }>('admin_gallery'),
        call<{ summary: Summary }>('admin_metrics', { days: 30 }),
      ]);
      setImages(g.images ?? []); setClients(g.clients ?? []); setSummary(m.summary ?? null);
    } catch (e) {
      toast({ title: 'Erro ao carregar', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (filter ? images.filter((i) => i.instagram_username === filter) : images), [images, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, GalleryImage[]>();
    const order: string[] = [];
    for (const img of shown) {
      const key = img.publication_id ? `${img.instagram_username.toLowerCase()}::${img.publication_id}` : `single::${img.id}`;
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(img);
    }
    return order.map((k) => map.get(k)!.slice().sort((a, b) => (a.image_index ?? 0) - (b.image_index ?? 0) || a.created_at.localeCompare(b.created_at)));
  }, [shown]);

  const step = (d: number) => { if (openGroup && openGroup.length > 1) setIdx((i) => (i + d + openGroup.length) % openGroup.length); };
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openGroup]);
  const [touchX, setTouchX] = useState<number | null>(null);

  const downloadAll = async () => {
    if (!shown.length) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      let n = 0;
      for (const img of shown) {
        const blob = await fetch(img.url).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
        if (!blob) continue;
        const ext = blob.type.split('/')[1] || 'jpg';
        const base = `${img.instagram_username}/${img.created_at.slice(0, 10)}_${img.id.slice(0, 8)}`;
        zip.file(`${base}.${ext}`, blob);
        if (img.caption) zip.file(`${base}.txt`, img.caption);
        n++;
      }
      const out = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = `imagens-${filter || 'todas'}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: `${n} imagem(ns) baixada(s)` });
    } finally { setZipping(false); }
  };

  const remove = async (img: GalleryImage) => {
    if (!confirm('Excluir esta imagem?')) return;
    try { await call('admin_gallery_delete', { id: img.id }); setImages((p) => p.filter((i) => i.id !== img.id));
      const rest = (openGroup ?? []).filter((i) => i.id !== img.id);
      if (rest.length) { setOpenGroup(rest); setIdx((i) => Math.min(i, rest.length - 1)); } else setOpen(null); }
    catch (e) { toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  const stat = (label: string, value: React.ReactNode) => (
    <Card className="p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div></Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {stat('Perfis', summary?.profiles ?? '—')}
        {stat('Online agora', summary?.online ?? '—')}
        {stat('Seguidores ganhos (30d)', summary?.growth_period ?? 'Aguardando dados')}
        {stat('Boas-vindas (30d)', summary?.welcome_period ?? '—')}
        {stat('Imagens ativas', images.length)}
        {stat('Clientes com imagens', clients.length)}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos os clientes</option>
          {clients.map((c) => <option key={c.instagram} value={c.instagram}>@{c.instagram} ({c.total})</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
        </Button>
        <Button size="sm" onClick={() => void downloadAll()} disabled={zipping || !shown.length} className="gap-2">
          <Download className="w-4 h-4" />{zipping ? 'Compactando…' : `Baixar ${shown.length}`}
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => window.open(IG_GALLERY_PUBLIC_PATH, '_blank')}>
          <ExternalLink className="w-4 h-4" />Ver galeria pública
        </Button>
        <Input readOnly className="h-9 max-w-xs text-xs" value={`${window.location.origin}${IG_GALLERY_PUBLIC_PATH}`} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <p className="text-xs text-muted-foreground">As imagens e carrosséis permanecem no servidor até você excluí-los manualmente.</p>

      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{loading ? 'Carregando…' : 'Nenhuma imagem recebida ainda. Veja a Documentação para conectar a extensão.'}</Card>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-5 gap-2">
          {groups.map((g) => { const img = g[0]; return (
            <button key={img.id} onClick={() => { setOpenGroup(g); setIdx(0); }} className="relative block w-full mb-2 break-inside-avoid rounded-md overflow-hidden border">
              <img src={img.url} alt="" loading="lazy" className="w-full h-auto block" />
              {g.length > 1 && <span className="absolute top-1 right-1 flex items-center gap-1 rounded bg-background/85 px-1.5 py-0.5 text-[11px] font-semibold"><Layers className="w-3 h-3" />{g.length}</span>}
              <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[11px] px-2 py-1 text-left truncate">@{img.instagram_username}</span>
            </button>
          ); })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-3 overflow-y-auto" onClick={() => setOpen(null)}>
          <div className="absolute top-3 right-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <a href={open.url} download target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><Download className="w-4 h-4" /></Button></a>
            <Button size="sm" variant="destructive" onClick={() => void remove(open)}><Trash2 className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setOpen(null)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="relative flex items-center justify-center w-full" onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
            onTouchEnd={(e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); setTouchX(null); }}>
            {openGroup && openGroup.length > 1 && (
              <Button size="icon" variant="secondary" aria-label="Imagem anterior" className="absolute left-1 sm:left-4 z-10 h-11 w-11 rounded-full shadow-lg" onClick={() => step(-1)}><ChevronLeft className="w-6 h-6" /></Button>
            )}
            <img src={open.url} alt="" className="max-h-[75vh] max-w-full object-contain select-none" draggable={false} />
            {openGroup && openGroup.length > 1 && (
              <Button size="icon" variant="secondary" aria-label="Próxima imagem" className="absolute right-1 sm:right-4 z-10 h-11 w-11 rounded-full shadow-lg" onClick={() => step(1)}><ChevronRight className="w-6 h-6" /></Button>
            )}
          </div>
          {openGroup && openGroup.length > 1 && (
            <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-muted-foreground">{idx + 1}/{openGroup.length}</span>
              {openGroup.map((g, i) => (
                <button key={g.id} aria-label={`Imagem ${i + 1}`} onClick={() => setIdx(i)} className={`h-2 rounded-full transition-all ${i === idx ? 'w-5 bg-primary' : 'w-2 bg-muted-foreground/40'}`} />
              ))}
            </div>
          )}
          <div className="mt-3 max-w-2xl text-center space-y-1" onClick={(e) => e.stopPropagation()}>
            <div className="text-xs text-muted-foreground">@{open.instagram_username} · {new Date(open.created_at).toLocaleString('pt-BR')} · Sem expiração</div>
            {open.caption && <p className="whitespace-pre-wrap text-sm">{open.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default IgOnlinesGallery;
