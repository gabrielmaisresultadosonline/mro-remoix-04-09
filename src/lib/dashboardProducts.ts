/**
 * Regras de apresentação da dashboard (/dashboard).
 *
 * A tarja "PROPAGANDA MRO" marca o acesso de divulgação (WhatsApp API Oficial).
 * É só rótulo: não muda desbloqueio, preço, checkout nem ordem dos cards.
 */

export const PROPAGANDA_MRO_LABEL = "PROPAGANDA MRO";

export interface DashboardProductLike {
  slug?: string | null;
  title?: string | null;
  access_source?: string | null;
}

export function isPropagandaMroProduct(p: DashboardProductLike): boolean {
  if ((p.access_source || "").toLowerCase() === "zapmro") return true;
  const haystack = `${p.slug || ""} ${p.title || ""}`.toLowerCase();
  return haystack.includes("whatsapp") && haystack.includes("api");
}
