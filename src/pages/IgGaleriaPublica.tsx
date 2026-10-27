import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { fetchPublicGallery, type PublicGalleryImage } from '@/lib/igGallery';

/** Galeria pública: só imagens (legenda ao abrir). Nenhum dado de cliente. */
export default function IgGaleriaPublica() {
  const [images, setImages] = useState<PublicGalleryImage[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<PublicGalleryImage | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Galeria de criações';
  }, []);

  const load = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const r = await fetchPublicGallery(next);
      setImages((prev) => [...prev, ...r.images.filter((i) => !prev.some((p) => p.id === i.id))]);
      setNext(r.next_before);
      if (!r.next_before) setDone(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar');
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, next]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) void load(); }, { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-1 p-1">
        {images.map((img) => (
          <button key={img.id} onClick={() => setOpen(img)} className="block w-full mb-1 break-inside-avoid overflow-hidden focus:outline-none">
            <img src={img.url} alt="" loading="lazy" className="w-full h-auto block hover:opacity-90 transition-opacity" />
          </button>
        ))}
      </div>
      <div ref={sentinel} className="py-8 text-center text-sm text-muted-foreground">
        {loading ? 'Carregando…' : error ? error : done && images.length === 0 ? 'Nenhuma imagem ainda.' : ''}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-3 overflow-y-auto" onClick={() => setOpen(null)}>
          <button aria-label="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-muted text-foreground" onClick={() => setOpen(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={open.url} alt="" className="max-h-[80vh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          {open.caption && (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm text-foreground text-center" onClick={(e) => e.stopPropagation()}>
              {open.caption}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
