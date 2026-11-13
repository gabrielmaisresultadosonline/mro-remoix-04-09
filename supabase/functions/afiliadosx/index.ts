import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { sanitizeEmailSubject, htmlToPlainText } from "../_shared/email-encode.ts";
import { isAdminRequest } from "../_shared/require-admin.ts";
import nodemailer from "npm:nodemailer@6.10.1";
import { deliverAffiliateWelcome } from "../_shared/affiliate-welcome-delivery.ts";
import { findAffiliateByEmail, replaceAffiliateByEmail, type Affiliate } from "./registration.ts";

// Self-service affiliate registration.
// Writes into the SAME affiliates JSON managed by /instagram-nova-admin
// (via `affiliate-storage`), so admin sees these entries in the usual tab.
// Access gate: user must be a MRO Instagram client (SquareCloud login).
// Sales links: /promo/<id>, /promorendaextra/<id> (existing admin flow).
// Dashboard  : /resumo/<id> — password set via `affiliate-resumo-storage`.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// -------------------------------------------------------------
// SquareCloud validation — same flow used by /instagram
// -------------------------------------------------------------
async function validateSquareCloud(username: string, password: string) {
  // Mesmo login usado hoje no /instagram (API interna MRO no PostgreSQL da VPS).
  try {
    const { data, error } = await supabase.functions.invoke("mro-tool-api", {
      body: { action: "login", username, password },
    });
    const r = (data ?? {}) as { success?: boolean; error?: string };
    if (r.success) return { ok: true };
    if (error && !data) {
      console.error("[afiliadosx] login check error", error);
      return { ok: false, error: "Usuário MRO ou senha incorretos" };
    }
    return { ok: false, error: r.error || "Usuário MRO ou senha incorretos" };
  } catch (e) {
    console.error("[afiliadosx] login check fatal", e);
    return { ok: false, error: "Erro ao validar usuário MRO" };
  }
}

// -------------------------------------------------------------
// Slug helpers
// -------------------------------------------------------------
function cleanSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

// -------------------------------------------------------------
// Load / save affiliates JSON (same shape as admin panel)
// -------------------------------------------------------------
async function loadAffiliates(): Promise<Affiliate[]> {
  const { data, error } = await supabase.storage
    .from("user-data")
    .download("admin/affiliates.json");
  if (error) {
    if (error.message.includes("not found") || error.message.includes("Object not found")) {
      return [];
    }
    throw error;
  }
  const text = await data.text();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAffiliates(list: Affiliate[]) {
  const blob = new Blob([JSON.stringify(list)], { type: "application/json" });
  const { error } = await supabase.storage
    .from("user-data")
    .upload("admin/affiliates.json", blob, {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw error;
}

// -------------------------------------------------------------
// Set the resumo password (same store used by AffiliateResumo login)
// -------------------------------------------------------------
async function setResumoPassword(affiliateId: string, password: string) {
  const config = { password, updatedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(config)], { type: "application/json" });
  await supabase.storage
    .from("user-data")
    .upload(`affiliate-resumos/${affiliateId}/config.json`, blob, {
      contentType: "application/json",
      upsert: true,
    });
}

// -------------------------------------------------------------
// Email
// -------------------------------------------------------------
async function sendEmail(to: string, subject: string, html: string) {
  const smtpPass = Deno.env.get("SMTP_PASSWORD")?.trim();
  if (!smtpPass) {
    console.error("[afiliadosx] SMTP_PASSWORD missing");
    return { ok: false };
  }
  const smtpUser = Deno.env.get("SMTP_USER")?.trim() || "suporte@maisresultadosonline.com.br";
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const transport = nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST")?.trim() || "smtp.hostinger.com",
    port, secure: port === 465,
    auth: { user: smtpUser, pass: smtpPass },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  });
  try {
    const result = await deliverAffiliateWelcome(transport, {
      from: `MRO Afiliados <${smtpUser}>`,
      to,
      subject: sanitizeEmailSubject(subject),
      text: htmlToPlainText(html),
      html,
    });
    console.info(`[afiliadosx] boas_vindas status=${result.ok ? 'aceito_smtp' : 'recusado_smtp'}`);
    return result;
  } catch (e) {
    const error = e as { code?: string; responseCode?: number };
    console.error(`[afiliadosx] boas_vindas falhou code=${error.code || 'smtp_error'} smtp_status=${error.responseCode || 'indisponivel'}`);
    return { ok: false };
  }
}

function welcomeEmailHtml(name: string, affiliateId: string, email: string) {
  name = name.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
  const base = "https://maisresultadosonline.com.br";
  const linkPromo = `${base}/promo/${affiliateId}`;
  const linkRenda = `${base}/promorendaextra/${affiliateId}`;
  const linkDash  = `${base}/afiliadosx`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,Helvetica,sans-serif;color:#fff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:24px 0;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111;border:1px solid #262626;border-radius:16px;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 32px 24px;text-align:center;">
      <h1 style="margin:0;color:#000;font-size:26px;font-weight:900;letter-spacing:-0.5px;">Bem-vindo(a) ao Programa de Afiliados MRO</h1>
      <p style="margin:8px 0 0;color:#111;font-size:14px;font-weight:600;">R$ 197 no Vitalício · R$ 97 no Anual</p>
    </td></tr>
    <tr><td style="padding:28px 32px;color:#e5e5e5;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;">Olá <strong style="color:#fbbf24;">${name}</strong>, seu cadastro como afiliado(a) foi ativado.</p>
      <p style="margin:0 0 16px;">Como você já é cliente MRO Instagram, agora pode divulgar a ferramenta e ganhar comissão a cada venda aprovada no seu link.</p>
      <div style="background:#0a0a0a;border:1px solid #fbbf24;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 12px;font-size:11px;color:#a3a3a3;text-transform:uppercase;letter-spacing:2px;font-weight:800;">Suas comissões</p>
        <p style="margin:0 0 8px;font-size:14px;color:#e5e5e5;"><strong style="color:#fbbf24;">Plano Vitalício — R$ 1.197:</strong> você recebe <strong style="color:#22c55e;">R$ 197,00</strong> por venda.</p>
        <p style="margin:0;font-size:14px;color:#e5e5e5;"><strong style="color:#fbbf24;">Plano Anual — R$ 397:</strong> você recebe <strong style="color:#22c55e;">R$ 97,00</strong> por venda.</p>
      </div>

      <div style="background:#0a0a0a;border:1px solid #262626;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 12px;font-size:11px;color:#a3a3a3;text-transform:uppercase;letter-spacing:2px;font-weight:800;">Seus links de venda</p>
        <p style="margin:0 0 10px;font-size:13px;color:#e5e5e5;"><strong>Link principal (Instagram PRO):</strong><br>
          <a href="${linkPromo}" style="color:#fbbf24;word-break:break-all;">${linkPromo}</a></p>
        <p style="margin:0;font-size:13px;color:#e5e5e5;"><strong>Link Renda Extra:</strong><br>
          <a href="${linkRenda}" style="color:#fbbf24;word-break:break-all;">${linkRenda}</a></p>
      </div>

      <div style="background:#0a0a0a;border:1px solid #262626;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 12px;font-size:11px;color:#a3a3a3;text-transform:uppercase;letter-spacing:2px;font-weight:800;">Painel Dashboard em tempo real</p>
        <p style="margin:0 0 12px;font-size:14px;color:#e5e5e5;">Acompanhe vendas aprovadas, tentativas e comissões:</p>
        <p style="margin:0 0 12px;text-align:center;">
          <a href="${linkDash}" style="display:inline-block;background:#fbbf24;color:#000;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:900;text-transform:uppercase;font-size:13px;letter-spacing:1px;">Acessar Dashboard</a>
        </p>
        <p style="margin:12px 0 0;font-size:13px;color:#a3a3a3;">
          <strong style="color:#fbbf24;">Abra o resumo dentro da área de afiliados com seu acesso da ferramenta MRO, sem confirmar a senha novamente.</strong>
        </p>
      </div>

      <div style="background:#0a0a0a;border:1px solid #262626;border-radius:12px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px;font-size:11px;color:#a3a3a3;text-transform:uppercase;letter-spacing:2px;font-weight:800;">100% Transparente</p>
        <p style="margin:0;font-size:13px;color:#e5e5e5;line-height:1.6;">Toda tentativa de compra no seu link aparece em tempo real no painel — inclusive quem não pagou ainda. Você pode inclusive testar comprando no seu próprio link e ver a tentativa surgindo no dashboard.</p>
      </div>

      <p style="margin:16px 0 0;font-size:13px;color:#a3a3a3;">Este programa é válido apenas para clientes ativos MRO Instagram — só quem já usa a ferramenta consegue divulgar com propriedade. Bom trabalho!</p>
    </td></tr>
    <tr><td style="background:#0a0a0a;padding:20px 32px;text-align:center;color:#525252;font-size:11px;border-top:1px solid #262626;">
      © MRO — Mais Resultados Online · contato@maisresultadosonline.com.br
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

// -------------------------------------------------------------
// Actions
// -------------------------------------------------------------
async function actionRegister(body: any) {
  const first = String(body.first_name || "").trim();
  const last = String(body.last_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const scUsername = String(body.squarecloud_username || "").trim().toLowerCase();
  const scPassword = String(body.password || "");
  const photoUrl = body.photo_url ? String(body.photo_url) : "";
  const desiredId = String(body.desired_id || "").trim();
  const showPromoBanner = body.show_promo_banner !== false;

  if (!first) return json({ success: false, error: "Informe seu nome" }, 400);
  if (!email.includes("@")) return json({ success: false, error: "Email inválido" }, 400);
  if (!scUsername) return json({ success: false, error: "Informe seu usuário MRO" }, 400);
  if (cleanSlug(desiredId).length < 3) return json({ success: false, error: "Identificador obrigatório: mínimo 3 letras/números" }, 400);
  if (!scPassword || scPassword.length < 3) return json({ success: false, error: "Senha inválida" }, 400);

  // 1. Gate: must be an active MRO Instagram client
  const v = await validateSquareCloud(scUsername, scPassword);
  if (!v.ok) return json({ success: false, error: v.error }, 200);

  // 2. Load affiliates list (single JSON, same used by admin panel)
  let affiliates: Affiliate[] = [];
  try {
    affiliates = await loadAffiliates();
  } catch (e) {
    console.error("[afiliadosx] loadAffiliates", e);
    return json({ success: false, error: "Erro ao carregar lista de afiliados" }, 500);
  }

  // A duplicate is replaced only after the explicit confirmation in /afiliadosx.
  const replaceExisting = body.replace_existing === true;
  const existingByEmail = findAffiliateByEmail(affiliates, email);
  if (existingByEmail && !replaceExisting) {
    return json({ success: false, code: "duplicate_email", error: "Já existe um afiliado com este email" });
  }
  // Duplicate SquareCloud user guard (only against another self-service entry)
  if (affiliates.some(a => a.id !== existingByEmail?.id && a.source === "afiliadosx" && (a.squarecloudUsername || "").toLowerCase() === scUsername)) {
    return json({ success: false, error: "Este usuário MRO já está cadastrado como afiliado" }, 400);
  }

  // 3. Build a unique id for a new registration. Replacement preserves the old public links.
  let affiliateId = existingByEmail?.id || "";
  if (!affiliateId) {
    const desired = cleanSlug(desiredId || first) || "afiliado";
    let candidate = desired;
    let tries = 0;
    while (affiliates.some(a => a.id === candidate)) {
      candidate = `${desired}${randomSuffix()}`;
      if (++tries > 10) return json({ success: false, error: "Não foi possível gerar um identificador único" }, 500);
    }
    affiliateId = candidate;
  }

  // 4. Append new affiliate (shape identical to admin creation)
  const fullName = last ? `${first} ${last}` : first;
  const newAffiliate: Affiliate = {
    id: affiliateId,
    name: fullName,
    email,
    photoUrl,
    active: true,
    createdAt: new Date().toISOString(),
    commissionNotified: [],
    isLifetime: existingByEmail?.isLifetime ?? true,
    source: "afiliadosx",
    squarecloudUsername: scUsername,
    showPromoBanner,
  };

  try {
    await saveAffiliates([...affiliates, newAffiliate]);
  } catch (e) {
    console.error("[afiliadosx] saveAffiliates", e);
    return json({ success: false, error: "Erro ao salvar cadastro" }, 500);
  }

  const pixKey = String(body.pix_key || "").trim();
  if (pixKey && pixKey.length <= 255) {
    const { error } = await supabase.from("affiliate_pix").upsert({ affiliate_id: affiliateId, owner_username: scUsername, pix_key: pixKey });
    if (error) console.error("[afiliadosx] Pix não salvo", error.message);
  }

  // 5. Configure dashboard password = SquareCloud password (user request)
  try {
    await setResumoPassword(affiliateId, scPassword);
  } catch (e) {
    console.error("[afiliadosx] setResumoPassword", e);
    // non-fatal: user can still recover with defaults
  }

  // Registration remains saved if SMTP fails, but the UI must report the real send status.
  const welcome = await sendEmail(
    email,
    "Bem-vindo(a) ao Programa de Afiliados MRO",
    welcomeEmailHtml(first, affiliateId, email),
  );

  return json({
    success: true,
    welcomeEmailSent: welcome.ok,
    affiliate: {
      id: affiliateId,
      name: fullName,
      email,
      photoUrl,
      links: {
        promo: `/promo/${affiliateId}`,
        promoRendaExtra: `/promorendaextra/${affiliateId}`,
        dashboard: `/resumo/${affiliateId}`,
      },
    },
  });
}

async function actionLookup(body: any) {
  const scUsername = String(body.squarecloud_username || "").trim().toLowerCase();
  if (!scUsername) return json({ success: false, error: "Usuário obrigatório" }, 400);
  const validation = await validateSquareCloud(scUsername, String(body.password || ""));
  if (!validation.ok) return json({ success: false, error: validation.error }, 401);

  let affiliates: Affiliate[] = [];
  try {
    affiliates = await loadAffiliates();
  } catch (e) {
    console.error("[afiliadosx] loadAffiliates", e);
    return json({ success: false, error: "Erro ao carregar lista" }, 500);
  }

  const match = affiliates.find(
    a => (a.squarecloudUsername || "").toLowerCase() === scUsername
  );

  if (!match) return json({ success: true, affiliate: null });
  if (!match.active) return json({ success: false, error: "Cadastro de afiliado inativo" }, 403);
  const { data: pix } = await supabase.from("affiliate_pix").select("pix_key").eq("affiliate_id", match.id).maybeSingle();

  return json({
    success: true,
    affiliate: {
      id: match.id,
      pixKey: pix?.pix_key || "",
      name: match.name,
      email: match.email,
      photoUrl: match.photoUrl || "",
      links: {
        promo: `/promo/${match.id}`,
        promoRendaExtra: `/promorendaextra/${match.id}`,
        dashboard: `/resumo/${match.id}`,
      },
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "admin_list") {
      if (!await isAdminRequest(req, body)) return json({ success: false, error: "Acesso administrativo obrigatório" }, 401);
      const affiliates = await loadAffiliates();
      const { data: pix, error } = await supabase.from("affiliate_pix").select("affiliate_id,pix_key,updated_at");
      if (error) throw error;
      return json({ success: true, affiliates: affiliates.map(a => ({ ...a, pixKey: pix?.find(p => p.affiliate_id === a.id)?.pix_key || "", pixUpdatedAt: pix?.find(p => p.affiliate_id === a.id)?.updated_at })) });
    }
    if (action === "resend_welcome") {
      const username = String(body.squarecloud_username || "").trim().toLowerCase();
      const validation = await validateSquareCloud(username, String(body.password || ""));
      if (!validation.ok) return json({ success: false, error: validation.error }, 401);
      const affiliate = (await loadAffiliates()).find(a => a.active && a.squarecloudUsername?.toLowerCase() === username);
      if (!affiliate) return json({ success: false, error: "Afiliado não encontrado" }, 403);
      const result = await sendEmail(affiliate.email, "Bem-vindo(a) ao Programa de Afiliados MRO", welcomeEmailHtml(affiliate.name, affiliate.id, affiliate.email));
      return json({ success: result.ok, welcomeEmailSent: result.ok, ...(result.ok ? {} : { error: "Seu cadastro está salvo, mas o e-mail não pôde ser enviado agora. Tente novamente." }) });
    }
    if (action === "save_pix") {
      const username = String(body.squarecloud_username || "").trim().toLowerCase();
      const validation = await validateSquareCloud(username, String(body.password || ""));
      if (!validation.ok) return json({ success: false, error: validation.error }, 401);
      const affiliate = (await loadAffiliates()).find(a => a.active && a.squarecloudUsername?.toLowerCase() === username);
      if (!affiliate) return json({ success: false, error: "Afiliado não encontrado" }, 403);
      const key = String(body.pix_key || "").trim();
      if (!key || key.length > 255) return json({ success: false, error: "Informe uma chave Pix válida (até 255 caracteres)" }, 400);
      const { error } = await supabase.from("affiliate_pix").upsert({ affiliate_id: affiliate.id, owner_username: username, pix_key: key, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ success: true, pixKey: key });
    }
    if (action === "register") return await actionRegister(body);
    if (action === "lookup") return await actionLookup(body);
    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[afiliadosx] fatal", e);
    return json({ success: false, error: e instanceof Error ? e.message : "Erro interno" }, 500);
  }
});
