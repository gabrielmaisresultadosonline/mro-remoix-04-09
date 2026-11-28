import { describe, it, expect } from "vitest";
import {
  currentPromoOffer,
  blackPromoAccounts,
  isBlackPromoActive,
  MRO_BLACK_PROMO_START_MS,
  MRO_BLACK_PROMO_END_MS,
} from "./mro-black-promo";

describe("oferta /ferramentamropromo", () => {
  const beforeStart = MRO_BLACK_PROMO_START_MS - 1000;
  const during = MRO_BLACK_PROMO_END_MS - 1000;
  const after = MRO_BLACK_PROMO_END_MS;

  it("Black Friday vai de 28/11 00h até 30/11 14h de Brasília", () => {
    expect(new Date(MRO_BLACK_PROMO_START_MS).toISOString()).toBe("2026-11-28T03:00:00.000Z");
    expect(new Date(MRO_BLACK_PROMO_END_MS).toISOString()).toBe("2026-11-30T17:00:00.000Z");
    expect(isBlackPromoActive(beforeStart)).toBe(false);
    expect(isBlackPromoActive(MRO_BLACK_PROMO_START_MS)).toBe(true);
    expect(isBlackPromoActive(during)).toBe(true);
    expect(isBlackPromoActive(after)).toBe(false);
  });

  it("durante a Black Friday: anual R$300 em 12x de R$30 com 3 contas", () => {
    expect(currentPromoOffer("annual", during)).toMatchObject({ from: 397, price: 300, installments: 12, installment: 30, accounts: 3 });
    expect(blackPromoAccounts("annual", during)).toBe(3);
  });

  it("durante a Black Friday: vitalício R$1000 em 12x de R$100 com 10 contas", () => {
    expect(currentPromoOffer("lifetime", during)).toMatchObject({ from: 1200, price: 1000, installments: 12, installment: 100, accounts: 10 });
    expect(blackPromoAccounts("lifetime", during)).toBe(10);
  });

  it("depois: anual R$397 em 12x de R$40,74 com 4 contas", () => {
    expect(currentPromoOffer("annual", after).price).toBe(397);
    expect(currentPromoOffer("annual", after).installment).toBe(40.74);
    expect(blackPromoAccounts("annual", after)).toBe(4);
  });

  it("depois: vitalício R$1200 em 12x de R$123,14 com 12 contas", () => {
    expect(currentPromoOffer("lifetime", after).price).toBe(1200);
    expect(currentPromoOffer("lifetime", after).installment).toBe(123.14);
    expect(blackPromoAccounts("lifetime", after)).toBe(12);
  });
});
