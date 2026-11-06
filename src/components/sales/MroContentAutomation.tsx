import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Brain, CalendarClock, ExternalLink, Image as ImageIcon, Play, Send } from 'lucide-react';
import { contentAutomationCopy, type SalesLang } from '@/lib/salesCopy';
import { MroGalleryMarquee } from './MroGalleryMarquee';

const VIDEO_ID = 'T0uaH1Pe55Y';
const stepIcons = [Brain, ImageIcon, CalendarClock, Send];

/**
 * Seção "Criação de conteúdo automática com I.A".
 *
 * O pôster aparece primeiro e o YouTube só é carregado depois do clique:
 * celular bloqueia reprodução automática sem um gesto do usuário, e extensões
 * que bloqueiam rastreadores costumam derrubar o iframe assim que ele é
 * montado. O link direto garante que o vídeo sempre possa ser assistido.
 */
export function MroContentAutomation({ lang = 'pt' }: { lang?: SalesLang } = {}) {
  const t = contentAutomationCopy[lang];
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  if (!t) return null;

  const watchUrl = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`;

  return (
    <section className="py-16 md:py-24 px-4 border-t border-border bg-secondary/20">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-10 md:mb-12">
          <p className="text-primary text-xs font-bold uppercase mb-5">{t.eyebrow}</p>
          <h2 className="mro-sales-title text-3xl md:text-5xl uppercase leading-tight">
            {t.title1}
            <br />
            <span className="text-primary">{t.title2}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-5">{t.description}</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10 md:mb-12">
          {t.steps.map((step, i) => {
            const Icon = stepIcons[i] ?? Brain;
            return (
              <motion.article
                key={step.title}
                initial={reducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                className="mro-feature border border-border bg-card rounded-lg p-6 text-center"
              >
                <span className="bg-primary text-primary-foreground rounded-lg p-3 inline-flex mb-4">
                  <Icon size={22} />
                </span>
                <h3 className="text-lg md:text-xl font-bold mb-2 text-foreground">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </motion.article>
            );
          })}
        </div>

        <MroGalleryMarquee title={t.galleryTitle} description={t.galleryDescription} cta={t.galleryCta} />

        <div className="max-w-3xl mx-auto space-y-3">
          {playing ? (
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-border">
              <iframe
                src={embedUrl}
                title={t.videoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={t.videoTitle}
              className="relative block w-full aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-card to-background border border-border group"
            >
              {!posterFailed && (
                <img
                  src={`https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`}
                  alt={t.videoTitle}
                  onError={() => setPosterFailed(true)}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <span className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8 sm:h-9 sm:w-9 text-primary-foreground ml-1" fill="currentColor" />
                </span>
                <span className="text-primary-foreground font-bold text-sm tracking-wide">{t.videoCta}</span>
              </span>
            </button>
          )}

          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 mx-auto px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-card font-bold text-xs transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            {playing ? t.videoFallbackPlaying : t.videoFallback}
          </a>
        </div>
      </div>
    </section>
  );
}
