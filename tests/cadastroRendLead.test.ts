import { describe, expect, it } from "bun:test";
import { isCadastroRendLeadEligible, isCadastroRendRegionAllowed, isCadastroRendPixelEnabled } from "../src/lib/cadastroRendLead";

describe("Cadastro Rend Lead", () => {
  it("uses only the enabled Pixel saved for this page", () => {
    expect(isCadastroRendPixelEnabled({ pixel_id: "123456789", pixel_enabled: true })).toBe(true);
    expect(isCadastroRendPixelEnabled({ pixel_id: "123456789", pixel_enabled: false })).toBe(false);
    expect(isCadastroRendPixelEnabled({ pixel_id: "", pixel_enabled: true })).toBe(false);
    expect(isCadastroRendPixelEnabled(null)).toBe(false);
  });
  it("counts a saved registration that received the group link", () => {
    expect(isCadastroRendLeadEligible(true, true, "https://chat.whatsapp.com/example")).toBe(true);
  });
  it("does not count mobile/tablet registrations", () => {
    expect(isCadastroRendLeadEligible(false, true, "https://chat.whatsapp.com/example")).toBe(false);
  });
  it("does not count unsuccessful registrations", () => {
    expect(isCadastroRendLeadEligible(true, false, "https://chat.whatsapp.com/example")).toBe(false);
  });
  it("does not count registrations with no released link", () => {
    expect(isCadastroRendLeadEligible(true, true, "")).toBe(false);
  });
  it("blocks consent and unresolved regions on the no-banner route", () => {
    for (const country of ["BR", "DE", "GB", "XX", "T1", null]) expect(isCadastroRendRegionAllowed(country)).toBe(false);
    expect(isCadastroRendRegionAllowed("US")).toBe(true);
  });
});