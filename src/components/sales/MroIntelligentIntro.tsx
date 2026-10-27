import { useEffect, type ReactNode } from 'react';
import logoMro from '@/assets/logo-mro.png';
import { introCopy, type SalesLang } from '@/lib/salesCopy';

export interface MroIntelligentIntroProps {
  branding?: ReactNode;
  /** Idioma dos textos. Padrão "pt". */
  lang?: SalesLang;
}

export function MroIntelligentIntro({ branding, lang = 'pt' }: MroIntelligentIntroProps) {
  const t = introCopy[lang];
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
    <p className="text-primary text-sm font-bold uppercase mb-4">{t.eyebrow}</p>
    <h1 className="mro-sales-title text-4xl md:text-7xl text-foreground uppercase leading-tight mb-4">
      {t.title1}
      <span className="block text-primary text-2xl md:text-5xl mt-3">{t.title2}</span>
    </h1>
    <p className="text-base md:text-xl font-semibold text-primary max-w-3xl mx-auto">{t.sub}</p>
  </>;
}
