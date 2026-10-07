/**
 * Núcleo do Whitelabel MRO — compartilhado entre `whitelabel-api` e o
 * webhook InfiniPay unificado. Centraliza preços, taxas, provisionamento
 * de clientes da Ferramenta MRO e confirmação de pagamentos.
 */
import { MRO_ANNUAL_OFFER } from "../../../shared/mro-sales.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
// deno-lint-ignore no-explicit-any
type Db = any;

export type WlPlan = "annual" | "lifetime";

/** Preços mínimos de venda (site oficial) e taxas devidas à MRO. */
export const WL_PRICES = { annual: MRO_ANNUAL_OFFER.price, lifetime: 1200, extra_annual: 100, extra_lifetime: 150 } as const;
export const WL_FEES = { annual: 100, lifetime: 197, extra_annual: 40, extra_lifetime: 40 } as const;
export const WL_PLAN_ACCOUNTS: Record<WlPlan, number> = { annual: 4, lifetime: 12 };
const LIFETIME_DAYS = 999999;

export async function sha256(value: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const normUser = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 60);
export const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase().slice(0, 255);
export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/** Envia o e-mail oficial de boas-vindas da Ferramenta MRO. */
async function sendWelcome(email: string, username: string, password: string, days: number) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ email, username, password, daysRemaining: days }),
    });
  } catch (e) {
    console.error("[whitelabel] welcome email failed", e);
  }
}

/** E-mail simples via SMTP (Hostinger) — mesmo remetente dos demais produtos. */
export async function sendPlainEmail(to: string, subject: string, html: string): Promise<boolean> {
  const password = Deno.env.get("SMTP_PASSWORD");
  if (!password || !to) return false;
  try {
    const client = new SMTPClient({
      connection: { hostname: "smtp.hostinger.com", port: 465, tls: true, auth: { username: "suporte@maisresultadosonline.com.br", password } },
    });
    await client.send({ from: "MRO <suporte@maisresultadosonline.com.br>", to, subject, html, content: "auto" });
    await client.close();
    return true;
  } catch (e) {
    console.error("[whitelabel] smtp failed", e);
    return false;
  }
}

/**
 * Cria o cliente na Ferramenta MRO (senha = usuário), registra o vínculo com
 * o revendedor, lança a taxa e envia o acesso por e-mail ao cliente.
 */
export async function provisionClient(
  db: Db,
  opts: { resellerId: string; username: string; email: string; plan: WlPlan; origin: "manual" | "link"; saleId?: string; feeStatus?: "pending" | "paid"; feeVia?: string },
): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  const { resellerId, username, email, plan } = opts;
  const { data: existing } = await db.from("mro_tool_users").select("id").eq("username", username).maybeSingle();
  if (existing) return { ok: false, error: "Esse nome de usuário já existe na Ferramenta MRO" };

  const days = plan === "lifetime" ? LIFETIME_DAYS : 365;
  const payload: Record<string, unknown> = {
    username, email, name: username,
    password_hash: await sha256(username), password_plain: username,
    plan_accounts: WL_PLAN_ACCOUNTS[plan], extra_accounts: 0,
    expiration_days: days, is_active: true, source: `whitelabel:${resellerId}`,
  };
  if (plan === "annual") payload.expires_at = new Date(Date.now() + 365 * 864e5).toISOString();

  const { data: user, error } = await db.from("mro_tool_users").insert(payload).select("id").single();
  if (error || !user) return { ok: false, error: error?.message || "Falha ao criar usuário" };

  const { data: client, error: cErr } = await db.from("whitelabel_clients")
    .insert({ reseller_id: resellerId, mro_user_id: user.id, username, email, plan, origin: opts.origin })
    .select("id").single();
  if (cErr || !client) return { ok: false, error: cErr?.message || "Falha ao registrar cliente" };

  await db.from("whitelabel_fees").insert({
    reseller_id: resellerId, client_id: client.id, sale_id: opts.saleId ?? null, kind: plan, quantity: 1,
    amount: WL_FEES[plan], description: `${plan === "lifetime" ? "Vitalício" : "Anual"} — ${username}`,
    status: opts.feeStatus ?? "pending", paid_via: opts.feeVia ?? null,
  });

  await sendWelcome(email, username, username, days);
  return { ok: true, clientId: client.id };
}

/** Confirma pagamentos Whitelabel (WLFEE = taxas, WLSALE = venda pelo link). */
export async function processWhitelabelPayment(db: Db, nsu: string): Promise<{ handled: boolean; message: string }> {
  if (nsu.startsWith("WLFEE")) {
    const { data: pay } = await db.from("whitelabel_fee_payments").select("*").eq("nsu", nsu).maybeSingle();
    if (!pay) return { handled: true, message: "fee payment not found" };
    if (pay.status === "paid") return { handled: true, message: "already paid" };
    const now = new Date().toISOString();
    await db.from("whitelabel_fee_payments").update({ status: "paid", paid_at: now }).eq("id", pay.id);
    if (pay.fee_ids?.length) {
      await db.from("whitelabel_fees").update({ status: "paid", paid_at: now, paid_via: "infinitepay", payment_id: pay.id })
        .in("id", pay.fee_ids).eq("status", "pending");
    }
    return { handled: true, message: "WLFEE confirmed" };
  }

  if (nsu.startsWith("WLSALE")) {
    const { data: sale } = await db.from("whitelabel_sales").select("*").eq("nsu", nsu).maybeSingle();
    if (!sale) return { handled: true, message: "sale not found" };
    if (sale.status === "paid") return { handled: true, message: "already paid" };
    await db.from("whitelabel_sales").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", sale.id);

    // A taxa fica "pendente" até o admin dar baixa no repasse (é descontada do valor a receber).
    const res = await provisionClient(db, {
      resellerId: sale.reseller_id, username: sale.buyer_username, email: sale.buyer_email,
      plan: sale.plan, origin: "link", saleId: sale.id, feeVia: "desconto_repasse",
    });
    if (res.ok) await db.from("whitelabel_sales").update({ client_id: res.clientId }).eq("id", sale.id);
    else console.error("[whitelabel] provision failed", res.error);

    const { data: reseller } = await db.from("whitelabel_resellers").select("email, name").eq("id", sale.reseller_id).maybeSingle();
    if (reseller?.email) {
      await sendPlainEmail(reseller.email, "Venda aprovada usando MRO API!", `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
          <h2 style="color:#111">✅ Venda aprovada usando MRO API!</h2>
          <p>Olá ${reseller.name ?? ""}, uma nova venda foi aprovada pelo seu link.</p>
          <p><b>Cliente:</b> ${sale.buyer_name ?? ""} (${sale.buyer_email})<br/>
          <b>Plano:</b> ${sale.plan === "lifetime" ? "Vitalício" : "Anual"}<br/>
          <b>Valor:</b> R$ ${Number(sale.amount).toFixed(2)}<br/>
          <b>Seu líquido:</b> R$ ${Number(sale.net_amount).toFixed(2)}</p>
          <p><b>Seu saldo será creditado em sua conta em algumas horas.</b></p>
        </div>`);
    }
    return { handled: true, message: "WLSALE confirmed" };
  }
  return { handled: false, message: "not whitelabel" };
}
