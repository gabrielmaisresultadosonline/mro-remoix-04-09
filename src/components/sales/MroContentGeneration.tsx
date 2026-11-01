import { CalendarClock, CheckCircle2, Image as ImageIcon, LayoutGrid, Sparkles, Target, UserRound } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const items = [
  { icon: Target, text: 'Criar estratégias de conteúdo para o mês inteiro.' },
  { icon: LayoutGrid, text: 'Gerar carrosséis profissionais.' },
  { icon: ImageIcon, text: 'Criar posts individuais e criativos para suas redes sociais.' },
  { icon: UserRound, text: 'Utilizar sua própria foto nas artes ou gerar conteúdos sem utilizar sua imagem.' },
  { icon: Sparkles, text: 'Criar conteúdos estratégicos e personalizados para o seu perfil.' },
  { icon: CalendarClock, text: 'Agendar e programar suas publicações automaticamente.' },
];

/** Nova funcionalidade: geração de conteúdos do mês (apenas texto de apresentação). */
export function MroContentGeneration() {
  const reducedMotion = useReducedMotion();
  return (
    <section className="py-16 md:py-24 px-4 border-t border-border bg-background">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-10">
          <span className="inline-block bg-primary text-primary-foreground text-xs font-bold uppercase rounded-full px-4 py-1.5 mb-5">
            Nova funcionalidade
          </span>
          <h2 className="mro-sales-title text-3xl md:text-5xl uppercase leading-tight">
            🔥 Agora você pode gerar <span className="text-primary">todo o conteúdo do seu mês</span> automaticamente!
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-5">
            Com a nova funcionalidade de <strong className="text-foreground">GERAÇÃO DE CONTEÚDOS</strong>, você poderá:
          </p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={text}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: reducedMotion ? 0 : i * 0.05 }}
              className="mro-feature flex items-start gap-4 border border-border bg-card rounded-lg p-5 md:p-6"
            >
              <span className="bg-primary text-primary-foreground rounded-lg p-2.5 shrink-0"><Icon size={22} /></span>
              <p className="text-foreground font-semibold leading-relaxed flex items-start gap-2">
                <CheckCircle2 size={18} className="text-primary shrink-0 mt-1" />
                {text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
