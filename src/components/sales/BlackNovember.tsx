import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Flame, Shield, Tag, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MRO_BLACK_PROMO,
  MRO_BLACK_PROMO_END_MS,
  currentPromoOffer,
  isBlackPromoActive,
  type MroBlackPromoPlan,
} from '../../../supabase/functions/_shared/mro-black-promo';

const brl = (n: number) => `R$${n.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;

/** Fim da Black November: 17/11 às 16:00 (horário de Brasília). */
function blackNovemberEnd() {
  return new Date(MRO_BLACK_PROMO_END_MS);
}

/** true enquanto a Black estiver ativa; vira false sozinho às 16h de 17/11. */
export function useBlackPromoActive() {
  const [active, setActive] = useState(() => isBlackPromoActive());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { if (!isBlackPromoActive()) setActive(false); }, 1000);
    return () => clearInterval(t);
  }, [active]);
  return active;
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

/** Faixa amarela fixa no topo: só "BLACK NOVEMBER" e a contagem regressiva. */
export function BlackNovemberTopBar() {
  const cd = useCountdown();
  return (
    <div className="sticky top-0 z-[60] bg-primary text-primary-foreground border-b border-primary">
      <div className="flex items-center justify-center gap-3 px-3 py-2">
        <span className="inline-flex items-center gap-2 font-black text-sm sm:text-base tracking-[0.3em] uppercase">
          <Flame className="h-4 w-4" /> Black November
        </span>
        {cd && (
          <span className="shrink-0 bg-background text-primary px-2 sm:px-3 py-1 rounded font-mono text-xs sm:text-sm font-bold tabular-nums">
            <span className="hidden sm:inline text-foreground font-sans mr-2">TERMINA EM</span>
            {cd.d > 0 ? `${cd.d}d ` : ''}{pad(cd.h)}:{pad(cd.m)}:{pad(cd.s)}
          </span>
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

/** Selo "Desconto Black November" — fica no meio da página, não no topo. */
export function BlackNovemberBadge() {
  return (
    <div className="flex justify-center my-6 sm:my-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-4 py-1.5 text-primary text-[11px] sm:text-xs font-black tracking-[0.25em] uppercase bn-pulse">
        <Zap className="h-3.5 w-3.5" /> Desconto Black November
      </div>
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

const planInfo = (black: boolean): Record<MroBlackPromoPlan, { title: string; tag: string; period: string; features: string[] }> => ({
  annual: {
    title: black ? 'Anual Black' : 'Plano Anual',
    tag: black ? 'BLACK NOVEMBER' : 'PLANO ANUAL',
    period: 'Acesso por 1 ano',
    features: [
      `${currentPromoOffer('annual', black ? 0 : Infinity).accounts} contas do Instagram simultâneas fixas`,
      '5 testes todo mês para usar em clientes/outras contas',
      'Ferramenta MRO completa',
      'Área de membros por 1 ano',
      'Grupo VIP no WhatsApp',
      'Suporte VIP',
    ],
  },
  lifetime: {
    title: black ? 'Vitalício Black' : 'Plano Vitalício',
    tag: black ? '⭐ VITALÍCIO BLACK' : '⭐ VITALÍCIO',
    period: 'Acesso vitalício — sem renovação',
    features: [
      `${currentPromoOffer('lifetime', black ? 0 : Infinity).accounts} contas do Instagram simultâneas fixas`,
      '5 testes todo mês para usar em clientes/outras contas',
      'Ferramenta MRO completa',
      'Área de membros vitalícia',
      'Grupo VIP no WhatsApp',
      'Suporte VIP',
    ],
  },
});

export interface BlackPlanSelection {
  type: 'annual' | 'lifetime';
  amount: number;
  label: string;
  installments: string;
  oneTime: string;
}

export function blackPlanSelection(plan: MroBlackPromoPlan): BlackPlanSelection {
  const black = isBlackPromoActive();
  const o = currentPromoOffer(plan);
  return {
    type: plan,
    amount: o.price,
    label: planInfo(black)[plan].title,
    installments: `${o.installments}x de ${brl(o.installment)}`,
    oneTime: `${brl(o.price)} à vista`,
  };
}

/** Cartões de preço da Black November (anual e vitalício). */
export function BlackNovemberPricing({ onSelect }: { onSelect: (plan: BlackPlanSelection) => void }) {
  const black = useBlackPromoActive();
  const PLAN_INFO = planInfo(black);
  return (
    <div className="max-w-6xl mx-auto relative z-10">
      <div className="text-center mb-8 sm:mb-10">
        {black && (
          <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-black text-xs tracking-[0.2em] uppercase rounded px-3 py-1 bn-pulse">
            <Tag className="h-3.5 w-3.5" /> Desconto Black November
          </span>
        )}
        <h2 className="mro-sales-title text-3xl sm:text-4xl md:text-6xl uppercase mt-4">
          {black ? <>Preços <span className="bn-shimmer-text">Black</span></> : 'Escolha seu plano'}
        </h2>
        <p className="text-muted-foreground mt-3 text-base sm:text-lg">
          {black ? 'Valores exclusivos da Black November até 17/11 às 16h. Depois voltam para R$397 anual e R$1.200 vitalício.' : 'Os 5 testes mensais continuam iguais.'}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        {(Object.keys(MRO_BLACK_PROMO) as MroBlackPromoPlan[]).map((plan) => {
          const o = currentPromoOffer(plan, black ? 0 : Infinity);
          const info = PLAN_INFO[plan];
          const off = o.from - o.price;
          return (
            <div key={plan} className="bn-glow-card rounded-2xl sm:rounded-3xl">
              <div className="bn-glow-inner rounded-2xl sm:rounded-3xl p-5 sm:p-8 flex flex-col h-full">
                <div className="flex items-center justify-between gap-2 mb-5">
                  <span className="text-primary font-black text-xs sm:text-sm tracking-widest">{info.tag}</span>
                  {off > 0 && (
                    <span className="bn-off-badge bg-primary text-primary-foreground font-black text-xs sm:text-sm rounded-full px-3 py-1">
                      {brl(off)} OFF
                    </span>
                  )}
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-center">{info.title}</h3>
                <div className="bn-value-box text-center mt-4 mb-6 sm:mb-8">
                  {off > 0 && (
                    <p className="text-muted-foreground text-lg">
                      de <span className="line-through">{brl(o.from)}</span> por
                    </p>
                  )}
                  <div className="text-primary">
                    <span className="text-lg sm:text-2xl font-medium">{o.installments}x de</span>
                    <span className="text-6xl sm:text-7xl font-black ml-2">{brl(o.installment)}</span>
                  </div>
                  <div className="bn-divider" aria-hidden />
                  <p className="text-muted-foreground text-lg sm:text-xl">
                    ou <span className="text-foreground font-bold">{brl(o.price)} à vista</span>
                  </p>
                  <p className="text-muted-foreground text-xs sm:text-sm mt-1">{info.period}</p>
                </div>

                <div className="bn-divider" aria-hidden />

                <div className="space-y-3 mb-6 sm:mb-8 flex-1">
                  {info.features.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground text-sm sm:text-base">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="bn-divider" aria-hidden />

                <Button
                  onClick={() => onSelect(blackPlanSelection(plan))}
                  className="bg-cta hover:bg-cta/90 text-cta-foreground w-full font-black text-base sm:text-xl py-5 sm:py-7 rounded-xl bn-cta bn-cta-green"
                >
                  {plan === 'annual' ? (black ? 'QUERO O ANUAL BLACK' : 'QUERO O ANUAL') : (black ? 'QUERO O VITALÍCIO BLACK' : 'QUERO O VITALÍCIO')}
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
