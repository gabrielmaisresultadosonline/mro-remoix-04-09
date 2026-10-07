import { useEffect } from 'react';
import { ArrowUpRight, BadgeCheck, Bot, Check, Fingerprint, Heart, KanbanSquare, Layers3, Lightbulb, MessageCircle, Monitor, Send, ShieldCheck, Users, Wallet } from 'lucide-react';
import { WlSalesContact } from '@/components/whitelabel/WlSalesContact';
import logo from '@/assets/logo-mro-white.png';
import heroAsset from '@/assets/whitelabel-sales-hero-upload.png.asset.json';

// This project's asset host also serves the uploaded image on the self-hosted VPS.
const heroUrl = `https://id-preview--9fa0bd1c-c32d-4b36-a598-fe30173cebce.lovable.app${heroAsset.url}`;

const benefits = [
  { icon: Fingerprint, title: 'A sua marca. A nossa tecnologia.', text: 'Sua logo na ferramenta, uma versão de download exclusiva e páginas de venda com a identidade do seu negócio.' },
  { icon: Users, title: 'Seus clientes, no seu painel.', text: 'Crie acessos, libere contas adicionais e renove testes dos clientes cadastrados por você.' },
  { icon: Wallet, title: 'Vendas e taxas organizadas.', text: 'Acompanhe clientes, planos, faturamento e valores a pagar. Cadastre seu PIX para receber as vendas pelos links MRO.' },
  { icon: Layers3, title: 'Estrutura pronta para vender.', text: 'Links completos para cliente final e Renda Extra, tutoriais e atualizações da ferramenta no seu painel.' },
];
const plans = [
  { name: 'Plano anual', price: 'R$ 397', fee: 'R$ 100', description: 'Valor mínimo de venda por acesso anual.' },
  { name: 'Plano vitalício', price: 'R$ 1.200', fee: 'R$ 197', description: 'Valor mínimo de venda. Inclui 12 contas.' },
];
const instagramFeatures = [
  { icon: Send, title: 'Disparo em massa de mensagens', text: 'Leve suas mensagens ao público e mantenha sua comunicação comercial em movimento.' },
  { icon: KanbanSquare, title: 'CRM Kanban', text: 'Organize contatos e acompanhe cada oportunidade pelas etapas do seu atendimento.' },
  { icon: Bot, title: 'Agente I.A.', text: 'Inteligência artificial para apoiar o atendimento e as conversas com seus potenciais clientes.' },
  { icon: Heart, title: 'Seguir e curtir', text: 'Recursos para trabalhar interações no Instagram e aproximar sua marca do público.' },
  { icon: MessageCircle, title: 'Mensagem de boas-vindas', text: 'Receba novos seguidores com uma mensagem e transforme a chegada deles em uma oportunidade de conversa.' },
  { icon: Lightbulb, title: 'Inteligência MRO', text: 'Crie estratégias para orientar suas ações no Instagram, com foco em vendas, clientes e engajamento.' },
];

/** This public presentation page does not change reseller billing or existing sales links. */
export default function WhitelabelSales() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'MRO Whitelabel | Sua marca, sua ferramenta, suas vendas';
    const metadata: Array<[string, string, string]> = [
      ['name', 'description', 'Tenha sua própria marca com MRO Whitelabel por R$ 2.997. Comece com 10 acessos sem taxas por usuário, painel de clientes e páginas completas de vendas.'],
      ['property', 'og:title', 'MRO Whitelabel — Sua própria ferramenta'],
      ['property', 'og:description', 'Sua marca com tecnologia MRO. R$ 2.997 com 10 acessos iniciais sem taxas por usuário.'],
      ['property', 'og:type', 'website'], ['name', 'twitter:card', 'summary_large_image'],
    ];
    const cleanup = metadata.map(([attribute, key, content]) => {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      const element = existing ?? document.createElement('meta');
      const previous = element.getAttribute('content');
      element.setAttribute(attribute, key); element.content = content;
      if (!existing) document.head.appendChild(element);
      return () => { if (!existing) element.remove(); else if (previous !== null) element.content = previous; };
    });
    return () => { document.title = previousTitle; cleanup.forEach((restore) => restore()); };
  }, []);

  return <main className="wl-sales bg-background text-foreground">
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 md:px-8">
        <div className="flex items-center gap-4"><img src={logo} alt="MRO" width={1350} height={594} className="h-12 w-28 object-contain" /><span className="hidden border-l border-border pl-4 text-xs font-semibold uppercase tracking-widest sm:block">Whitelabel</span></div>
        <WlSalesContact label="Falar com suporte" variant="outline" className="min-h-10 px-3 py-2 text-xs sm:text-sm" />
      </div>
    </header>

    <section className="wl-sales-hero relative isolate overflow-hidden">
      <img src={heroUrl} alt="Ferramenta MRO para Instagram em um notebook, com iluminação verde e dez chaves de acesso" width={1440} height={768} fetchPriority="high" className="wl-sales-hero-image absolute inset-0 -z-20 h-full w-full object-cover" />
      <div className="wl-sales-hero-shade absolute inset-0 -z-10" />
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-24">
        <div className="max-w-xl">
          <p className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><span className="h-2 w-2 bg-primary" />Tecnologia MRO. Identidade sua.</p>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">MRO Whitelabel</h1>
          <p className="mt-4 text-3xl font-semibold leading-tight md:text-4xl">Sua marca.<br />Sua ferramenta.<br /><span className="text-primary">Seu próximo negócio.</span></p>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">Venda a ferramenta MRO para Instagram com a sua marca e gerencie seus clientes em um painel próprio. Você cuida das vendas. O suporte, a tecnologia e as atualizações ficam com a MRO.</p>
          <div className="mt-8"><WlSalesContact /></div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" />10 acessos iniciais sem taxas por usuário</p>
        </div>
      </div>
    </section>

    <section className="border-b border-border bg-secondary">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Ferramenta MRO para Instagram</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-bold md:text-4xl">Uma virada de chave para quem empreende online.</h2>
        <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">Vender mais, conquistar clientes e aumentar o engajamento: essa é a dor de quem empreende online. A proposta da MRO é reunir comunicação, organização e inteligência em uma ferramenta para trabalhar esses objetivos no Instagram.</p>
        <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {instagramFeatures.map(({ icon: Icon, title, text }) => <article key={title} className="border-t border-border pt-6"><Icon className="mb-4 h-7 w-7 text-primary" /><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{text}</p></article>)}
        </div>
        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">Os resultados dependem da estratégia, do público e da execução de cada negócio.</p>
      </div>
    </section>

    <section className="border-y border-border bg-secondary">
      <div className="mx-auto grid max-w-7xl grid-cols-3 gap-3 px-5 py-7 text-center md:px-8">
        {[['Sua marca', 'na ferramenta'], ['10 acessos', 'sem taxas iniciais'], ['Painel próprio', 'para seus clientes']].map(([title, text]) => <div key={title}><p className="text-sm font-bold md:text-xl">{title}</p><p className="mt-1 text-xs text-muted-foreground md:text-sm">{text}</p></div>)}
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Mais do que revender</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-bold md:text-4xl">Uma operação com a sua identidade.</h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">Whitelabel é vender uma tecnologia já desenvolvida com a marca do seu negócio. Sem precisar começar um software do zero.</p>
      <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
        {benefits.map(({ icon: Icon, title, text }) => <article key={title} className="border-t border-border pt-6"><Icon className="mb-4 h-7 w-7 text-primary" /><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">{text}</p></article>)}
      </div>
    </section>

    <section className="border-y border-border bg-secondary">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-20">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Do início à primeira venda</p><h2 className="mt-3 text-3xl font-bold md:text-4xl">Seu negócio em três etapas.</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">{[
          ['01', 'Ative seu Whitelabel', 'Converse com a equipe MRO para iniciar sua operação e configurar a sua marca.'],
          ['02', 'Receba sua estrutura', 'Acesse seu painel, a ferramenta com sua marca, os tutoriais e os links de venda.'],
          ['03', 'Venda e acompanhe', 'Crie os acessos manualmente ou divulgue seu link de venda automático. Acompanhe planos, vendas e taxas pelo painel.'],
        ].map(([number, title, text]) => <article key={number}><span className="text-3xl font-bold text-primary">{number}</span><h3 className="mt-4 text-xl font-semibold">{title}</h3><p className="mt-3 leading-relaxed text-muted-foreground">{text}</p></article>)}</div>
        <div className="mt-12 border-t border-border pt-8"><ShieldCheck className="h-7 w-7 text-primary" /><h3 className="mt-4 text-2xl font-semibold">O suporte é nosso. Você só vende.</h3><p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">A equipe MRO cuida do suporte da ferramenta para seus clientes. Você escolhe como vender: cria o acesso manual no seu painel ou compartilha o link automático, que libera o acesso após a confirmação do pagamento.</p></div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-16 md:px-8 md:py-24">
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Valores transparentes</p><h2 className="mt-3 text-3xl font-bold md:text-4xl">Você vende. A MRO mantém a tecnologia.</h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">Respeite o preço mínimo de cada plano: você pode vender por esse valor ou mais, nunca por menos. As taxas ajudam a manter e atualizar as versões.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">{plans.map((plan) => <article key={plan.name} className="rounded-lg border border-border bg-card p-6 md:p-8"><BadgeCheck className="h-6 w-6 text-primary" /><h3 className="mt-4 text-xl font-semibold">{plan.name}</h3><p className="mt-4 text-4xl font-bold">{plan.price}</p><p className="mt-2 text-sm text-muted-foreground">{plan.description}</p><div className="mt-6 border-t border-border pt-5"><p className="font-semibold">Taxa por usuário: {plan.fee}</p><p className="mt-2 text-sm text-muted-foreground">Somente após os 10 acessos iniciais inclusos.</p></div></article>)}</div>
      <div className="mt-6 border-l-2 border-primary pl-5"><h3 className="font-semibold">Contas adicionais</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Venda a partir de R$ 100 por conta anual ou R$ 150 por conta vitalícia. Taxa de R$ 40 por conta adicional. A isenção inicial se refere às taxas por usuário.</p></div>
    </section>

    <section className="wl-sales-offer border-y border-border bg-secondary">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:px-8 md:py-20">
        <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Comece com sua marca</p><h2 className="mt-3 text-3xl font-bold md:text-4xl">O próximo nome na ferramenta pode ser o seu.</h2><p className="mt-5 leading-relaxed text-muted-foreground">Estrutura Whitelabel MRO com dez acessos iniciais para começar suas vendas sem pagar taxas por usuário.</p><ul className="mt-6 space-y-3">{['Ferramenta com sua marca', 'Painel de clientes e acompanhamento de vendas', 'Links de venda e tutoriais', '10 acessos iniciais sem taxas por usuário'].map((item) => <li key={item} className="flex items-start gap-3 text-sm"><Check className="h-5 w-5 shrink-0 text-primary" />{item}</li>)}</ul></div>
        <div className="border-t border-border pt-8 md:border-l md:border-t-0 md:pl-10 md:pt-0"><p className="text-sm text-muted-foreground">Investimento para iniciar</p><p className="mt-3 text-5xl font-bold md:text-6xl">R$ 2.997<span className="text-2xl text-muted-foreground">,00</span></p><p className="mt-5 flex items-center gap-2 font-semibold text-primary"><Monitor className="h-5 w-5" />10 acessos inclusos</p><p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Começa a pagar taxa por novo usuário somente após utilizar os 10 acessos iniciais.</p><WlSalesContact label="Quero ser Whitelabel MRO" className="mt-8 w-full" /><p className="mt-3 text-center text-xs text-muted-foreground">Fale diretamente com a equipe pelo WhatsApp.</p></div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-5 py-16 md:px-8"><div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center"><div><h2 className="text-2xl font-bold md:text-3xl">Vamos conversar sobre a sua marca?</h2><p className="mt-3 text-muted-foreground">Tire suas dúvidas e conheça os próximos passos com a equipe MRO.</p></div><WlSalesContact label="Falar com suporte" variant="outline" /></div></section>
    <footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 sm:flex-row md:px-8"><img src={logo} alt="MRO" width={1350} height={594} loading="lazy" className="h-10 w-24 object-contain" /><p className="text-center text-xs text-muted-foreground">MRO Whitelabel · Sua marca, com tecnologia MRO.</p><ArrowUpRight aria-hidden="true" className="h-5 w-5 text-primary" /></div></footer>
  </main>;
}