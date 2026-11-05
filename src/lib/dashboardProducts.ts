/**
 * Regras de apresentação da dashboard (/dashboard).
 *
 * A tarja "PROPAGANDA MRO" marca apenas o card do WhatsApp com API Oficial
 * (o primeiro da lista). O card "ZAPMRO — Extensão WhatsApp" NÃO leva a tarja.
 * É só rótulo: não muda desbloqueio, preço, checkout nem ordem dos cards.
 */

export const PROPAGANDA_MRO_LABEL = "PROPAGANDA MRO";

export interface DashboardProductLike {
  slug?: string | null;
  title?: string | null;
  access_source?: string | null;
}

/** Tira acentos e caixa alta para comparar "API Oficial", "api-oficial" etc. */
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function isPropagandaMroProduct(p: DashboardProductLike): boolean {
  const haystack = normalize(`${p.slug || ""} ${p.title || ""}`);
  return haystack.includes("api oficial") || haystack.includes("api-oficial") || haystack.includes("apioficial");
}
