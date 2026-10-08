import { Bot, Brain, CheckCircle2, Heart, Kanban, MessageCircle, ScanSearch, UserPlus, Video } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const features = [
  { id: '01', icon: ScanSearch, title: 'Rastreia públicos de concorrentes e páginas', description: 'Indique páginas, concorrentes ou perfis do seu nicho. A MRO reúne seguidores, curtidores e pessoas que comentam em listas organizadas, para uma prospecção mais direcionada.', detail: 'Encontre pessoas alinhadas ao que sua empresa oferece.' },
  { id: '02', icon: MessageCircle, title: 'Envia mensagens em massa', description: 'Entre em contato com públicos de páginas e concorrentes, seus seguidores, pessoas que já conversaram com você, curtidores e comentaristas. Use também públicos rastreados ou uma lista personalizada de @nomes.', detail: 'Diferentes fontes de público, uma abordagem definida por você.' },
  { id: '03', icon: Bot, title: 'Atendente com Agente I.A', description: 'Configure seu próprio prompt. Integrado ao ChatGPT, o agente responde mensagens, esclarece dúvidas e conduz conversas e abordagens comerciais conforme suas instruções.', detail: 'Automatize o atendimento e acompanhe as conversas.' },
  { id: '04', icon: Kanban, title: 'CRM Kanban', description: 'Organize as conversas do Instagram pelo estágio de cada lead. Separe quem está no primeiro contato, quem precisa de acompanhamento e os interessados mais quentes.', detail: 'Saiba qual oportunidade merece o próximo contato.' },
  { id: '05', icon: Video, title: 'Publica Stories diários', description: 'Programe seus Stories para publicação automática todos os dias, nos horários que você definir e com conteúdos distribuídos ao longo do dia. As publicações acontecem conforme sua configuração.', detail: 'Mantenha seu perfil presente com conteúdo autorizado por você.' },
  { id: '06', icon: UserPlus, title: 'Boas-vindas para novos seguidores', description: 'Receba novos seguidores com uma mensagem automática. Personalize a abordagem para apresentar sua empresa, produto ou serviço e começar uma conversa com potencial comercial.', detail: 'Transforme um novo seguidor no início de um relacionamento.' },
  { id: '07', icon: Heart, title: 'Segue, curte e deixa de seguir', description: 'Interaja com públicos de concorrentes, páginas e perfis estratégicos por meio de ações de seguir, curtir e deixar de seguir. Trabalhe conexões com pessoas do seu nicho.', detail: 'Crie oportunidades de visitas e novos contatos.' },
  { id: '08', icon: Brain, title: 'Inteligência I.A para estratégias', description: 'A inteligência MRO analisa seu perfil e seu nicho para sugerir conteúdo, posts, Stories e estratégias de crescimento. Crie scripts de vendas e abordagem, ideias de prospecção e melhorias no posicionamento.', detail: 'Uma estratégia personalizada para prospectar e vender melhor.' },
];

export function MroIntelligentFeatures() {
  const reducedMotion = useReducedMotion();
  return <>
    <section className="py-16 md:py-24 px-4 border-t border-border bg-background">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <p className="text-primary text-xs font-bold uppercase mb-5">O que você vai receber</p>
          <h2 className="mro-sales-title text-3xl md:text-5xl uppercase leading-tight">Tudo para crescer<br /><span className="text-primary">no Instagram</span></h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mt-5">Oito funções para conectar sua empresa ao público certo e cuidar das oportunidades do primeiro contato à venda.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map(({ id, icon: Icon, title, description, detail }) => <motion.article key={id} initial={reducedMotion ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} className="mro-feature border border-border bg-card rounded-lg p-6 md:p-8">
            <div className="flex items-center justify-between mb-6"><span className="bg-primary text-primary-foreground rounded-lg p-3"><Icon size={26} /></span><span className="text-muted-foreground font-mono text-sm">{id} / 08</span></div>
            <h3 className="text-xl md:text-2xl font-bold mb-4 text-foreground">{title}</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">{description}</p>
            <p className="text-primary text-sm font-semibold flex items-start gap-2"><CheckCircle2 size={17} className="shrink-0 mt-0.5" />{detail}</p>
          </motion.article>)}
        </div>
        <p className="text-muted-foreground text-sm text-center max-w-3xl mx-auto mt-8">Você controla as configurações e as abordagens. Respeite os limites do Instagram e as preferências dos contatos; automação não elimina o risco de restrições nem garante vendas.</p>
      </div>
    </section>
    <section className="bg-secondary/20 border-y border-border px-4 py-16">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10">
        <div><p className="text-primary font-bold mb-3">Mais oportunidades</p><h2 className="text-2xl font-bold mb-4">Uma virada de chave para seu negócio online.</h2><p className="text-muted-foreground">Menos tarefas repetitivas, mais tempo para atender clientes e desenvolver suas vendas.</p></div>
        <div><h3 className="text-xl font-bold mb-4">Aprenda a colocar em prática</h3><p className="text-muted-foreground">Vídeos estratégicos e passo a passo para configurar a ferramenta, melhorar seu perfil e trabalhar sua prospecção.</p></div>
        <div><h3 className="text-xl font-bold mb-4">Suporte e grupo VIP</h3><p className="text-muted-foreground">Tire dúvidas, compartilhe experiências e acompanhe as novidades com o suporte da MRO e o grupo no WhatsApp.</p></div>
      </div>
    </section>
  </>;
}