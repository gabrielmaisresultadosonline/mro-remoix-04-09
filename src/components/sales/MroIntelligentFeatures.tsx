import { Bot, Brain, CheckCircle2, Heart, Kanban, MessageCircle, ScanSearch, UserPlus, Video } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { featuresCopy, type SalesLang } from '@/lib/salesCopy';

const icons = [ScanSearch, MessageCircle, Bot, Kanban, Video, UserPlus, Heart, Brain];

export function MroIntelligentFeatures({ lang = 'pt' }: { lang?: SalesLang } = {}) {
  const t = featuresCopy[lang];
  const reducedMotion = useReducedMotion();
  return <>
    <section className="py-16 md:py-24 px-4 border-t border-border bg-background">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <p className="text-primary text-xs font-bold uppercase mb-5">{t.eyebrow}</p>
          <h2 className="mro-sales-title text-3xl md:text-5xl uppercase leading-tight">{t.title1}<br /><span className="text-primary">{t.title2}</span></h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-5">{t.sub}</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {t.items.map(({ title, description, detail }, i) => {
            const Icon = icons[i];
            const id = String(i + 1).padStart(2, '0');
            return <motion.article key={id} initial={reducedMotion ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} className="mro-feature border border-border bg-card rounded-lg p-6 md:p-8">
              <div className="flex items-center justify-between mb-6"><span className="bg-primary text-primary-foreground rounded-lg p-3"><Icon size={26} /></span><span className="text-muted-foreground font-mono text-sm">{id} / 08</span></div>
              <h3 className="text-xl md:text-2xl font-bold mb-4 text-foreground">{title}</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">{description}</p>
              <p className="text-primary text-sm font-semibold flex items-start gap-2"><CheckCircle2 size={17} className="shrink-0 mt-0.5" />{detail}</p>
            </motion.article>;
          })}
        </div>
        <p className="text-muted-foreground text-sm text-center max-w-3xl mx-auto mt-8">{t.note}</p>
      </div>
    </section>
    <section className="bg-secondary/20 border-y border-border px-4 py-16">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10">
        <div><p className="text-primary font-bold mb-3">{t.col1Title}</p><h2 className="text-2xl font-bold mb-4">{t.col1Heading}</h2><p className="text-muted-foreground">{t.col1Text}</p></div>
        <div><h3 className="text-xl font-bold mb-4">{t.col2Heading}</h3><p className="text-muted-foreground">{t.col2Text}</p></div>
        <div><h3 className="text-xl font-bold mb-4">{t.col3Heading}</h3><p className="text-muted-foreground">{t.col3Text}</p></div>
      </div>
    </section>
  </>;
}
