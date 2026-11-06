import { useEffect, useState } from 'react';
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

/**
 * Faixa com as criações aprovadas da /galeria-ig passando em loop.
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

  if (covers.length === 0) return null;

  // Duplicada para o loop ficar contínuo (a animação anda -50%).
  const track = [...covers, ...covers];
  const duration = Math.max(30, covers.length * 4);

  return (
    <div className="mb-10 md:mb-12">
      <div className="text-center mb-6">
        <h3 className="mro-sales-title text-2xl md:text-3xl uppercase leading-tight text-foreground">
          {title}
        </h3>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mt-3">{description}</p>
      </div>

      <div className="mro-marquee relative -mx-4 overflow-hidden py-2">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 md:w-24 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 md:w-24 z-10 bg-gradient-to-l from-background to-transparent" />
        <div
          className="mro-marquee-track flex w-max gap-3 md:gap-4"
          style={{ animationDuration: `${duration}s` }}
        >
          {track.map((c, i) => (
            <a
              key={`${c.key}-${i}`}
              href={IG_GALLERY_PUBLIC_PATH}
              target="_blank"
              rel="noopener noreferrer"
              aria-hidden={i >= covers.length}
              tabIndex={i >= covers.length ? -1 : 0}
              className="relative block shrink-0 w-40 h-52 md:w-56 md:h-72 rounded-xl overflow-hidden border border-border bg-card"
            >
              <img
                src={c.url}
                alt="Criativo produzido pela MRO"
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
          ))}
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
