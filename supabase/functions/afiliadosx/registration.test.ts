import { describe, expect, it } from "bun:test";
import { findAffiliateByEmail, replaceAffiliateByEmail, type Affiliate } from "./registration.ts";

const existing: Affiliate = {
  id: "link-antigo",
  name: "Cadastro anterior",
  email: "Afiliado@Exemplo.com",
  active: false,
  createdAt: "2025-01-10T12:00:00.000Z",
  commissionNotified: ["venda-1", "venda-2"],
  squarecloudUsername: "usuario-antigo",
};

const replacement: Affiliate = {
  id: "id-que-nao-deve-substituir-o-link",
  name: "Novo cadastro",
  email: "afiliado@exemplo.com",
  active: true,
  createdAt: "2026-11-13T16:00:00.000Z",
  source: "afiliadosx",
  squarecloudUsername: "usuario-atual",
};

describe("substituição de afiliado por e-mail", () => {
  it("reconhece o e-mail existente sem diferenciar maiúsculas ou espaços", () => {
    expect(findAffiliateByEmail([existing], "  afiliado@exemplo.COM ")?.id).toBe("link-antigo");
  });

  it("ativa os dados atuais preservando link, data inicial e histórico de comissões", () => {
    const result = replaceAffiliateByEmail([existing], replacement.email, replacement);

    expect(result.affiliate).toMatchObject({
      id: "link-antigo",
      name: "Novo cadastro",
      active: true,
      squarecloudUsername: "usuario-atual",
      createdAt: "2025-01-10T12:00:00.000Z",
      commissionNotified: ["venda-1", "venda-2"],
    });
    expect(result.affiliates).toHaveLength(1);
  });
});
