import { BookOpen, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getYoutubeThumbnail, type TutorialModule, type ModuleContent, type WelcomeVideo } from '@/lib/adminConfig';
import MroTrainingRow from './MroTrainingRow';

export interface MroNetflixViewProps {
  modules: TutorialModule[];
  welcome?: WelcomeVideo;
  onWelcome: () => void;
  onOpen: (module: TutorialModule, content: ModuleContent) => void;
}
export default function MroNetflixView({ modules, welcome, onWelcome, onOpen }: MroNetflixViewProps) {
  const image = welcome?.backgroundUrl || welcome?.coverUrl || (welcome?.youtubeUrl ? getYoutubeThumbnail(welcome.youtubeUrl) : '');
  return (
    <>
      {welcome?.enabled && <section className="mro-training-welcome relative isolate flex items-end min-h-[430px] md:min-h-[490px] overflow-hidden">
        {image && <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover -z-20" />}
        <div className="mro-training-shade absolute inset-0 -z-10" />
        <div className="container mx-auto px-5 md:px-8 py-12 md:py-16">
          <span className="text-primary text-xs font-semibold uppercase">MRO Inteligente · Treinamentos</span>
          {welcome.showTitle && <h1 className="mt-4 max-w-2xl text-3xl md:text-5xl font-display font-bold leading-tight">{welcome.title || 'Seja bem-vindo à melhor ferramenta para Instagram!'}</h1>}
          <p className="mt-5 max-w-lg text-sm md:text-base leading-relaxed text-muted-foreground">{welcome.description ?? 'Aprenda a instalar, configurar e utilizar o MRO Inteligente.'}</p>
          <div className="flex flex-wrap gap-3 mt-7">
            {welcome.youtubeUrl && <Button onClick={onWelcome} className="gap-2"><Play className="h-4 w-4" />Assistir apresentação</Button>}
            <Button variant="outline" className="gap-2 bg-background/50" onClick={() => document.getElementById('mro-training-modules')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><BookOpen className="h-4 w-4" />Ver módulos</Button>
          </div>
        </div>
      </section>}
      <main id="mro-training-modules" className="container mx-auto px-5 md:px-8 py-5 scroll-mt-32">
        {modules.length === 0 && <p className="py-12 text-muted-foreground">Nenhum módulo disponível ainda.</p>}
        {[...modules].sort((a, b) => a.order - b.order).map((module) => <div key={module.id}>
          <MroTrainingRow title={module.title} description={module.description} bonus={module.isBonus} contents={module.contents.filter((c) => c.type !== 'section')} onOpen={(content) => onOpen(module, content)} />
          {module.contents.filter((c) => c.type === 'section').sort((a, b) => a.order - b.order).map((section) => section.type === 'section' && <MroTrainingRow key={section.id} title={section.title} description={section.description} bonus={section.isBonus} showTitle={section.showTitle} contents={section.contents || []} onOpen={(content) => onOpen(module, content)} />)}
        </div>)}
      </main>
    </>
  );
}