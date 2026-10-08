import { useEffect, type ReactNode } from 'react';
import { Monitor, Sparkles } from 'lucide-react';
import logoMro from '@/assets/logo-mro.png';

export interface MroIntelligentIntroProps {
  branding?: ReactNode;
}

export function MroIntelligentIntro({ branding }: MroIntelligentIntroProps) {
  useEffect(() => {
    if (document.getElementById('mro-sales-fonts')) return;
    const link = document.createElement('link');
    link.id = 'mro-sales-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
  return <>
    {branding || <img src={logoMro} alt="MRO — Mais Resultados Online" width={180} height={90} className="h-16 md:h-20 w-auto object-contain mx-auto mb-10" />}
    <p className="text-primary text-sm font-bold uppercase mb-4">Prospecção · Atendimento · Estratégia</p>
    <h1 className="mro-sales-title text-4xl md:text-7xl text-foreground uppercase leading-tight mb-5">NÃO GASTE MAIS COM ANÚNCIOS<br /><span className="text-primary">UTILIZE A MRO INTELIGENTE!</span></h1>
    <p className="text-xl md:text-3xl font-bold text-primary max-w-3xl mx-auto mb-5">Transforme seu Instagram em uma oportunidade de vender mais.</p>
    <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">Encontre o público do seu negócio, inicie conversas e acompanhe cada oportunidade. Automação, CRM e inteligência artificial juntos para aumentar sua presença, seu engajamento e suas oportunidades de venda.</p>
    <p className="flex flex-wrap justify-center items-center gap-2 mt-5 text-sm text-muted-foreground"><Monitor size={16} /> Instale em seu notebook, MacBook ou computador de mesa!</p>
    <div className="inline-flex items-center gap-2 border border-border bg-secondary/30 rounded-full px-5 py-2 mt-6 text-xs font-bold text-foreground uppercase"><Sparkles size={15} className="text-primary" /> Nova MRO Inteligente · Conheça todas as funções</div>
  </>;
}