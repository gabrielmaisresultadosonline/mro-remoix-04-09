# Whitelabel MRO — revendedores com painel próprio

## O que será criado

### 1. Novo menu "Whitelabel" no /admin
- **Revendedores**: criar, editar, bloquear, excluir (só ele ou ele + todos os clientes criados por ele). Campos: nome, usuário, senha, e-mail, data de criação, data de validade para revender, chave PIX (visível).
- **Clientes de cada revendedor**: lista com plano (anual/vitalício), contas adicionais, data de criação; ações: trocar senha, remover contas, bloquear, excluir.
- **Arquivo da ferramenta**: upload de um arquivo de download individual por revendedor (com a marca dele).
- **Tutoriais e avisos**: textos/vídeos que aparecem no painel de todos os revendedores.
- **Financeiro**: por revendedor — total vendido, taxas devidas, taxas pagas, vendas pelos links MRO, saldo a repassar. Botão "Dar baixa" (marca repasse como pago e quita as taxas descontadas juntas).

### 2. Nova página /whitelabel (login próprio com usuário e senha)
- **Início**: dias restantes para revender, download do arquivo da marca dele, tutoriais.
- **Criar cliente da Ferramenta MRO**: usuário (= senha), e-mail, plano anual ou vitalício. Ao criar, o cliente recebe o mesmo e-mail de acesso de uma compra normal.
- **Gerenciar clientes**: adicionar contas extras, zerar os 5 testes mensais.
- **Como funcionam as comissões e vendas**: regras fixas abaixo.
- **Taxas a pagar**: soma automática, botão "Pagar" abre o checkout InfiniPay; o webhook confirma e quita sozinho.
- **Links de venda MRO**: 2 links (Renda Extra e Cliente Final), funcionando como os afiliados do /instagram-nova-admin. Histórico em tempo real de tentativas e compras.
- **Recebimento**: salvar chave PIX.
- A cada venda aprovada pelos links, o revendedor recebe e-mail: "Venda aprovada usando MRO API! Seu saldo será creditado em sua conta em algumas horas."

### Regras de valores
| Item | Preço mínimo de venda | Taxa paga à MRO |
|---|---|---|
| Anual | R$397 | R$100 |
| Vitalício (12 contas) | R$1.200 | R$197 |
| Conta adicional (anual) | R$100 | R$40 |
| Conta adicional (vitalício) | R$150 | R$40 |

Nas vendas pelos links MRO, a taxa já é descontada do valor a repassar.

## Detalhes técnicos
- Tabelas novas (RLS ativo, acesso só via função do servidor com service_role): `whitelabel_resellers`, `whitelabel_clients` (vínculo com o usuário da Ferramenta MRO), `whitelabel_fees` (lançamentos de taxa por criação/adicional), `whitelabel_fee_payments` (pedidos InfiniPay, NSU), `whitelabel_sales` (vendas/tentativas pelos links), `whitelabel_payouts`, `whitelabel_tutorials`.
- Arquivos da marca no Storage em pasta privada por revendedor, entregues com link assinado.
- Edge Function `whitelabel-api`: login do revendedor (senha com hash SHA-256 Web Crypto, token HMAC próprio), ações do revendedor; ações admin protegidas pelo `require-admin.ts` existente.
- Criação de clientes reutiliza a mesma lógica de provisionamento/e-mail da Ferramenta MRO (`mro_tool_users`), marcando `reseller_id`.
- Pagamento de taxas e vendas por link entram no webhook InfiniPay unificado (prefixo de NSU `WLFEE`/`WLSALE`).
- Migration SQL versionada em `server/migrations/011_whitelabel.sql` para a VPS aplicar no `atualizar.sh`.
- Nada do que já existe é removido ou alterado em comportamento.

## Pontos assumidos (confirme se diferente)
- Taxa de conta adicional é R$40 tanto para anual quanto vitalício.
- O revendedor bloqueado/vencido perde o acesso ao painel, mas os clientes dele continuam funcionando (salvo exclusão pelo admin).
- O link "Cliente Final" usa a página de venda padrão da Ferramenta MRO; o link "Renda Extra" usa a página /rendaextra, ambos com o código do revendedor.
