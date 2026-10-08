import { useEffect, type ReactNode } from 'react';
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
    <h1 className="mro-sales-title text-4xl md:text-7xl text-foreground uppercase leading-tight mb-4">
      NÃO GASTE MAIS COM ANÚNCIOS
      <span className="block text-primary text-2xl md:text-5xl mt-3">UTILIZE A MRO INTELIGENTE!</span>
    </h1>
    <p className="text-base md:text-xl font-semibold text-primary max-w-3xl mx-auto">Transforme seu Instagram em uma oportunidade de vender mais.</p>
  </>;
}
