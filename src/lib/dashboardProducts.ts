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
  unlocked?: boolean;
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
  const normal = products.filter(product => !isPropagandaMroProduct(product) && !isZapmroExtension(product));
  const extensions = products.filter(isZapmroExtension);
  return {
    products: [...normal, ...extensions.filter(product => product.unlocked)],
    advertising: products.filter(isPropagandaMroProduct),
    lockedExtensions: extensions.filter(product => !product.unlocked),
  };
}

export function isZapmroExtension(product: DashboardProductLike): boolean {
  if (isPropagandaMroProduct(product)) return false;
  return normalize(`${product.slug || ""} ${product.title || ""}`).includes("zapmro") || product.access_source === "zapmro";
}
