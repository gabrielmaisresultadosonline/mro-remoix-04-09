import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { groupAccountImages, type AccountImage } from '@/lib/instagramAccountOverview';

export function InstagramAccountImages({ images }: { images: AccountImage[] }) {
  const [open, setOpen] = useState<AccountImage[] | null>(null);
  const [index, setIndex] = useState(0);
  const groups = groupAccountImages(images);
  const current = open?.[index];
  const step = (direction: number) => { if (open?.length) setIndex(i => (i + direction + open.length) % open.length); };
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'ArrowRight') step(1); if (event.key === 'ArrowLeft') step(-1); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);
  return <section className="space-y-4"><h2 className="text-lg font-semibold">Imagens geradas ({images.length})</h2>{images.length ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{groups.map(group => { const cover = group[0]; if (!cover) return null; return <Button key={`${cover.username}-${cover.id}`} variant="ghost" className="relative p-0 h-auto block overflow-hidden border border-border rounded-lg text-left" onClick={() => { setOpen(group); setIndex(0); }} aria-label={`Abrir imagem de @${cover.username}`}><img src={cover.imageUrl} alt={cover.headline || `Imagem gerada para @${cover.username}`} loading="lazy" className="w-full aspect-square object-contain bg-card" />{group.length > 1 && <span className="absolute top-2 right-2 flex gap-1 items-center bg-background/90 px-2 py-1 text-xs"><Layers className="h-3 w-3" />{group.length}</span>}<span className="block p-2 text-xs truncate">@{cover.username}</span></Button>; })}</div> : <p className="text-sm text-muted-foreground">Nenhuma imagem gerada salva nas contas selecionadas.</p>}
    <Dialog open={Boolean(open)} onOpenChange={value => { if (!value) setOpen(null); }}><DialogContent className="dash-member bg-background text-foreground border-border w-[calc(100%-2rem)] max-w-3xl max-h-[90dvh] overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>Imagem · @{current?.username}</DialogTitle><DialogDescription>{open && open.length > 1 ? `Carrossel · ${index + 1}/${open.length}` : 'Imagem gerada'}</DialogDescription></DialogHeader>{current && <><div className="relative"><img src={current.imageUrl} alt={`Imagem ${index + 1} de @${current.username}`} className="w-full max-h-[65dvh] object-contain" />{open && open.length > 1 && <><Button variant="secondary" size="icon" aria-label="Imagem anterior" className="absolute left-1 top-1/2 -translate-y-1/2" onClick={() => step(-1)}><ChevronLeft className="h-5 w-5" /></Button><Button variant="secondary" size="icon" aria-label="Próxima imagem" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => step(1)}><ChevronRight className="h-5 w-5" /></Button></>}</div>{current.headline && <p className="text-sm whitespace-pre-wrap break-words">{current.headline}</p>}</>}</DialogContent></Dialog>
  </section>;
}