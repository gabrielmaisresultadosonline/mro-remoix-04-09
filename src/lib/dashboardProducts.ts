/**
 * Regras de apresentação da dashboard (/dashboard).
 *
 * A tarja "PROPAGANDA MRO" marca apenas o card do WhatsApp com API Oficial
 * em uma seção separada abaixo dos produtos. ZAPMRO NÃO leva a tarja.
 * Não muda desbloqueio, preço nem checkout.
 */

export const PROPAGANDA_MRO_LABEL = "PROPAGANDA MRO";

export interface DashboardProductLike {
  slug?: string | null;
  title?: string | null;
  access_source?: string | null;
}

/** Tira acentos, caixa alta e troca "-", "_" por espaço: "API-Oficial" vira "api oficial". */
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-_]+/g, " ");

export function isPropagandaMroProduct(p: DashboardProductLike): boolean {
  const haystack = normalize(`${p.slug || ""} ${p.title || ""}`);
  return haystack.includes("api oficial");
}

export function separateDashboardProducts<T extends DashboardProductLike>(products: T[]) {
  return {
    products: products.filter(product => !isPropagandaMroProduct(product)),
    advertising: products.filter(isPropagandaMroProduct),
  };
}
