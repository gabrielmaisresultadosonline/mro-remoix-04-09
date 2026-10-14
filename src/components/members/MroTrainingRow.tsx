import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Gift, Play, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getYoutubeThumbnail, type ModuleContent } from '@/lib/adminConfig';

export interface MroTrainingRowProps {
  title: string;
  description?: string;
  bonus?: boolean;
  showTitle?: boolean;
  contents: ModuleContent[];
  onOpen: (content: ModuleContent) => void;
}
export default function MroTrainingRow({ title, description, bonus, showTitle = true, contents, onOpen }: MroTrainingRowProps) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const sorted = [...contents].sort((a, b) => a.order - b.order);
  const items = sorted.filter((c) => c.type !== 'section' && c.type !== 'button');
  const links = sorted.filter((c) => c.type === 'button');
  function measure() {
    const el = track.current;
    if (el) setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [contents]);
  if (!sorted.length) return null;
  return (
    <section className="py-5 md:py-7 min-w-0">
      {showTitle && <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl md:text-2xl font-display font-bold flex flex-wrap items-center gap-3">{title}{bonus && <span className="inline-flex items-center gap-1 text-xs rounded px-2 py-1 bg-primary/15 text-primary"><Gift className="h-3 w-3" />BÔNUS</span>}</h2>{description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{description}</p>}</div>
        <div className="flex gap-2">
          {edges.left && <Button variant="outline" size="icon" aria-label={`Voltar em ${title}`} onClick={() => track.current?.scrollBy({ left: -440, behavior: 'smooth' })}><ChevronLeft className="h-4 w-4" /></Button>}
          {edges.right && <Button variant="outline" size="icon" aria-label={`Avançar em ${title}`} onClick={() => track.current?.scrollBy({ left: 440, behavior: 'smooth' })}><ChevronRight className="h-4 w-4" /></Button>}
        </div>
      </div>}
      <div ref={track} onScroll={measure} className="mro-training-track flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory pb-4 pt-2">
        {items.map((content, index) => {
          const image = content.type === 'video' ? content.thumbnailUrl || getYoutubeThumbnail(content.youtubeUrl) : content.type === 'product_ad' ? content.productThumb : undefined;
          return <Button key={content.id} variant="ghost" onClick={() => onOpen(content)} className="group p-0 h-auto block text-left whitespace-normal shrink-0 snap-start w-[160px] sm:w-[190px] lg:w-[220px] hover:bg-transparent">
            <div className="aspect-[9/16] relative bg-card border border-border rounded-lg overflow-hidden transition-transform motion-safe:group-hover:-translate-y-1 group-hover:border-primary">
              {image ? <img src={image} alt={content.title} loading="lazy" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.src = '/placeholder.svg'; e.currentTarget.onerror = null; }} /> : <div className="h-full flex items-center justify-center text-muted-foreground"><Type className="w-8 h-8" /></div>}
              {content.type === 'video' && content.showNumber && <span className="absolute top-3 left-3 bg-background/90 border border-primary/40 text-primary px-2 py-1 rounded text-xs font-bold">{String(index + 1).padStart(2, '0')}</span>}
              <span className={cn('absolute bottom-3 right-3 rounded-full p-2 bg-primary text-primary-foreground', 'md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100 transition-opacity')}><Play className="h-4 w-4" /></span>
            </div>
            {content.showTitle !== false && <p className="text-sm mt-3 font-medium text-foreground line-clamp-2">{content.title}</p>}
          </Button>;
        })}
      </div>
      {links.length > 0 && <div className="flex flex-wrap gap-3 mt-3">{links.map((link) => <Button key={link.id} variant="outline" onClick={() => onOpen(link)} className="gap-2 whitespace-normal h-auto min-h-10 py-2"><ExternalLink className="h-4 w-4 shrink-0" />{link.title}</Button>)}</div>}
    </section>
  );
}