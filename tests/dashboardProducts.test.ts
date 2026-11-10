import { describe, it, expect } from "bun:test";
import { isPropagandaMroProduct, PROPAGANDA_MRO_LABEL, separateDashboardProducts } from "../src/lib/dashboardProducts";

describe("isPropagandaMroProduct", () => {
  it("separa API Oficial dos produtos sem retirar a extensão WhatsApp", () => {
    const original = [{ slug: "api-oficial" }, { slug: "mro" }, { slug: "zapmro-extensao" }];
    const separated = separateDashboardProducts(original);
    expect(separated.products.map(p => p.slug)).toEqual(["mro", "zapmro-extensao"]);
    expect(separated.advertising.map(p => p.slug)).toEqual(["api-oficial"]);
    expect(original.length).toBe(3);
  });
  it("marca o card do WhatsApp com API Oficial (o primeiro da lista)", () => {
    expect(
      isPropagandaMroProduct({
        slug: "whatsapp-api-oficial",
        title: "WhatsApp com API Oficial: Trabalhe com Segurança e Professionalismo",
        access_source: "zapmro",
      }),
    ).toBe(true);
  });

  it("não marca ZAPMRO — Extensão WhatsApp", () => {
    expect(
      isPropagandaMroProduct({
        slug: "zapmro-extensao",
        title: "ZAPMRO — Extensão WhatsApp",
        access_source: "zapmro",
      }),
    ).toBe(false);
  });

  it("não marca MRO Ferramenta nem Marketing", () => {
    expect(isPropagandaMroProduct({ slug: "mro-ferramenta", title: "MRO Ferramenta", access_source: "mro_tool" })).toBe(false);
    expect(isPropagandaMroProduct({ slug: "marketing", title: "Marketing Completo", access_source: "hub" })).toBe(false);
  });

  it("reconhece sem acento e em caixa baixa", () => {
    expect(isPropagandaMroProduct({ slug: "wa", title: "whatsapp com api oficial", access_source: "hub" })).toBe(true);
    expect(isPropagandaMroProduct({ slug: "whatsapp_api_oficial", title: "Outro nome", access_source: "hub" })).toBe(true);
  });

  it("a tarja é exatamente PROPAGANDA MRO", () => {
    expect(PROPAGANDA_MRO_LABEL).toBe("PROPAGANDA MRO");
  });
});
