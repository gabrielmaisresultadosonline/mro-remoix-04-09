import { describe, it, expect } from "bun:test";
import {
  MRO_BLACK_PROMO,
  blackPromoAccounts,
  blackPromoPlan,
  isBlackPromoSource,
} from "../supabase/functions/_shared/mro-black-promo";

describe("Black November /ferramentamropromo", () => {
  it("anual: de R$397 por R$300 em 12x de R$30", () => {
    expect(MRO_BLACK_PROMO.annual.from).toBe(397);
    expect(MRO_BLACK_PROMO.annual.price).toBe(300);
    expect(MRO_BLACK_PROMO.annual.installments).toBe(12);
    expect(MRO_BLACK_PROMO.annual.installment).toBe(30);
  });

  it("vitalício: de R$1200 por R$967 em 12x de R$99", () => {
    expect(MRO_BLACK_PROMO.lifetime.from).toBe(1200);
    expect(MRO_BLACK_PROMO.lifetime.price).toBe(967);
    expect(MRO_BLACK_PROMO.lifetime.installments).toBe(12);
    expect(MRO_BLACK_PROMO.lifetime.installment).toBe(99);
  });

  it("anual Black inicia com 3 contas (antes eram 4)", () => {
    expect(blackPromoAccounts("annual")).toBe(3);
  });

  it("vitalício Black inicia com 10 contas (antes eram 12)", () => {
    expect(blackPromoAccounts("lifetime")).toBe(10);
  });

  it("planos que não fazem parte da Black não mudam de contas", () => {
    expect(blackPromoAccounts("trial")).toBeNull();
    expect(blackPromoPlan("monthly")).toBeNull();
  });

  it("só a origem blackpromo é tratada como compra Black", () => {
    expect(isBlackPromoSource("blackpromo")).toBe(true);
    expect(isBlackPromoSource("renddx")).toBe(false);
    expect(isBlackPromoSource(null)).toBe(false);
  });
});
