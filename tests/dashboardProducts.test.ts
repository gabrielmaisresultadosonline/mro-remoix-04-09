import { describe, it, expect } from "bun:test";
import { isPropagandaMroProduct, PROPAGANDA_MRO_LABEL } from "../src/lib/dashboardProducts";

describe("isPropagandaMroProduct", () => {
  it("marca o card do WhatsApp API Oficial", () => {
    expect(
      isPropagandaMroProduct({
        slug: "whatsapp-api-oficial",
        title: "WhatsApp API Oficial",
        access_source: "zapmro",
      }),
    ).toBe(true);
  });

  it("marca pelo acesso zapmro mesmo com outro título", () => {
    expect(isPropagandaMroProduct({ slug: "ferramenta", title: "ZAPMRO", access_source: "zapmro" })).toBe(true);
  });

  it("não marca MRO Ferramenta nem Marketing", () => {
    expect(isPropagandaMroProduct({ slug: "mro-ferramenta", title: "MRO Ferramenta", access_source: "mro_tool" })).toBe(false);
    expect(isPropagandaMroProduct({ slug: "marketing", title: "Marketing Completo", access_source: "hub" })).toBe(false);
  });

  it("não marca card que fala de WhatsApp sem ser a API", () => {
    expect(isPropagandaMroProduct({ slug: "grupo-wa", title: "Grupo WhatsApp", access_source: "hub" })).toBe(false);
  });

  it("a tarja é exatamente PROPAGANDA MRO", () => {
    expect(PROPAGANDA_MRO_LABEL).toBe("PROPAGANDA MRO");
  });
});
