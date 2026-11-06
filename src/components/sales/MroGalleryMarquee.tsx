import { useEffect, useRef, useState } from 'react';
import { Images, Layers } from 'lucide-react';
import { fetchPublicGallery, IG_GALLERY_PUBLIC_PATH, type PublicGalleryImage } from '@/lib/igGallery';

interface Cover {
  key: string;
  url: string;
  count: number;
}

/** Uma capa por publicação (carrossel vira uma imagem só, com a 1ª posição). */
function toCovers(images: PublicGalleryImage[]): Cover[] {
  const map = new Map<string, PublicGalleryImage[]>();
  for (const img of images) {
    const key = img.publication_id || img.id;
    const list = map.get(key);
    if (list) list.push(img);
    else map.set(key, [img]);
  }
  return [...map.entries()].map(([key, list]) => {
    list.sort((a, b) => (a.image_index ?? 0) - (b.image_index ?? 0));
    return { key, url: list[0].url, count: list.length };
  });
}

/** Velocidade da rolagem automática, em pixels por segundo. */
const AUTO_SPEED = 45;
/** Abaixo disso o gesto conta como clique, não como arraste. */
const DRAG_THRESHOLD = 6;
/** Mínimo de itens por volta, para a faixa sempre cobrir a tela inteira. */
const MIN_ITEMS_PER_LOOP = 12;

/**
 * Faixa com as criações aprovadas da /galeria-ig.
 *
 * Roda sozinha e também pode ser arrastada com o mouse ou o dedo. A lista é
 * repetida duas vezes e a posição "dá a volta" exatamente no tamanho de uma
 * cópia, então o fim emenda no começo sem o visitante perceber.
 * Usa só a URL da imagem (a galeria pública não expõe dados de clientes).
 * Se a galeria estiver vazia ou fora do ar, a faixa simplesmente não aparece.
 */
export function MroGalleryMarquee({
  title,
  description,
  cta,
}: {
  title: string;
  description: string;
  cta: string;
}) {
  const [covers, setCovers] = useState<Cover[]>([]);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const hovering = useRef(false);
  const drag = useRef<{ startX: number; startOffset: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    let alive = true;
    fetchPublicGallery()
      .then((r) => {
        if (alive) setCovers(toCovers(r.images).slice(0, 24));
      })
      .catch(() => {
        if (alive) setCovers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Repete até ter itens suficientes por volta; depois duplica para emendar.
  const loop: Cover[] = [];
  if (covers.length > 0) {
    while (loop.length < MIN_ITEMS_PER_LOOP) loop.push(...covers);
  }
  const track = [...loop, ...loop];

  /** Largura exata de uma volta (início da 2ª cópia menos início da 1ª). */
  const period = () => {
    const el = trackRef.current;
    if (!el || loop.length === 0) return 0;
    const first = el.children[0] as HTMLElement | undefined;
    const second = el.children[loop.length] as HTMLElement | undefined;
    return first && second ? second.offsetLeft - first.offsetLeft : 0;
  };

  const apply = () => {
    const el = trackRef.current;
    if (!el) return;
    const p = period();
    if (p > 0) {
      // Mantém sempre entre -p e 0: é aqui que o fim emenda no começo.
      offset.current = ((offset.current % p) - p) % p;
    }
    el.style.transform = `translate3d(${offset.current}px,0,0)`;
  };

  useEffect(() => {
    if (loop.length === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduced && !drag.current && !hovering.current && document.visibilityState === 'visible') {
        offset.current -= AUTO_SPEED * dt;
        apply();
      }
      raf = requestAnimationFrame(tick);
    };
    apply();
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.length]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { startX: e.clientX, startOffset: offset.current, moved: false };

    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
        d.moved = true;
        setDragging(true);
      }
      if (d.moved) {
        offset.current = d.startOffset + dx;
        apply();
      }
    };
    const up = () => {
      suppressClick.current = !!drag.current?.moved;
      drag.current = null;
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // Trackpad / roda horizontal também movem a faixa.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    offset.current -= e.deltaX;
    apply();
  };

  const onLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (suppressClick.current) {
      e.preventDefault();
      suppressClick.current = false;
    }
  };

  if (covers.length === 0) return null;

  return (
    <div className="mb-10 md:mb-12">
      <div className="text-center mb-6">
        <h3 className="mro-sales-title text-2xl md:text-3xl uppercase leading-tight text-foreground">
          {title}
        </h3>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mt-3">{description}</p>
      </div>

      <div
        className={`mro-marquee relative -mx-4 overflow-hidden py-2 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={onPointerDown}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') hovering.current = true;
        }}
        onPointerLeave={() => {
          hovering.current = false;
        }}
        onWheel={onWheel}
      >
        <div ref={trackRef} className="mro-marquee-track flex w-max gap-3 md:gap-4 will-change-transform">
          {track.map((c, i) => {
            const duplicate = i >= covers.length;
            return (
              <a
                key={`${c.key}-${i}`}
                href={IG_GALLERY_PUBLIC_PATH}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                onClick={onLinkClick}
                aria-hidden={duplicate}
                tabIndex={duplicate ? -1 : 0}
                className={`relative block shrink-0 w-40 h-52 md:w-56 md:h-72 rounded-xl overflow-hidden border border-border bg-card ${dragging ? 'pointer-events-none' : ''}`}
              >
                <img
                  src={c.url}
                  alt={duplicate ? '' : 'Criativo produzido pela MRO'}
                  loading="lazy"
                  draggable={false}
                  className="w-full h-full object-cover"
                />
                {c.count > 1 && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-bold text-foreground">
                    <Layers className="h-3 w-3" />
                    {c.count}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      <div className="text-center mt-5">
        <a
          href={IG_GALLERY_PUBLIC_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-card font-bold text-xs transition-colors"
        >
          <Images className="h-4 w-4" />
          {cta}
        </a>
      </div>
    </div>
  );
}
