/**
 * Oferta Black Friday da /ferramentamropromo.
 *
 * Fonte única dos valores exibidos na página, do valor cobrado no checkout e
 * das contas iniciais criadas na Ferramenta MRO para quem compra por ela.
 * Os 5 testes mensais seguem o padrão de todos os usuários.
 */
export const MRO_BLACK_PROMO_SOURCE = "blackpromo";
export const MRO_BLACK_PROMO_LABEL = "BLACK PROMO";

export const MRO_BLACK_PROMO = {
  annual: { from: 397, price: 300, installments: 12, installment: 30, accounts: 3 },
  lifetime: { from: 1200, price: 1000, installments: 12, installment: 100, accounts: 10 },
} as const;

export type MroBlackPromoPlan = keyof typeof MRO_BLACK_PROMO;

/** Início da Black Friday: 28/11/2026 às 00:00 (horário de Brasília) = 03:00 UTC. */
export const MRO_BLACK_PROMO_START_MS = Date.UTC(2026, 10, 28, 3, 0, 0);

/** Fim da Black Friday: 30/11/2026 às 14:00 (horário de Brasília) = 17:00 UTC. */
export const MRO_BLACK_PROMO_END_MS = Date.UTC(2026, 10, 30, 17, 0, 0);

/** Valores normais após o fim da Black (anual 4 contas, vitalício 12 contas). */
export const MRO_PROMO_REGULAR = {
  annual: { from: 397, price: 397, installments: 12, installment: 40.74, accounts: 4 },
  lifetime: { from: 1200, price: 1200, installments: 12, installment: 123.14, accounts: 12 },
} as const;

export type MroPromoOffer = { from: number; price: number; installments: number; installment: number; accounts: number };

export function isBlackPromoActive(now: number = Date.now()): boolean {
  return now >= MRO_BLACK_PROMO_START_MS && now < MRO_BLACK_PROMO_END_MS;
}

/** Oferta vigente da /ferramentamropromo: Black até o prazo, depois os valores normais. */
export function currentPromoOffer(plan: MroBlackPromoPlan, now: number = Date.now()): MroPromoOffer {
  return isBlackPromoActive(now) ? MRO_BLACK_PROMO[plan] : MRO_PROMO_REGULAR[plan];
}

export function isBlackPromoSource(source: unknown): boolean {
  return typeof source === "string" && source.trim().toLowerCase() === MRO_BLACK_PROMO_SOURCE;
}

/** Plano Black correspondente ao plan_type do pedido (anual ou vitalício). */
export function blackPromoPlan(planType: unknown): MroBlackPromoPlan | null {
  const p = String(planType || "").trim().toLowerCase();
  if (p === "annual" || p === "anual") return "annual";
  if (p === "lifetime" || p === "vitalicio" || p === "agencia") return "lifetime";
  return null;
}

/** Contas iniciais de uma compra Black, ou null quando o plano não é Black. */
export function blackPromoAccounts(planType: unknown, now: number = Date.now()): number | null {
  const plan = blackPromoPlan(planType);
  return plan ? currentPromoOffer(plan, now).accounts : null;
}
