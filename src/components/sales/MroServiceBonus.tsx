import { motion, useReducedMotion } from 'framer-motion';
import { Briefcase, CheckCircle2, FileSignature, Gift, GraduationCap, Instagram, Sparkles, Target, Zap } from 'lucide-react';

type ServiceBlock = {
  icon: typeof Sparkles;
  title: string;
  items: string[];
  footer: string;
};

const services: ServiceBlock[] = [
  {
    icon: Sparkles,
    title: 'Criação de conteúdo com IA',
    items: ['Estratégias de conteúdo', 'Posts únicos', 'Carrosséis automáticos', 'Imagens para Instagram', 'Planejamento do mês', 'Programação de publicações'],
    footer: 'Atenda empresas que não têm tempo nem equipe para produzir conteúdo.',
  },
  {
    icon: Instagram,
    title: 'Gerenciamento de Instagram',
    items: ['Planejamento de publicações', 'Organização de contas', 'Estratégia de presença digital', 'Acompanhamento de atividades', 'Programação de Stories'],
    footer: 'Ajude empresas a manter uma presença profissional e constante.',
  },
  {
    icon: Target,
    title: 'Prospecção ativa',
    items: ['Identificação de públicos', 'Prospecção de interessados', 'Estratégias de interação', 'Ações comerciais'],
    footer: 'Gere novas oportunidades de relacionamento e negócios.',
  },
  {
    icon: Zap,
    title: 'Automação e engajamento',
    items: ['Curtidas automatizadas', 'Seguir e deixar de seguir', 'Reagir a Stories', 'Remover seguidores falsos'],
    footer: 'Otimize tarefas repetitivas, respeitando os limites do Instagram.',
  },
  {
    icon: FileSignature,
    title: 'Contratos mensais',
    items: ['Conteúdo + gerenciamento', 'Planejamento mensal', 'Engajamento e prospecção', 'Acompanhamento de resultados'],
    footer: 'Monte pacotes recorrentes e construa sua carteira.',
  },
];

/**
 * Bônus exibido logo abaixo dos valores: mostra que dá para faturar
 * prestando serviço com a MRO e que existe um módulo tutorial incluso.
 * Apenas apresentação — não mexe em preço, checkout nem provisionamento.
 */
export function MroServiceBonus({ onCta }: { onCta?: () => void }) {
  const reducedMotion = useReducedMotion();

  return (
    <section className="py-16 md:py-24 px-4 border-t border-border bg-secondary/20">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-10 md:mb-14">
          <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black uppercase text-xs sm:text-sm px-4 py-2 rounded-full mb-6">
            <Gift className="w-4 h-4" /> Bônus incluso
          </span>
          <h2 className="mro-sales-title text-3xl md:text-5xl uppercase leading-tight">
            Como faturar mais de <span className="text-primary">R$ 5 mil</span>
            <br />
            prestando serviço com a MRO
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-5">
            Além de usar a MRO no seu negócio, você também pode oferecer serviços para outras empresas.
          </p>

          <div className="mt-6 inline-flex items-center gap-3 border border-primary/50 bg-card rounded-xl px-5 py-3 text-left">
            <GraduationCap className="w-7 h-7 text-primary shrink-0" />
            <p className="text-sm sm:text-base text-foreground">
              Existe um <strong className="text-primary">módulo tutorial bônus</strong> incluso em que você aprende a fazer isso passo a passo!
            </p>
          </div>
        </header>

        <div className="text-center mb-10 md:mb-12">
          <h3 className="text-2xl md:text-4xl font-black uppercase leading-tight text-foreground">
            Você não precisa vender uma ferramenta.
            <br />
            <span className="text-primary">Você pode vender soluções!</span>
          </h3>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mt-4">
            A MRO é a sua estrutura tecnológica para executar diferentes serviços de marketing digital.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((service, i) => {
            const Icon = service.icon;
            return (
              <motion.article
                key={service.title}
                initial={reducedMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: reducedMotion ? 0 : i * 0.05 }}
                className="mro-feature border border-border bg-card rounded-lg p-6 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-primary text-primary-foreground rounded-lg p-2.5 inline-flex">
                    <Icon size={20} />
                  </span>
                  <h4 className="text-lg md:text-xl font-bold text-foreground">{service.title}</h4>
                </div>
                <ul className="space-y-2 mb-5 flex-1">
                  {service.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-sm font-semibold text-foreground border-t border-border pt-4">{service.footer}</p>
              </motion.article>
            );
          })}

          <article className="border-2 border-primary bg-card rounded-lg p-6 flex flex-col items-center justify-center text-center">
            <Briefcase className="w-10 h-10 text-primary mb-3" />
            <p className="text-lg font-black uppercase text-foreground mb-2">Tudo isso com uma só estrutura</p>
            <p className="text-sm text-muted-foreground mb-5">Aprenda no módulo bônus a montar seus pacotes e conquistar clientes.</p>
            {onCta && (
              <button
                type="button"
                onClick={onCta}
                className="bg-primary text-primary-foreground font-black uppercase text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity"
              >
                Quero a MRO + bônus
              </button>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
