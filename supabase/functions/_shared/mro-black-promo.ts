/**
 * Oferta Black November da /ferramentamropromo.
 *
 * Fonte única dos valores exibidos na página, do valor cobrado no checkout e
 * das contas iniciais criadas na Ferramenta MRO para quem compra por ela.
 * Os 5 testes mensais seguem o padrão de todos os usuários.
 */
export const MRO_BLACK_PROMO_SOURCE = "blackpromo";
export const MRO_BLACK_PROMO_LABEL = "BLACK PROMO";

export const MRO_BLACK_PROMO = {
  annual: { from: 397, price: 300, installments: 12, installment: 30, accounts: 3 },
  lifetime: { from: 1200, price: 967, installments: 12, installment: 99, accounts: 10 },
} as const;

export type MroBlackPromoPlan = keyof typeof MRO_BLACK_PROMO;

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
export function blackPromoAccounts(planType: unknown): number | null {
  const plan = blackPromoPlan(planType);
  return plan ? MRO_BLACK_PROMO[plan].accounts : null;
}
