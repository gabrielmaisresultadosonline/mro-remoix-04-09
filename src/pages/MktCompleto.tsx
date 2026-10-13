import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue, AnimatePresence } from "framer-motion";
import {
  Target, Sparkles, Brain, PenTool, Image as ImageIcon, Users, BarChart3,
  ShieldCheck, Rocket, MessageCircle, Zap, TrendingUp, Award, CheckCircle2,
  ArrowRight, Gift, DollarSign, Eye, Layers, MousePointer2,
} from "lucide-react";

/* ============================================================
   /mktcompleto — Apresentação Comercial Premium
   Palette: black / white / gray / yellow  (#FFD400)
   ============================================================ */

const ACCENT = "#FFD400";

// ---------- Cursor Spotlight ----------
const CursorSpotlight = () => {
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 120, damping: 20, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 120, damping: 20, mass: 0.6 });

  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[60] mix-blend-screen"
        style={{
          background: `radial-gradient(420px circle at ${sx.get()}px ${sy.get()}px, rgba(255,212,0,0.18), transparent 60%)`,
        }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed z-[70] h-3 w-3 rounded-full"
        style={{ x: sx, y: sy, translateX: "-50%", translateY: "-50%", background: ACCENT, boxShadow: `0 0 24px ${ACCENT}` }}
      />
    </>
  );
};

// ---------- Animated Grid ----------
const GridBG = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 opacity-[0.07]"
    style={{
      backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
      backgroundSize: "60px 60px",
      maskImage: "radial-gradient(circle at center, black 30%, transparent 80%)",
    }}
  />
);

// ---------- Floating Orbs ----------
const Orbs = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <motion.div
      className="absolute h-[600px] w-[600px] rounded-full blur-3xl"
      style={{ background: "radial-gradient(circle, rgba(255,212,0,0.25), transparent 70%)" }}
      animate={{ x: ["-20%", "60%", "-20%"], y: ["10%", "60%", "10%"] }}
      transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute right-0 h-[500px] w-[500px] rounded-full blur-3xl"
      style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }}
      animate={{ x: ["20%", "-40%", "20%"], y: ["80%", "20%", "80%"] }}
      transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
    />
  </div>
);

// ---------- 3D Tilt Card ----------
const TiltCard: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0); const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });

  const handle = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 14); rx.set(-py * 14);
  };
  const reset = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handle}
      onMouseLeave={reset}
      style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d", perspective: 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ---------- Reveal ----------
const Reveal: React.FC<React.PropsWithChildren<{ delay?: number; y?: number; className?: string }>> = ({
  children, delay = 0, y = 40, className = "",
}) => (
  <motion.div
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

// ---------- Marquee ----------
const Marquee: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="relative w-full overflow-hidden border-y border-white/10 bg-black py-5">
    <motion.div
      className="flex gap-12 whitespace-nowrap"
      animate={{ x: ["0%", "-50%"] }}
      transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
    >
      {[...items, ...items].map((t, i) => (
        <span key={i} className="text-2xl font-medium tracking-tight text-white/70 md:text-3xl">
          {t} <span style={{ color: ACCENT }}>✦</span>
        </span>
      ))}
    </motion.div>
  </div>
);

// ---------- Data ----------
const META_BULLETS = [
  "Planejamento estratégico das campanhas",
  "Configuração completa do Gerenciador de Anúncios",
  "Configuração do Pixel da Meta",
  "Integrações necessárias",
  "Definição do público-alvo ideal",
  "Segmentação por localização, idade, gênero",
  "Segmentação por interesses e comportamento",
  "Públicos personalizados e Lookalike",
  "Remarketing para quem demonstrou interesse",
  "Campanhas de Leads, WhatsApp e Vendas",
  "Reconhecimento de marca",
  "Testes A/B constantes",
  "Otimização diária",
  "Controle do custo por Lead/resultado",
  "Escala conforme o desempenho",
  "Relatórios completos de performance",
];

const PILARES = [
  { icon: Target,      title: "Marketing Estratégico",   desc: "Diagnóstico, posicionamento e planejamento sob medida para o seu negócio." },
  { icon: PenTool,     title: "Copywriting Profissional",desc: "Textos persuasivos com gatilhos mentais que transformam cliques em vendas." },
  { icon: ImageIcon,   title: "Criativos de Alto Impacto",desc: "Artes, banners e vídeos pensados para capturar atenção e converter." },
  { icon: Brain,       title: "Inteligência Artificial", desc: "IA aplicada em atendimento, organização, análise e otimização contínua." },
  { icon: Users,       title: "Geração de Leads",        desc: "Contatos qualificados direcionados ao WhatsApp da sua empresa." },
  { icon: BarChart3,   title: "Gestão de Investimentos", desc: "CPC, CPL, ROI e escala monitorados todos os dias." },
];

const RESUMO = [
  "Gestão Completa de Meta Ads", "Facebook e Instagram Ads", "Campanhas para WhatsApp",
  "Estratégia de Marketing", "Planejamento Comercial", "Análise de Mercado",
  "Estudo dos Concorrentes", "Copywriting Profissional", "Desenvolvimento de Criativos",
  "Inteligência Artificial aplicada", "Gestão diária das campanhas", "Otimização constante",
  "Controle dos investimentos", "Relatórios de desempenho", "Geração de Leads Qualificados",
  "Aumento da demanda", "Acompanhamento especializado", "Garantia de 30 dias",
];

// ---------- Planos de investimento ----------
type Plano = {
  name: string;
  price: string;
  suffix: string;
  from: string;
  perMonth: string;
  note: string;
  savings: string;
  badge: string;
  featured: boolean;
  message: string;
};

const PLANOS: Plano[] = [
  {
    name: "Plano Mensal",
    price: "R$ 1500",
    suffix: "/mês",
    from: "",
    perMonth: "renova todo mês, sem fidelidade",
    note: "Comece agora e renove mês a mês. Liberdade total para continuar conforme o resultado aparecer.",
    savings: "no plano de 3 meses o mesmo trabalho sai por R$ 3.000",
    badge: "",
    featured: false,
    message: "Quero contratar o plano mensal do marketing completo!",
  },
  {
    name: "Plano de 3 Meses",
    price: "R$ 3.000",
    suffix: "no total",
    from: "De R$ 4.500",
    perMonth: "equivale a R$ 1.000 por mês",
    note: "Um trabalho de marketing não se finaliza em 1 mês. O marketing precisa de, no mínimo, 3 meses para alavancar seu negócio, baseando-se no algoritmo e no aperfeiçoamento constante.",
    savings: "economia imediata de R$ 1.500",
    badge: "Mais escolhido",
    featured: true,
    message: "Quero contratar o plano de 3 meses do marketing completo!",
  },
  {
    name: "Plano de 6 Meses",
    price: "R$ 5.000",
    suffix: "no total",
    from: "De R$ 9.000",
    perMonth: "equivale a R$ 833 por mês",
    note: "O menor valor mensal de todos: mais tempo de otimização, mais aprendizado do algoritmo e resultados mais previsíveis.",
    savings: "economia imediata de R$ 4.000",
    badge: "Melhor custo",
    featured: false,
    message: "Quero contratar o plano de 6 meses do marketing completo!",
  },
];

// ---------- Page ----------
export default function MktCompleto() {
  const { scrollYProgress } = useScroll();
  const progressX = useSpring(scrollYProgress, { stiffness: 100, damping: 20 });

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProg } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY     = useTransform(heroProg, [0, 1], [0, 200]);
  const heroScale = useTransform(heroProg, [0, 1], [1, 1.15]);
  const heroOp    = useTransform(heroProg, [0, 0.8], [1, 0]);

  const [hint, setHint] = useState(true);
  useEffect(() => { const t = setTimeout(() => setHint(false), 4000); return () => clearTimeout(t); }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        .serif { font-family: 'Instrument Serif', serif; font-weight: 400; }
        .yellow-glow { text-shadow: 0 0 40px rgba(255,212,0,0.5); }
        @keyframes shimmerY { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        .shimmer-y::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.35) 50%,transparent 70%);animation:shimmerY 2.6s infinite;}
      `}</style>

      <CursorSpotlight />
      <GridBG />
      <Orbs />

      {/* Scroll progress */}
      <motion.div className="fixed inset-x-0 top-0 z-[80] h-[3px] origin-left" style={{ scaleX: progressX, background: ACCENT }} />

      {/* Cursor hint */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-[75] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70 backdrop-blur-md"
          >
            <MousePointer2 className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Mova o mouse e role para explorar
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============== HERO ============== */}
      <section ref={heroRef} className="relative z-10 min-h-screen overflow-hidden">
        <motion.div style={{ y: heroY, scale: heroScale, opacity: heroOp }} className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-6 py-24 text-center">
          <Reveal>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.3em] text-white/70 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Proposta Comercial
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="serif text-6xl leading-[0.95] tracking-tight md:text-8xl lg:text-[8.5rem]">
              <span className="block text-white">Marketing</span>
              <span className="block italic" style={{ color: ACCENT }}>Digital Completo</span>
              <span className="block text-white/40 text-4xl md:text-5xl lg:text-6xl mt-4">+ Meta Ads + I.A.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.25}>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
              Transformamos sua operação de marketing em uma máquina inteligente de geração de clientes.
              Estratégia, criativos, IA e campanhas otimizadas todos os dias.
            </p>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
              <a href="#investimento" className="shimmer-y relative overflow-hidden rounded-full bg-[--accent] px-8 py-4 text-sm font-semibold uppercase tracking-wider text-black transition-transform hover:scale-105"
                 style={{ ["--accent" as never]: ACCENT, boxShadow: `0 10px 40px ${ACCENT}55` }}>
                Ver planos <ArrowRight className="ml-2 inline h-4 w-4" />
              </a>
              <a href="#incluso" className="rounded-full border border-white/20 px-8 py-4 text-sm font-semibold uppercase tracking-wider text-white/80 backdrop-blur transition hover:border-white/60 hover:text-white">
                O que está incluso
              </a>
            </div>
          </Reveal>

          {/* Floating 3D tiles */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <motion.div animate={{ y: [0, -20, 0], rotate: [0, 6, 0] }} transition={{ duration: 7, repeat: Infinity }} className="absolute left-[8%] top-[18%] hidden md:block">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"><Rocket className="h-6 w-6" style={{ color: ACCENT }} /></div>
            </motion.div>
            <motion.div animate={{ y: [0, 25, 0], rotate: [0, -8, 0] }} transition={{ duration: 9, repeat: Infinity }} className="absolute right-[10%] top-[22%] hidden md:block">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"><Brain className="h-6 w-6" style={{ color: ACCENT }} /></div>
            </motion.div>
            <motion.div animate={{ y: [0, -18, 0], rotate: [0, 10, 0] }} transition={{ duration: 8, repeat: Infinity }} className="absolute left-[12%] bottom-[18%] hidden md:block">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"><TrendingUp className="h-6 w-6" style={{ color: ACCENT }} /></div>
            </motion.div>
            <motion.div animate={{ y: [0, 22, 0], rotate: [0, -6, 0] }} transition={{ duration: 10, repeat: Infinity }} className="absolute right-[14%] bottom-[22%] hidden md:block">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"><MessageCircle className="h-6 w-6" style={{ color: ACCENT }} /></div>
            </motion.div>
          </div>

          <motion.div className="absolute bottom-10 left-1/2 -translate-x-1/2" animate={{ y: [0, 10, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
            <div className="h-10 w-6 rounded-full border-2 border-white/30 p-1"><div className="h-2 w-1 rounded-full bg-white/60 mx-auto" /></div>
          </motion.div>
        </motion.div>
      </section>

      {/* Marquee */}
      <Marquee items={["+8 anos de experiência", "+1.800 empresas atendidas", "Meta Business Partner Mindset", "ROI focado", "Garantia de 30 dias"]} />

      {/* ============== MISSÃO ============== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-32">
        <Reveal>
          <p className="serif text-3xl leading-snug text-white/85 md:text-5xl lg:text-6xl">
            Hoje, estar presente nas redes não basta. <span className="italic" style={{ color: ACCENT }}>O diferencial</span> está em transformar interessados em <span className="italic">clientes reais</span>.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-10 max-w-3xl text-lg text-white/60">
            Nossa missão é estruturar toda a operação de marketing da sua empresa, usando estratégias de
            alta performance, campanhas inteligentes na Meta e Inteligência Artificial para gerar mais
            demanda, mais contatos e mais vendas.
          </p>
        </Reveal>
      </section>

      {/* ============== PILARES (3D Tilt) ============== */}
      <section id="incluso" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <Reveal>
          <div className="mb-16 flex items-end justify-between gap-6 flex-wrap">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-white/50">O que está incluso</span>
              <h2 className="serif mt-3 text-5xl md:text-7xl">Os <span style={{ color: ACCENT }} className="italic">pilares</span> da operação</h2>
            </div>
            <p className="max-w-md text-white/60">Cada frente trabalha conectada para escalar resultados de forma previsível e mensurável.</p>
          </div>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PILARES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <TiltCard className="group h-full">
                <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-8 backdrop-blur-sm transition-colors hover:border-[color:var(--ac)]"
                     style={{ ["--ac" as never]: ACCENT }}>
                  <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/40" style={{ transform: "translateZ(40px)" }}>
                    <p.icon className="h-7 w-7" style={{ color: ACCENT }} />
                  </div>
                  <h3 className="serif text-3xl text-white" style={{ transform: "translateZ(30px)" }}>{p.title}</h3>
                  <p className="mt-3 text-white/65" style={{ transform: "translateZ(20px)" }}>{p.desc}</p>
                  <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-100"
                       style={{ background: `radial-gradient(circle, ${ACCENT}, transparent 70%)` }} />
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============== META ADS ============== */}
      <section className="relative z-10 overflow-hidden py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-16 lg:grid-cols-[1fr,1.2fr]">
            <Reveal>
              <div className="sticky top-24">
                <span className="text-xs uppercase tracking-[0.3em] text-white/50">Tráfego pago</span>
                <h2 className="serif mt-4 text-6xl leading-[0.95] md:text-7xl">
                  Gestão completa <span className="italic block" style={{ color: ACCENT }}>de Meta Ads</span>
                </h2>
                <p className="mt-6 text-lg text-white/60">
                  Operação 360º no ecossistema da Meta — Facebook, Instagram, Messenger e WhatsApp —
                  para gerar o maior número de clientes qualificados pelo menor custo possível.
                </p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {["Facebook Ads", "Instagram Ads", "Messenger", "WhatsApp"].map(t => (
                    <span key={t} className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/80">{t}</span>
                  ))}
                </div>
              </div>
            </Reveal>

            <div className="grid gap-3 sm:grid-cols-2">
              {META_BULLETS.map((b, i) => (
                <Reveal key={b} delay={i * 0.02} y={20}>
                  <motion.div
                    whileHover={{ x: 6, borderColor: ACCENT }}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: ACCENT }} />
                    <span className="text-sm text-white/80">{b}</span>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============== STATS (parallax) ============== */}
      <section className="relative z-10 border-y border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-3">
          {[
            { v: "+8", l: "anos de experiência", i: Award },
            { v: "+1.800", l: "empresas atendidas", i: Users },
            { v: "30 dias", l: "garantia total", i: ShieldCheck },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 0.1}>
              <div className="group relative">
                <s.i className="mb-4 h-8 w-8 text-white/40 transition-colors group-hover:text-[color:var(--ac)]" style={{ ["--ac" as never]: ACCENT }} />
                <div className="serif text-7xl md:text-8xl yellow-glow" style={{ color: ACCENT }}>{s.v}</div>
                <div className="mt-2 text-white/60 uppercase tracking-wider text-sm">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============== IA + COPY + CRIATIVOS (alternado zigzag) ============== */}
      {[
        { icon: PenTool, kicker: "Copywriting", title: "Não basta anunciar. É preciso convencer.",
          body: "Headlines de alto impacto, CTAs, gatilhos mentais, scripts de WhatsApp e argumentos de venda construídos para converter.", side: "left" },
        { icon: ImageIcon, kicker: "Criativos", title: "Materiais profissionais para suas campanhas.",
          body: "Artes para Facebook e Instagram, banners, imagens de alta conversão e edição de vídeo. Cada criativo pensado para capturar atenção.", side: "right" },
        { icon: Brain, kicker: "Inteligência Artificial", title: "Tecnologia trabalhando continuamente.",
          body: "Atendimento inteligente, organização de leads, sugestões comerciais, análise de comportamento e otimização contínua de campanhas.", side: "left" },
        { icon: Zap, kicker: "Geração de Leads", title: "Pessoas realmente interessadas no seu negócio.",
          body: "Campanhas direcionam contatos qualificados diretamente para o WhatsApp da sua empresa — sua equipe foca em quem realmente compra.", side: "right" },
      ].map((b, i) => (
        <section key={b.title} className="relative z-10 mx-auto max-w-7xl px-6 py-24">
          <div className={`grid items-center gap-12 lg:grid-cols-2 ${b.side === "right" ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <Reveal>
              <TiltCard>
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent p-12 backdrop-blur">
                  <b.icon className="h-20 w-20" style={{ color: ACCENT, transform: "translateZ(60px)" }} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,212,0,0.15),transparent_60%)]" />
                </div>
              </TiltCard>
            </Reveal>
            <Reveal delay={0.1}>
              <span className="text-xs uppercase tracking-[0.3em] text-white/50">{b.kicker}</span>
              <h3 className="serif mt-3 text-5xl leading-tight md:text-6xl">{b.title}</h3>
              <p className="mt-6 text-lg text-white/65">{b.body}</p>
            </Reveal>
          </div>
        </section>
      ))}

      {/* ============== BONUS ============== */}
      <section className="relative z-10 py-32">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <TiltCard>
              <div className="relative overflow-hidden rounded-[2.5rem] border border-[color:var(--ac)]/40 bg-gradient-to-br from-[color:var(--ac)]/15 via-black to-black p-12 md:p-20"
                   style={{ ["--ac" as never]: ACCENT, boxShadow: `0 30px 80px ${ACCENT}22` }}>
                <Gift className="mb-6 h-12 w-12" style={{ color: ACCENT }} />
                <span className="text-xs uppercase tracking-[0.3em] text-white/60">Bônus exclusivo</span>
                <h3 className="serif mt-4 text-5xl md:text-7xl">WhatsApp <span className="italic" style={{ color: ACCENT }}>API Oficial Meta</span></h3>
                <p className="mt-6 max-w-2xl text-lg text-white/70">Plataforma profissional inclusa sem custo adicional para atender com eficiência todos os leads gerados pelas campanhas.</p>
                <div className="mt-10 grid gap-3 sm:grid-cols-2">
                  {["Atendimento organizado","Múltiplos atendentes","Mensagens automáticas","Etiquetas e categorização","Histórico completo","Distribuição de atendimentos","Atendimento profissional em escala","Mais eficiência comercial"].map(t => (
                    <div key={t} className="flex items-center gap-2 text-white/85"><CheckCircle2 className="h-4 w-4" style={{ color: ACCENT }} /> {t}</div>
                  ))}
                </div>
              </div>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* ============== INVESTIMENTO ============== */}
      <section id="investimento" className="relative z-10 overflow-hidden py-32">
        <motion.div
          aria-hidden
          className="absolute inset-0 -z-10"
          animate={{ background: [
            `radial-gradient(circle at 20% 30%, ${ACCENT}22, transparent 50%)`,
            `radial-gradient(circle at 80% 60%, ${ACCENT}22, transparent 50%)`,
            `radial-gradient(circle at 20% 30%, ${ACCENT}22, transparent 50%)`,
          ]}}
          transition={{ duration: 12, repeat: Infinity }}
        />
        <div className="mx-auto max-w-6xl px-6 text-center">
          <Reveal>
            <span className="text-xs uppercase tracking-[0.3em] text-white/60">Investimento</span>
            <h2 className="serif mt-4 text-5xl md:text-7xl">Escolha o <span className="italic" style={{ color: ACCENT }}>seu plano</span></h2>
            <p className="mx-auto mt-6 max-w-2xl text-white/60">
              Quanto maior o período, menor o valor mensal e mais tempo para a estratégia amadurecer.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-16 grid gap-6 text-left md:grid-cols-3">
              {PLANOS.map((p, i) => (
                <Reveal key={p.name} delay={i * 0.08} y={24} className="h-full">
                  <TiltCard className="h-full">
                    <div className={`relative flex h-full flex-col overflow-hidden rounded-[2rem] border bg-black/60 p-8 backdrop-blur-xl transition-colors md:p-10 ${p.featured ? "border-[color:var(--ac)]" : "border-white/15 hover:border-white/40"}`}
                         style={{ ["--ac" as never]: ACCENT, boxShadow: p.featured ? `0 30px 80px ${ACCENT}33` : undefined }}>
                      {p.badge && (
                        <div className="absolute inset-x-0 top-0 py-2 text-center text-[11px] font-bold uppercase tracking-[0.25em] text-black"
                             style={{ background: ACCENT }}>{p.badge}</div>
                      )}
                      <div className={`text-xs uppercase tracking-[0.3em] text-white/50 ${p.badge ? "mt-6" : ""}`}>{p.name}</div>
                      {p.from && <div className="mt-6 text-lg text-white/45 line-through">{p.from}</div>}
                      <div className="serif yellow-glow mt-2 flex items-baseline gap-2 text-6xl leading-none md:text-7xl" style={{ color: ACCENT }}>
                        {p.price}
                        <span className="text-lg font-normal text-white/60">{p.suffix}</span>
                      </div>
                      <div className="mt-3 text-sm italic text-white/60">{p.perMonth}</div>
                      <p className="mt-6 text-sm leading-relaxed text-white/70">{p.note}</p>
                      <div className="my-6 h-px bg-white/10" />
                      <div className="text-sm text-white/60">{p.savings}</div>
                      <a href={`https://wa.me/5551992835863?text=${encodeURIComponent(p.message)}`}
                         target="_blank" rel="noopener noreferrer"
                         className={`shimmer-y relative mt-auto inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-8 pt-4 pb-4 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-105 ${p.featured ? "bg-cta text-cta-foreground" : "border border-white/20 bg-white/5 text-white hover:border-white/60"}`}
                         style={p.featured ? { boxShadow: "0 20px 60px hsl(var(--cta) / 0.45)" } : undefined}>
                        Quero este plano <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.25}>
            <div className="mt-12 flex flex-col items-center gap-2 text-white/80">
              <DollarSign className="h-6 w-6" style={{ color: ACCENT }} />
              <p>+ investimento em anúncios na Meta</p>
              <p className="text-sm text-white/55">a partir de R$ 20,00 por dia</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============== RESUMO ============== */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-32">
        <Reveal>
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">Resumo da contratação</span>
          <h2 className="serif mt-4 text-5xl md:text-7xl">Tudo que <span className="italic" style={{ color: ACCENT }}>você recebe</span></h2>
        </Reveal>
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RESUMO.map((r, i) => (
            <Reveal key={r} delay={i * 0.02} y={20}>
              <motion.div whileHover={{ scale: 1.02, borderColor: ACCENT }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${ACCENT}22` }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: ACCENT }} />
                </div>
                <span className="text-white/85">{r}</span>
              </motion.div>
            </Reveal>
          ))}
          <Reveal delay={0.1}>
            <div className="flex items-center gap-3 rounded-2xl border p-4" style={{ borderColor: ACCENT, background: `${ACCENT}11` }}>
              <Gift className="h-5 w-5" style={{ color: ACCENT }} />
              <span className="text-white font-semibold">BÔNUS: WhatsApp API Oficial Meta</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="relative z-10 overflow-hidden py-40">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <Reveal>
            <h2 className="serif text-6xl leading-[0.95] md:text-8xl">
              Transforme sua empresa em uma <span className="italic" style={{ color: ACCENT }}>máquina de clientes</span>.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-white/65">
              Estratégia completa, inteligente e focada em resultados. Comece com o plano ideal e
              a garantia de 30 dias.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <a href="#investimento" className="shimmer-y relative mt-12 inline-flex items-center gap-2 overflow-hidden rounded-full px-12 py-5 text-sm font-bold uppercase tracking-wider text-black"
               style={{ background: ACCENT, boxShadow: `0 20px 60px ${ACCENT}66` }}>
              Quero começar agora <Rocket className="h-4 w-4" />
            </a>
          </Reveal>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-10 text-center text-xs uppercase tracking-[0.3em] text-white/40">
        © Marketing Digital Completo · Garantia de 30 dias
      </footer>
    </div>
  );
}
