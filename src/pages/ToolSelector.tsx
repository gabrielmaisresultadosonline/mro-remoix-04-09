import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Camera, Megaphone, ArrowRight, ArrowUpRight, ShieldCheck, LogIn, MessageCircle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
const InstagramIcon = (LucideIcons as any).Instagram || Camera;

import { trackPageView, trackViewContent } from '@/lib/facebookTracking';
import WhatsAppFloatingWidget from '@/components/WhatsAppFloatingWidget';

/**
 * Paleta institucional — preto / cinza / branco / amarelo
 * black #0A0A0A · surface #171717 · gray #404040 · white #FAFAFA
 * yellow #EAB308 · yellowHot #FACC15
 */
const C = {
  black: '#0A0A0A',
  surface: '#171717',
  gray: '#404040',
  grayLight: '#A3A3A3',
  white: '#FAFAFA',
  yellow: '#EAB308',
  yellowHot: '#FACC15',
} as const;

const LOGO_URL = 'https://maisresultadosonline.com.br/assets/logo-mro-Cqe3By7y.png';

interface ToolOption {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  badge: string;
  salesPath: string;
  index: string;
  highlight?: boolean;
}

const heading = { fontFamily: "'Archivo Black', 'Inter', sans-serif" } as const;

const ToolSelector = () => {
  const navigate = useNavigate();

  useEffect(() => {
    trackPageView('Tool Selector - Homepage');
    // Fontes do novo layout
    if (!document.getElementById('mro-home-fonts')) {
      const link = document.createElement('link');
      link.id = 'mro-home-fonts';
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  const tools: ToolOption[] = [
    {
      id: 'instagram',
      name: 'Não gaste com anúncios',
      subtitle: 'Ferramenta para Instagram',
      description:
        'Envio em massa de mensagens, engajamento, clientes e vendas. Automatize sua presença e escale seus resultados.',
      icon: InstagramIcon,
      badge: 'MRO I.A',
      salesPath: '/ferramentamropromo',
      index: '01',
      highlight: true,
    },
    {
      id: 'zapmro',
      name: 'ZAPMRO API Oficial WhatsApp',
      subtitle: 'Automatize seu WhatsApp',
      description:
        'API oficial do WhatsApp para envio em massa, automações e atendimento. Teste grátis por 2 dias e veja os resultados.',
      icon: MessageCircle,
      badge: 'FREE',
      salesPath: 'https://zapmro.com.br',
      index: '02',
    },
    {
      id: 'mktcompleto',
      name: 'Precisa de marketing completo?',
      subtitle: 'Deixe que cuidamos de tudo',
      description: 'Gestão, tráfego, criação e automação em um só lugar. Solução pronta para escalar seu negócio.',
      icon: Megaphone,
      badge: 'HOT',
      salesPath: '/mktcompleto',
      index: '03',
    },
  ];

  const handleSalesClick = (path: string, toolName: string) => {
    trackViewContent(`Sales Page: ${toolName}`, 'Navigation');
    if (path.startsWith('http')) window.open(path, '_blank');
    else navigate(path);
  };

  const handleMembersEnter = () => {
    trackViewContent('Members Area: dashboard', 'Navigation');
    // Cliente identificado vai direto para o hub central
    navigate('/dashboard');
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-x-hidden"
      style={{ background: C.black, color: C.white, fontFamily: "'Hind', 'Inter', system-ui, sans-serif" }}
    >
      {/* Textura suave */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(${C.surface} 1px, transparent 1px), linear-gradient(90deg, ${C.surface} 1px, transparent 1px)`,
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse at 50% 0%, black 10%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 10%, transparent 70%)',
        }}
      />
      {/* Brilho amarelo de fundo */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[42rem] h-[42rem] rounded-full blur-[140px] z-0"
        style={{ background: C.yellow, opacity: 0.08 }}
      />

      {/* NAVBAR */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{ background: 'rgba(10,10,10,0.85)', borderColor: C.surface }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 md:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={LOGO_URL}
              alt="MRO — Mais Resultados Online"
              className="h-9 md:h-11 w-auto flex-shrink-0"
              loading="eager"
            />
            <div className="min-w-0 leading-tight hidden sm:block">
              <div className="text-[9px] md:text-[10px] uppercase tracking-[0.28em] font-bold" style={{ color: C.yellow }}>
                Agência
              </div>
              <div className="text-sm md:text-base truncate" style={{ ...heading, color: C.white }}>
                Mais Resultados Online
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <a
              href="#ferramentas"
              className="hidden md:inline-flex text-[11px] uppercase tracking-[0.2em] font-bold px-3 py-2 rounded-lg transition-colors"
              style={{ color: C.grayLight }}
            >
              Ferramentas
            </a>
            <button
              onClick={handleMembersEnter}
              className="inline-flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3 rounded-xl text-[10px] md:text-xs uppercase tracking-[0.18em] font-black transition-transform hover:-translate-y-0.5 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${C.yellowHot}, ${C.yellow})`,
                color: C.black,
                border: `1px solid ${C.yellow}`,
                boxShadow: `0 12px 28px -14px ${C.yellow}`,
              }}
            >
              <LogIn className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Área de Membros</span>
              <span className="sm:hidden">Membros</span>
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 md:pt-16 pb-10 md:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          <div className="lg:col-span-7">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
              style={{ background: C.surface, border: `1px solid ${C.gray}`, boxShadow: `0 8px 24px -18px ${C.black}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.yellow }} />
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: C.yellow }}>
                Inteligência que vende
              </span>
            </div>

            <h1
              className="text-[2.1rem] sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.03] uppercase tracking-tight"
              style={{ ...heading, color: C.white }}
            >
              Soluções{' '}
              <span className="relative inline-block">
                <span className="relative z-10" style={{ color: C.yellowHot }}>
                  inteligentes
                </span>
                <span
                  aria-hidden
                  className="absolute left-0 right-0 bottom-[0.08em] h-[0.32em] -z-0"
                  style={{ background: C.yellow, opacity: 0.35 }}
                />
              </span>{' '}
              para o seu negócio
            </h1>

            <p className="mt-5 md:mt-7 text-base md:text-xl leading-relaxed max-w-2xl" style={{ color: C.grayLight }}>
              Tecnologia de ponta e automação com I.A para elevar o seu negócio ao próximo nível. Escolha a ferramenta
              ideal para a sua jornada.
            </p>

            <div className="mt-7 md:mt-9 flex flex-col sm:flex-row gap-3">
              <a
                href="#ferramentas"
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs uppercase tracking-[0.2em] font-black transition-transform hover:-translate-y-0.5"
                style={{
                  background: `linear-gradient(135deg, ${C.yellowHot}, ${C.yellow})`,
                  color: C.black,
                  border: `1px solid ${C.yellow}`,
                  boxShadow: `0 16px 34px -18px ${C.yellow}`,
                }}
              >
                Ver ferramentas <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={handleMembersEnter}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-xs uppercase tracking-[0.2em] font-black transition-transform hover:-translate-y-0.5"
                style={{ background: C.surface, color: C.white, border: `1px solid ${C.gray}` }}
              >
                <Users className="w-4 h-4" /> Você já é cliente?
              </button>
            </div>
          </div>

          {/* Métricas */}
          <div className="lg:col-span-5">
            <div
              className="rounded-2xl p-5 md:p-7 grid grid-cols-3 gap-3 md:gap-5"
              style={{ background: C.surface, border: `1px solid ${C.gray}`, boxShadow: `0 26px 60px -32px ${C.black}` }}
            >
              {[
                { n: '+1.8k', l: 'Empresas' },
                { n: '24/7', l: 'Suporte' },
                { n: '100%', l: 'Automático' },
              ].map((m) => (
                <div key={m.l} className="pl-3" style={{ borderLeft: `3px solid ${C.yellow}` }}>
                  <div className="text-xl sm:text-2xl md:text-3xl" style={{ ...heading, color: C.white }}>
                    {m.n}
                  </div>
                  <div className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: C.grayLight }}>
                    {m.l}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-[11px]" style={{ color: C.grayLight }}>
              <ShieldCheck className="w-4 h-4" style={{ color: C.yellow }} />
              Ferramentas próprias, suporte humano e resultados acompanhados.
            </div>
          </div>
        </div>
      </section>

      {/* FERRAMENTAS */}
      <section
        id="ferramentas"
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-14 md:pb-20 scroll-mt-24"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7 md:mb-10">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold mb-2" style={{ color: C.yellow }}>
              Nossas soluções
            </div>
            <h2 className="text-2xl md:text-4xl uppercase" style={{ ...heading, color: C.white }}>
              Ferramentas & Serviços
            </h2>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold" style={{ color: C.grayLight }}>
            {tools.length} soluções disponíveis
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const featured = !!tool.highlight;
            return (
              <button
                key={tool.id}
                onClick={() => handleSalesClick(tool.salesPath, tool.name)}
                className="group relative text-left rounded-2xl p-5 md:p-7 flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: featured ? `linear-gradient(150deg, ${C.surface}, ${C.black})` : C.surface,
                  border: `1px solid ${featured ? C.yellow : C.gray}`,
                  boxShadow: featured ? `0 30px 60px -30px ${C.yellow}` : `0 20px 44px -30px ${C.black}`,
                }}
              >
                <span
                  aria-hidden
                  className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${C.yellow}, transparent)` }}
                />

                <div className="flex items-start justify-between gap-3 mb-5">
                  <div
                    className="w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                    style={{
                      background: `linear-gradient(135deg, ${C.yellowHot}, ${C.yellow})`,
                      color: C.black,
                      border: `1px solid ${C.yellow}`,
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-[0.18em] font-black flex-shrink-0"
                    style={{
                      background: featured ? C.yellowHot : C.black,
                      color: featured ? C.black : C.yellow,
                      border: `1px solid ${featured ? C.yellow : C.gray}`,
                    }}
                  >
                    {tool.badge}
                  </span>
                </div>

                <div
                  className="text-[10px] uppercase tracking-[0.24em] font-bold mb-2 flex items-center gap-2"
                  style={{ color: C.yellow }}
                >
                  <span className="opacity-70">{tool.index}</span>
                  <span className="truncate">{tool.subtitle}</span>
                </div>

                <h3 className="text-lg md:text-xl uppercase leading-tight mb-3" style={{ ...heading, color: C.white }}>
                  {tool.name}
                </h3>

                <p className="text-sm md:text-[15px] leading-relaxed mb-6" style={{ color: C.grayLight }}>
                  {tool.description}
                </p>

                <div className="mt-auto flex items-center gap-3">
                  <span className="h-[2px] w-8 transition-all group-hover:w-14" style={{ background: C.yellow }} />
                  <span
                    className="text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5"
                    style={{ color: featured ? C.yellowHot : C.white }}
                  >
                    {featured ? 'Explorar agora' : 'Saiba mais'}
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ÁREA DE MEMBROS — faixa destacada */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-14 md:pb-20">
        <div
          className="relative rounded-3xl overflow-hidden p-6 md:p-12"
          style={{ background: `linear-gradient(140deg, ${C.surface} 0%, ${C.black} 100%)`, border: `1px solid ${C.yellow}` }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[90px]"
            style={{ background: C.yellow, opacity: 0.18 }}
          />
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-7 md:gap-10 items-center">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold mb-3" style={{ color: C.yellowHot }}>
                Já é cliente?
              </div>
              <h2 className="text-2xl md:text-4xl uppercase leading-tight mb-4" style={{ ...heading, color: C.white }}>
                Área de Membros
              </h2>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: C.grayLight }}>
                Acesse suas ferramentas, cursos e bônus liberados em um único painel. Login rápido e seguro para
                clientes MRO.
              </p>
            </div>
            <div className="md:justify-self-end w-full md:w-auto">
              <button
                onClick={handleMembersEnter}
                className="group w-full md:w-auto inline-flex flex-col items-center gap-1 px-7 py-5 rounded-2xl transition-transform hover:-translate-y-0.5 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${C.yellowHot}, ${C.yellow})`,
                  color: C.black,
                  border: `1px solid ${C.yellow}`,
                  boxShadow: `0 20px 46px -22px ${C.yellow}`,
                }}
              >
                <span className="flex items-center gap-2 text-sm uppercase tracking-[0.18em]" style={heading}>
                  <Users className="w-5 h-5" /> Já sou cliente
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">Acessar meu painel →</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="relative z-10 py-8 px-4 sm:px-6 lg:px-10 text-center space-y-2"
        style={{ borderTop: `1px solid ${C.surface}` }}
      >
        <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.grayLight }}>
          Mais Resultados Online • Gabriel Fernandes da Silva • CNPJ 54.840.738/0001-96
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: C.gray }}>
          © 2024 • Todos os direitos reservados
        </p>
      </footer>

      {/* Members modal */}
      {showMembersModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowMembersModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl p-5 md:p-6 animate-scale-in"
            style={{ background: C.surface, border: `1px solid ${C.yellow}`, boxShadow: `0 40px 80px -30px ${C.black}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              aria-hidden
              className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
              style={{ background: `linear-gradient(90deg, transparent, ${C.yellow}, transparent)` }}
            />
            <div className="flex items-start justify-between mb-5 gap-3">
              <div>
                <h3 className="text-lg md:text-xl uppercase" style={{ ...heading, color: C.white }}>
                  Área de Membros
                </h3>
                <p className="text-sm mt-1" style={{ color: C.grayLight }}>
                  Acesse o seu painel de cliente
                </p>
              </div>
              <button
                onClick={() => setShowMembersModal(false)}
                aria-label="Fechar"
                className="p-2 rounded-lg transition-colors"
                style={{ background: C.black, border: `1px solid ${C.gray}`, color: C.white }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleMembersSelect}
                className="group w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:-translate-y-0.5"
                style={{ background: C.black, border: `1px solid ${C.gray}` }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${C.yellowHot}, ${C.yellow})`, color: C.black }}
                >
                  <InstagramIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black uppercase tracking-wide" style={{ color: C.white }}>
                    MRO Instagram
                  </div>
                  <div className="text-xs" style={{ color: C.grayLight }}>
                    Ferramenta para Instagram
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-1" style={{ color: C.yellow }} />
              </button>
            </div>
          </div>
        </div>
      )}

      <WhatsAppFloatingWidget />
    </div>
  );
};

export default ToolSelector;
