import { describe, expect, it } from "bun:test";
import { resolveAffiliateCredentials } from "../src/lib/affiliateSession";

describe("acesso conectado dos afiliados", () => {
  it("reutiliza o acesso do dashboard sem confirmação de senha", () => {
    expect(resolveAffiliateCredentials(undefined, null, JSON.stringify({username: "cliente", password: "test-only"}))).toEqual({squarecloud_username: "cliente", password: "test-only"});
  });
  it("reutiliza o acesso da ferramenta MRO", () => {
    expect(resolveAffiliateCredentials("cliente", "test-only", null)?.squarecloud_username).toBe("cliente");
  });
  it("não mistura as credenciais de dois usuários", () => {
    expect(resolveAffiliateCredentials("outro", null, JSON.stringify({username: "cliente", password: "test-only"}))).toBeNull();
  });
  it("não considera nome de usuário sozinho uma autenticação", () => {
    expect(resolveAffiliateCredentials("cliente", null, null)).toBeNull();
  });
});