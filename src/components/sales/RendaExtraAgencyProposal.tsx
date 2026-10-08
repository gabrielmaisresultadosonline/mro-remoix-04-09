import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, Search, Target, MessageCircle, Bot, KanbanSquare, Clapperboard, UserPlus,
  Heart, Brain, Laptop, Briefcase, Headphones, BookOpen, Lightbulb, RefreshCw, Users, Check, Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Proposta "Agência Digital com um notebook" — apresentação compartilhada pelas
 * páginas /promorendaextra/:id e /descontoalunosrendaextra.
 * Somente apresentação: não toca em preços, checkout, vídeos ou afiliados.
 */
interface RendaExtraAgencyProposalProps {
  onCta: () => void;
  ctaLabel?: string;
}

/** Revela o bloco ao entrar na tela (leve, sem bibliotecas). */
const Reveal = ({ children, className = "" }: { children: ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}>
      {children}
    </div>
  );
};

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">
    {children}
  </span>
);

const Title = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-4 text-2xl sm:text-3xl md:text-5xl font-black leading-tight text-white">{children}</h2>
);

const Section = ({ children, alt = false }: { children: ReactNode; alt?: boolean }) => (
  <section className={`relative overflow-hidden px-4 py-16 sm:py-24 ${alt ? "bg-zinc-950" : "bg-black"}`}>
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent" />
    <div className="relative mx-auto max-w-6xl">{children}</div>
  </section>
);

const CtaButton = ({ onCta, label }: { onCta: () => void; label: string }) => (
  <div className="mt-10 flex justify-center">
    <Button onClick={onCta} className="btn-pulse-color rounded-full px-8 py-6 text-sm sm:text-lg font-black text-black shadow-lg shadow-yellow-500/30">
      {label} <ArrowRight className="ml-2 h-5 w-5" />
    </Button>
  </div>
);

const SERVICES = ["Gestão de Instagram", "Prospecção de clientes", "Geração de oportunidades", "Atendimento automático", "Gestão de Direct", "Publicação de Stories", "Engajamento", "Organização de leads", "Estratégias com IA", "Acompanhamento comercial"];

const STEPS = [
  { n: "01", t: "PROSPECTE", d: "Encontre públicos e potenciais clientes." },
  { n: "02", t: "VENDA", d: "Apresente sua solução e transforme oportunidades em contratos." },
  { n: "03", t: "EXECUTE", d: "Use a MRO para executar e automatizar tarefas." },
  { n: "04", t: "ESCALONE", d: "Atenda mais empresas sem aumentar sua operação na mesma proporção." },
];

const TOOLS = [
  { icon: Search, t: "Rastreamento de públicos", d: "Seguidores, curtidores, quem comenta, concorrentes, páginas estratégicas e perfis do nicho." },
  { icon: Target, t: "Prospecção", d: "Trabalhe seguidores de concorrentes, quem interagiu, listas personalizadas e públicos rastreados." },
  { icon: MessageCircle, t: "Mensagens em massa", d: "Não espere o cliente chegar. Inicie conversas com abordagens por nicho, serviço e objetivo." },
  { icon: Bot, t: "Agente IA", d: "Responde, tira dúvidas, conduz conversas, qualifica oportunidades e faz abordagens comerciais." },
  { icon: KanbanSquare, t: "CRM Kanban", d: "Novo lead → Em conversa → Interessado → Proposta → Negociação → Cliente." },
  { icon: Clapperboard, t: "Stories automáticos", d: "Programe Stories ao longo do dia e mantenha o perfil do cliente sempre ativo." },
  { icon: UserPlus, t: "Boas-vindas", d: "Novo seguidor → mensagem automática → início da conversa → oportunidade." },
  { icon: Heart, t: "Crescimento e engajamento", d: "Seguir, curtir, deixar de seguir e interagir com públicos do nicho do cliente." },
  { icon: Brain, t: "IA para estratégia", d: "Ideias de conteúdo, Stories, prospecção, scripts de vendas, posicionamento e crescimento." },
];

const PLANS = [
  { t: "Presença Digital", items: ["Gestão do Instagram", "Stories diários", "Estratégia de conteúdo", "Engajamento", "Relatórios"] },
  { t: "Prospecção", items: ["Rastreamento de públicos", "Prospecção", "Abordagens", "CRM", "Acompanhamento dos leads"] },
  { t: "Vendas", items: ["Prospecção", "Atendimento", "Agente IA", "CRM", "Estratégias comerciais"] },
  { t: "Completo", items: ["Marketing", "Prospecção", "Atendimento", "IA", "Gestão"], featured: true },
];

const MATH = [
  { c: "5 clientes", v: "R$ 1.000/mês", r: "R$ 5.000/mês" },
  { c: "10 clientes", v: "R$ 1.000/mês", r: "R$ 10.000/mês" },
  { c: "10 clientes", v: "R$ 1.500/mês", r: "R$ 15.000/mês" },
  { c: "20 clientes", v: "R$ 1.500/mês", r: "R$ 30.000/mês" },
];

const SUPPORT = [
  { icon: Headphones, t: "Suporte", d: "Tire dúvidas e receba orientação." },
  { icon: BookOpen, t: "Conteúdo", d: "Aprenda a usar todos os recursos." },
  { icon: Lightbulb, t: "Estratégias", d: "Ideias para melhorar sua operação." },
  { icon: RefreshCw, t: "Atualizações", d: "Acompanhe a evolução da plataforma." },
  { icon: Users, t: "Comunidade", d: "Aprenda com quem já trabalha com a MRO." },
];

const JOURNEY = ["Conheça a MRO", "Escolha um nicho", "Crie sua oferta", "Prospecte", "Feche o contrato", "Execute", "Mantenha o cliente", "Escalone"];

const FOR_WHO = ["Quer começar no marketing digital", "Já trabalha com social media", "É freelancer", "Tem uma agência pequena", "Trabalha sozinho", "Quer prestar serviços para empresas", "Quer criar renda recorrente", "Quer usar IA na sua operação"];

/** Faz o carrossel de vídeos de prova social deslizar sozinho (pausa ao tocar/passar o mouse). */
export const useAutoSlideCarousel = (id: string, intervalMs = 2800) => {
  useEffect(() => {
    let paused = false;
    const el = document.getElementById(id);
    if (!el) return;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", () => setTimeout(resume, 4000), { passive: true });
    const timer = window.setInterval(() => {
      if (paused || document.hidden) return;
      const card = el.firstElementChild as HTMLElement | null;
      const step = (card?.offsetWidth ?? 220) + 16;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: step, behavior: "smooth" });
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("touchstart", pause);
    };
  }, [id, intervalMs]);
};

export const RendaExtraAgencyProposal = ({ onCta, ctaLabel = "QUERO COMEÇAR AGORA" }: RendaExtraAgencyProposalProps) => {
  useAutoSlideCarousel("feedback-carousel");

  return (
    <div className="text-white">
      {/* Oportunidade */}
      <Section>
        <Reveal className="text-center">
          <Eyebrow><Laptop className="h-4 w-4" /> Agência digital com um notebook</Eyebrow>
          <Title>Uma ferramenta que vira <span className="text-yellow-400">um negócio de verdade.</span></Title>
          <p className="mx-auto mt-5 max-w-3xl text-sm sm:text-lg text-zinc-300">
            Milhares de empresas precisam de alguém para cuidar do Instagram, gerar oportunidades, responder clientes e manter o perfil ativo — e não sabem fazer isso sozinhas. Com a MRO Inteligente você tem a estrutura para prestar esses serviços, criar pacotes mensais e atender vários clientes ao mesmo tempo.
          </p>
        </Reveal>
        <Reveal className="mt-10 flex flex-wrap justify-center gap-2 sm:gap-3">
          {SERVICES.map((s) => (
            <span key={s} className="rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-xs sm:text-sm font-semibold text-zinc-200 transition hover:border-yellow-400 hover:text-yellow-400">{s}</span>
          ))}
        </Reveal>
        <Reveal className="mt-12 rounded-3xl border border-yellow-400/30 bg-gradient-to-br from-yellow-400/10 via-zinc-950 to-black p-6 sm:p-10 text-center">
          <p className="text-lg sm:text-2xl font-bold text-zinc-200">A MRO abre portas. <span className="text-yellow-400">Você transforma essas portas em contratos.</span></p>
          <p className="mt-6 text-2xl sm:text-4xl font-black leading-tight">UM CLIENTE VIRA UMA MENSALIDADE.<br /><span className="text-yellow-400">VÁRIOS CLIENTES VIRAM UM NEGÓCIO.</span></p>
        </Reveal>
      </Section>

      {/* Modelo de negócio */}
      <Section alt>
        <Reveal className="text-center">
          <Eyebrow>Um notebook. Uma operação.</Eyebrow>
          <Title>Sem sala, sem equipe enorme, <span className="text-yellow-400">sem dezenas de ferramentas.</span></Title>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <Reveal key={s.n}>
              <div className="group h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition duration-300 hover:-translate-y-1 hover:border-yellow-400/60 hover:shadow-[0_20px_50px_-20px_rgba(234,179,8,0.45)]">
                <span className="text-4xl font-black text-yellow-400/80 group-hover:text-yellow-400">{s.n}</span>
                <h3 className="mt-3 text-lg font-black">{s.t}</h3>
                <p className="mt-2 text-sm text-zinc-400">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Ferramentas */}
      <Section>
        <Reveal className="text-center">
          <Eyebrow><Briefcase className="h-4 w-4" /> Todas as funções</Eyebrow>
          <Title>Tudo o que você precisa para operar, <span className="text-yellow-400">em um só lugar.</span></Title>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ icon: Icon, t, d }) => (
            <Reveal key={t}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-black p-6 transition duration-300 hover:border-yellow-400/60">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-yellow-400/10 blur-2xl transition group-hover:bg-yellow-400/25" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400 text-black"><Icon className="h-6 w-6" /></div>
                <h3 className="mt-4 text-lg font-black">{t}</h3>
                <p className="mt-2 text-sm text-zinc-400">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <CtaButton onCta={onCta} label={ctaLabel} />
      </Section>

      {/* Serviços / planos */}
      <Section alt>
        <Reveal className="text-center">
          <Eyebrow>O verdadeiro produto é o seu serviço</Eyebrow>
          <Title>A ferramenta é sua estrutura. <span className="text-yellow-400">Seu serviço gera o contrato.</span></Title>
          <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-zinc-400">Monte planos mensais para empresas de acordo com o que será entregue:</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <Reveal key={p.t}>
              <div className={`h-full rounded-2xl border p-6 ${p.featured ? "border-yellow-400 bg-yellow-400/10" : "border-zinc-800 bg-zinc-900/60"}`}>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Plano</p>
                <h3 className={`text-xl font-black ${p.featured ? "text-yellow-400" : "text-white"}`}>{p.t}</h3>
                <ul className="mt-4 space-y-2">
                  {p.items.map((i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-zinc-300"><Check className="h-4 w-4 shrink-0 text-yellow-400" />{i}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Matemática */}
      <Section>
        <Reveal className="text-center">
          <Eyebrow>A matemática do negócio</Eyebrow>
          <Title>Você não precisa de <span className="text-yellow-400">centenas de clientes.</span></Title>
        </Reveal>
        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {MATH.map((m, i) => (
            <Reveal key={i}>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-4 sm:px-6">
                <span className="text-sm sm:text-lg font-semibold text-zinc-300">{m.c} × {m.v}</span>
                <span className="text-lg sm:text-2xl font-black text-yellow-400">{m.r}</span>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 text-center">
          <p className="text-xl sm:text-3xl font-black">O objetivo não é vender uma vez.<br /><span className="text-yellow-400">É construir uma carteira de contratos mensais.</span></p>
          <p className="mt-3 text-xs text-zinc-500">Valores ilustrativos de composição de receita, não promessa de faturamento.</p>
        </Reveal>
      </Section>

      {/* Realidade / prova */}
      <Section alt>
        <Reveal className="mx-auto max-w-4xl text-center">
          <Quote className="mx-auto h-10 w-10 text-yellow-400" />
          <Title>Não é só uma possibilidade. <span className="text-yellow-400">É uma realidade.</span></Title>
          <p className="mt-5 text-sm sm:text-lg text-zinc-300">Mais de <strong className="text-white">100 empreendedores</strong> já usam a estrutura da MRO para prestar serviços e construir suas próprias operações digitais — e vários já passam de <strong className="text-yellow-400">R$ 5 mil por mês</strong> com seus serviços.</p>
          <p className="mt-8 text-2xl sm:text-4xl font-black leading-tight">VOCÊ ENTRA COM A VONTADE DE TRABALHAR.<br /><span className="text-yellow-400">A MRO ENTREGA A ESTRUTURA.</span></p>
          <p className="mt-3 text-xs text-zinc-500">Resultados variam conforme dedicação, estratégia, nicho, oferta e execução.</p>
        </Reveal>
      </Section>

      {/* Suporte */}
      <Section>
        <Reveal className="text-center">
          <Eyebrow>Nosso suporte</Eyebrow>
          <Title>Você não precisa <span className="text-yellow-400">descobrir tudo sozinho.</span></Title>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {SUPPORT.map(({ icon: Icon, t, d }) => (
            <Reveal key={t}>
              <div className="h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-center transition hover:border-yellow-400/60">
                <Icon className="mx-auto h-8 w-8 text-yellow-400" />
                <h3 className="mt-3 font-black">{t}</h3>
                <p className="mt-1 text-xs sm:text-sm text-zinc-400">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Jornada + Para quem */}
      <Section alt>
        <Reveal className="text-center">
          <Eyebrow>Sua jornada</Eyebrow>
          <Title>Do notebook ao seu <span className="text-yellow-400">primeiro contrato.</span></Title>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {JOURNEY.map((j, i) => (
            <Reveal key={j}>
              <div className="relative h-full rounded-xl border border-zinc-800 bg-black p-4">
                <span className="text-xs font-bold text-yellow-400">ETAPA {String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 text-sm sm:text-base font-black">{j}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-14 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-10">
          <h3 className="text-center text-xl sm:text-3xl font-black">A MRO é para você se...</h3>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {FOR_WHO.map((f) => (
              <p key={f} className="flex items-center gap-3 text-sm sm:text-base text-zinc-200"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-black"><Check className="h-4 w-4" /></span>{f}</p>
            ))}
          </div>
        </Reveal>
        <Reveal className="mt-12 text-center">
          <p className="text-xl sm:text-3xl font-black">A MRO fornece a estrutura. <span className="text-yellow-400">Você constrói o negócio.</span></p>
        </Reveal>
        <CtaButton onCta={onCta} label={ctaLabel} />
      </Section>
    </div>
  );
};

export default RendaExtraAgencyProposal;
