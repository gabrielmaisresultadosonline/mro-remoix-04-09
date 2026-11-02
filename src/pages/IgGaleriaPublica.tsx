import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, X } from 'lucide-react';
import { fetchPublicGallery, type PublicGalleryImage } from '@/lib/igGallery';

interface GalleryGroup {
  key: string;
  images: PublicGalleryImage[]; // ordenadas por image_index
  caption: string | null;
}

/** Galeria pública: só imagens (legenda ao abrir). Nenhum dado de cliente. */
export default function IgGaleriaPublica() {
  const [images, setImages] = useState<PublicGalleryImage[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<GalleryGroup | null>(null);
  const [slide, setSlide] = useState(0);
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

  /** Agrupa carrosséis (mesmo publication_id) mantendo a ordem de chegada. */
  const groups = useMemo<GalleryGroup[]>(() => {
    const map = new Map<string, GalleryGroup>();
    for (const img of images) {
      const key = img.publication_id || img.id;
      const g = map.get(key);
      if (g) g.images.push(img);
      else map.set(key, { key, images: [img], caption: img.caption });
    }
    for (const g of map.values()) {
      g.images.sort((a, b) => (a.image_index ?? 0) - (b.image_index ?? 0));
      g.caption = g.images.find((i) => i.caption)?.caption ?? null;
    }
    return [...map.values()];
  }, [images]);

  const openGroup = useCallback((g: GalleryGroup) => {
    setOpen(g);
    setSlide(0);
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (!open || open.images.length < 2) return;
      setSlide((s) => (s + dir + open.images.length) % open.images.length);
    },
    [open],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const current = open?.images[Math.min(slide, open.images.length - 1)] ?? null;

  return (
    <main className="min-h-screen bg-background">
      <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-1 p-1">
        {groups.map((g) => (
          <button key={g.key} onClick={() => openGroup(g)} className="relative block w-full mb-1 break-inside-avoid overflow-hidden focus:outline-none">
            <img src={g.images[0].url} alt="" loading="lazy" className="w-full h-auto block hover:opacity-90 transition-opacity" />
            {g.images.length > 1 && (
              <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                <Layers className="w-3 h-3" />
                {g.images.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div ref={sentinel} className="py-8 text-center text-sm text-muted-foreground">
        {loading ? 'Carregando…' : error ? error : done && groups.length === 0 ? 'Nenhuma imagem ainda.' : ''}
      </div>

      {open && current && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-3 overflow-y-auto" onClick={() => setOpen(null)}>
          <button aria-label="Fechar" className="absolute top-3 right-3 p-2 rounded-full bg-muted text-foreground" onClick={() => setOpen(null)}>
            <X className="w-5 h-5" />
          </button>

          {open.images.length > 1 && (
            <button
              aria-label="Imagem anterior"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-muted text-foreground"
              onClick={(e) => { e.stopPropagation(); go(-1); }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {open.images.length > 1 && (
            <button
              aria-label="Próxima imagem"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-muted text-foreground"
              onClick={(e) => { e.stopPropagation(); go(1); }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <img src={current.url} alt="" className="max-h-[80vh] max-w-full object-contain" onClick={(e) => e.stopPropagation()} />

          {open.images.length > 1 && (
            <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {open.images.map((img, i) => (
                <button
                  key={img.id}
                  aria-label={`Imagem ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/40'}`}
                />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{slide + 1}/{open.images.length}</span>
            </div>
          )}

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
