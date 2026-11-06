import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Flame, Shield, Tag, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MRO_BLACK_PROMO,
  type MroBlackPromoPlan,
} from '../../../supabase/functions/_shared/mro-black-promo';

const brl = (n: number) => `R$${n.toLocaleString('pt-BR')}`;

/** Fim da Black November: 30/11 às 23:59:59 (horário de Brasília). */
function blackNovemberEnd(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), 11, 1, 2, 59, 59)); // 01/12 02:59:59 UTC = 30/11 23:59:59 -03
}

function useCountdown() {
  const end = useMemo(() => blackNovemberEnd(), []);
  const [left, setLeft] = useState(() => end.getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(end.getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [end]);
  if (left <= 0) return null;
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { d, h, m, s };
}

const pad = (n: number) => String(n).padStart(2, '0');

const TICKER = [
  'BLACK NOVEMBER MRO',
  'DESCONTO BLACK NOVEMBER',
  `ANUAL ${brl(MRO_BLACK_PROMO.annual.price)}`,
  `VITALÍCIO ${brl(MRO_BLACK_PROMO.lifetime.price)}`,
  'O MAIOR DESCONTO DO ANO',
];

/** Faixa amarela fixa no topo com letreiro correndo e contagem regressiva. */
export function BlackNovemberTopBar() {
  const cd = useCountdown();
  const items = [...TICKER, ...TICKER];
  return (
    <div className="sticky top-0 z-[60] bg-primary text-primary-foreground border-b border-primary">
      <div className="flex items-center">
        <div className="bn-ticker flex-1 overflow-hidden py-2">
          <div className="bn-ticker-track flex w-max gap-8 font-black text-xs sm:text-sm tracking-wide">
            {items.map((txt, i) => (
              <span key={i} className="inline-flex items-center gap-2 whitespace-nowrap" aria-hidden={i >= TICKER.length}>
                <Flame className="h-4 w-4" /> {txt}
              </span>
            ))}
          </div>
        </div>
        {cd && (
          <div className="shrink-0 bg-background text-primary px-3 sm:px-4 py-2 font-mono text-xs sm:text-sm font-bold tabular-nums">
            <span className="hidden sm:inline text-foreground font-sans mr-2">TERMINA EM</span>
            {cd.d > 0 ? `${cd.d}d ` : ''}{pad(cd.h)}:{pad(cd.m)}:{pad(cd.s)}
          </div>
        )}
      </div>
    </div>
  );
}

/** Brilhos dourados subindo pela página (decorativo). */
export function BlackNovemberSparkles() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        left: (i * 37) % 100,
        size: 2 + ((i * 7) % 4),
        delay: (i * 1.3) % 12,
        duration: 9 + ((i * 5) % 8),
      })),
    [],
  );
  return (
    <div className="bn-sparkles pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="bn-spark"
          style={{
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Selo grande "BLACK NOVEMBER" no topo da página. */
export function BlackNovemberHero() {
  return (
    <div className="mb-8 sm:mb-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-4 py-1.5 text-primary text-[11px] sm:text-xs font-black tracking-[0.25em] uppercase bn-pulse">
        <Zap className="h-3.5 w-3.5" /> Desconto Black November
      </div>
      <h2 className="mro-sales-title bn-shimmer-text mt-4 text-5xl sm:text-7xl md:text-8xl uppercase leading-none">
        Black November
      </h2>
      <p className="mt-3 text-muted-foreground text-base sm:text-xl">
        O maior desconto do ano na Ferramenta MRO —{' '}
        <span className="text-foreground font-bold">
          anual por {brl(MRO_BLACK_PROMO.annual.price)} e vitalício por {brl(MRO_BLACK_PROMO.lifetime.price)}
        </span>
      </p>
    </div>
  );
}

/** Fitas cruzadas estilo Black Friday no meio da página. */
export function BlackNovemberTapes() {
  const words = Array.from({ length: 10 }, () => 'BLACK NOVEMBER · DESCONTO BLACK ·');
  return (
    <div className="relative h-36 sm:h-44 overflow-hidden my-2" aria-hidden>
      <div className="bn-tape absolute left-[-10%] right-[-10%] top-1/2 -translate-y-1/2 -rotate-3">
        <div className="bn-tape-track flex w-max gap-6 py-2 sm:py-3">
          {[...words, ...words].map((w, i) => <span key={i} className="whitespace-nowrap">{w}</span>)}
        </div>
      </div>
      <div className="bn-tape bn-tape-dark absolute left-[-10%] right-[-10%] top-1/2 -translate-y-1/2 rotate-3">
        <div className="bn-tape-track bn-tape-reverse flex w-max gap-6 py-2 sm:py-3">
          {[...words, ...words].map((w, i) => <span key={i} className="whitespace-nowrap">{w}</span>)}
        </div>
      </div>
    </div>
  );
}

const PLAN_INFO: Record<MroBlackPromoPlan, { title: string; tag: string; period: string; features: string[] }> = {
  annual: {
    title: 'Anual Black',
    tag: 'BLACK NOVEMBER',
    period: 'Acesso por 1 ano',
    features: [
      `${MRO_BLACK_PROMO.annual.accounts} contas do Instagram simultâneas fixas`,
      '5 testes todo mês para usar em clientes/outras contas',
      'Ferramenta MRO completa',
      'Área de membros por 1 ano',
      'Grupo VIP no WhatsApp',
      'Suporte VIP',
    ],
  },
  lifetime: {
    title: 'Vitalício Black',
    tag: '⭐ VITALÍCIO BLACK',
    period: 'Acesso vitalício — sem renovação',
    features: [
      `${MRO_BLACK_PROMO.lifetime.accounts} contas do Instagram simultâneas fixas`,
      '5 testes todo mês para usar em clientes/outras contas',
      'Ferramenta MRO completa',
      'Área de membros vitalícia',
      'Grupo VIP no WhatsApp',
      'Suporte VIP',
    ],
  },
};

export interface BlackPlanSelection {
  type: 'annual' | 'lifetime';
  amount: number;
  label: string;
  installments: string;
  oneTime: string;
}

export function blackPlanSelection(plan: MroBlackPromoPlan): BlackPlanSelection {
  const o = MRO_BLACK_PROMO[plan];
  return {
    type: plan,
    amount: o.price,
    label: PLAN_INFO[plan].title,
    installments: `${o.installments}x de ${brl(o.installment)}`,
    oneTime: `${brl(o.price)} à vista`,
  };
}

/** Cartões de preço da Black November (anual e vitalício). */
export function BlackNovemberPricing({ onSelect }: { onSelect: (plan: BlackPlanSelection) => void }) {
  return (
    <div className="max-w-6xl mx-auto relative z-10">
      <div className="text-center mb-8 sm:mb-10">
        <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black text-xs tracking-[0.2em] uppercase rounded px-3 py-1 bn-pulse">
          <Tag className="h-3.5 w-3.5" /> Desconto Black November
        </span>
        <h2 className="mro-sales-title text-3xl sm:text-4xl md:text-6xl uppercase mt-4">
          Preços <span className="bn-shimmer-text">Black</span>
        </h2>
        <p className="text-muted-foreground mt-3 text-base sm:text-lg">Valores exclusivos da Black November. Os 5 testes mensais continuam iguais.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        {(Object.keys(MRO_BLACK_PROMO) as MroBlackPromoPlan[]).map((plan) => {
          const o = MRO_BLACK_PROMO[plan];
          const info = PLAN_INFO[plan];
          const off = o.from - o.price;
          return (
            <div key={plan} className="bn-glow-card rounded-2xl sm:rounded-3xl">
              <div className="bn-glow-inner rounded-2xl sm:rounded-3xl p-5 sm:p-8 flex flex-col h-full">
                <div className="flex items-center justify-between gap-2 mb-5">
                  <span className="text-primary font-black text-xs sm:text-sm tracking-widest">{info.tag}</span>
                  <span className="bn-off-badge bg-primary text-primary-foreground font-black text-xs sm:text-sm rounded-full px-3 py-1">
                    {brl(off)} OFF
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-center">{info.title}</h3>
                <div className="text-center mt-4 mb-6 sm:mb-8">
                  <p className="text-muted-foreground text-lg">
                    de <span className="line-through">{brl(o.from)}</span> por
                  </p>
                  <div className="text-primary">
                    <span className="text-lg sm:text-2xl font-medium">{o.installments}x de</span>
                    <span className="text-6xl sm:text-7xl font-black ml-2">{brl(o.installment)}</span>
                  </div>
                  <p className="text-muted-foreground text-lg sm:text-xl">
                    ou <span className="text-foreground font-bold">{brl(o.price)} à vista</span>
                  </p>
                  <p className="text-muted-foreground text-xs sm:text-sm mt-1">{info.period}</p>
                </div>

                <div className="space-y-3 mb-6 sm:mb-8 flex-1">
                  {info.features.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground text-sm sm:text-base">{f}</span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => onSelect(blackPlanSelection(plan))}
                  className="bg-primary w-full font-black text-base sm:text-xl py-5 sm:py-7 rounded-xl bn-cta"
                >
                  {plan === 'annual' ? 'QUERO O ANUAL BLACK' : 'QUERO O VITALÍCIO BLACK'}
                </Button>

                <div className="flex items-center justify-center gap-4 mt-4 text-xs sm:text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> Compra Segura</span>
                  <span className="flex items-center gap-1"><CreditCard className="w-4 h-4" /> PIX ou Cartão</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
