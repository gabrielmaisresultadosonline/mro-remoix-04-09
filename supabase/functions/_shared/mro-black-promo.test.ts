import { describe, it, expect } from "vitest";
import { currentPromoOffer, blackPromoAccounts, MRO_BLACK_PROMO_END_MS } from "./mro-black-promo";

describe("oferta /ferramentamropromo", () => {
  const before = MRO_BLACK_PROMO_END_MS - 1000;
  const after = MRO_BLACK_PROMO_END_MS;
  it("Black termina 17/11/2026 às 16h de Brasília", () => {
    expect(new Date(MRO_BLACK_PROMO_END_MS).toISOString()).toBe("2026-11-17T19:00:00.000Z");
  });
  it("antes das 16h: anual R$300 / vitalício R$967", () => {
    expect(currentPromoOffer("annual", before).price).toBe(300);
    expect(currentPromoOffer("lifetime", before).price).toBe(967);
  });
  it("depois: anual R$397 com 4 contas", () => {
    expect(currentPromoOffer("annual", after).price).toBe(397);
    expect(blackPromoAccounts("annual", after)).toBe(4);
  });
  it("depois: vitalício R$1200 com 12 contas", () => {
    expect(currentPromoOffer("lifetime", after).price).toBe(1200);
    expect(blackPromoAccounts("lifetime", after)).toBe(12);
  });
});
