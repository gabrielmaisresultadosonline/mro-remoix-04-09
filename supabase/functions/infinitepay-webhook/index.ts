import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { verifyInfinitePayWebhook } from "../_shared/webhook-security.ts";
import { sendRendaExtEmail } from "../_shared/rendaext-emails.ts";
import { sendRendaSaoVivoEmail } from "../_shared/rendasaovivo-email.ts";
import { sendSalaoBelEmail } from "../_shared/salaobel-email.ts";
import { sendDeliveryEmail } from "../_shared/delivery-email.ts";
import { sendLocalVppEmail } from "../_shared/localvpp-email.ts";
import { sendRenddxWelcomeEmail } from "../_shared/renddx-email.ts";
import { sendLotarGruposEmail } from "../_shared/lotargrupos-email.ts";
import { processWhitelabelPayment } from "../_shared/whitelabel-core.ts";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INFINITEPAY_HANDLE = "paguemro";
const META_PIXEL_ID = '569414052132145';
const META_API_VERSION = 'v18.0';

const log = (step: string, details?: unknown) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[${timestamp}] [INFINITEPAY-WEBHOOK] ${step}${detailsStr}`);
};

// Send Purchase event to Meta Conversions API
async function sendMetaPurchaseEvent(
  email: string,
  value: number,
  contentName: string,
  eventId?: string,
  sourceUrl: string = 'https://maisresultadosonline.com.br/mroobrigado',
  extra?: { fbc?: string | null; fbp?: string | null; user_agent?: string | null; client_ip?: string | null }
) {
  try {
    const accessToken = Deno.env.get('META_CONVERSIONS_API_TOKEN');
    if (!accessToken) {
      log("META: No access token configured, skipping Purchase event");
      return { ok: false, error: 'no_token' };
    }

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedEmail = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const user_data: Record<string, unknown> = { em: hashedEmail };
    if (extra?.fbc) user_data.fbc = extra.fbc;
    if (extra?.fbp) user_data.fbp = extra.fbp;
    if (extra?.user_agent) user_data.client_user_agent = extra.user_agent;
    if (extra?.client_ip) user_data.client_ip_address = extra.client_ip;

    const event = {
      event_name: 'Purchase',
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: sourceUrl,
      user_data,
      custom_data: {
        content_name: contentName,
        value: value,
        currency: 'BRL',
      },
    };

    const metaUrl = `https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`;
    const resp = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: accessToken }),
    });

    const result = await resp.json();
    log("META Purchase event sent", { email, value, contentName, success: resp.ok, result });
    return { ok: resp.ok, result };
  } catch (err) {
    log("META Purchase event error (non-blocking)", { error: String(err) });
    return { ok: false, error: String(err) };
  }
}

// Função para verificar pagamento via API da InfiniPay
async function verifyPaymentWithAPI(orderNsu: string, transactionNsu?: string, slug?: string): Promise<{ paid: boolean; data?: any }> {
  try {
    log("Verifying payment via InfiniPay API", { orderNsu, transactionNsu, slug });
    
    const response = await fetch(
      "https://api.checkout.infinitepay.io/payment_check",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: INFINITEPAY_HANDLE,
          order_nsu: orderNsu,
          ...(transactionNsu && { transaction_nsu: transactionNsu }),
          ...(slug && { slug: slug }),
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      log("InfiniPay API response", data);
      return { paid: data.paid === true, data };
    } else {
      log("InfiniPay API error", { status: response.status });
      return { paid: false };
    }
  } catch (error) {
    log("Error calling InfiniPay API", { error: String(error) });
    return { paid: false };
  }
}

// Função para salvar log do webhook
async function saveWebhookLog(
  supabase: any,
  logData: {
    event_type: string;
    order_nsu?: string | null;
    transaction_nsu?: string | null;
    email?: string | null;
    username?: string | null;
    affiliate_id?: string | null;
    amount?: number | null;
    status: string;
    payload?: any;
    result_message?: string | null;
    order_found?: boolean;
    order_id?: string | null;
  }
) {
  try {
    await supabase.from("infinitepay_webhook_logs").insert({
      event_type: logData.event_type,
      order_nsu: logData.order_nsu || null,
      transaction_nsu: logData.transaction_nsu || null,
      email: logData.email || null,
      username: logData.username || null,
      affiliate_id: logData.affiliate_id || null,
      amount: logData.amount || null,
      status: logData.status,
      payload: logData.payload || null,
      result_message: logData.result_message || null,
      order_found: logData.order_found || false,
      order_id: logData.order_id || null,
    });
    log("Webhook log saved");
  } catch (e) {
    log("Error saving webhook log", { error: String(e) });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Webhook received", { method: req.method });

    // Verify webhook signature for security
    const verification = await verifyInfinitePayWebhook(req, corsHeaders, "INFINITEPAY-WEBHOOK");
    if (!verification.verified) {
      return verification.response;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const body = verification.body;
    const nestedBody = body.data && typeof body.data === "object"
      ? body.data as Record<string, unknown>
      : {};
    log("Webhook payload", { body, nestedBody });

    const order_nsu = (body.order_nsu || body.orderNsu || nestedBody.order_nsu || nestedBody.orderNsu) as string | undefined;
    const transaction_nsu = (body.transaction_nsu || body.transactionNsu || nestedBody.transaction_nsu || nestedBody.transactionNsu) as string | undefined;
    const invoice_slug = (body.invoice_slug || body.invoiceSlug || body.slug || nestedBody.invoice_slug || nestedBody.invoiceSlug || nestedBody.slug) as string | undefined;
    const amount = (body.amount || nestedBody.amount) as number | undefined;
    const paid_amount = (body.paid_amount || body.paidAmount || nestedBody.paid_amount || nestedBody.paidAmount) as number | undefined;
    const capture_method = body.capture_method as string | undefined;
    const receipt_url = body.receipt_url as string | undefined;
    const items = (body.items || body.itens || nestedBody.items || nestedBody.itens) as Array<{ description?: string; name?: string }> | undefined;

    // Whitelabel MRO: taxas (WLFEE) e vendas por link de revendedor (WLSALE).
    {
      const wlItem = (items || []).map((i) => i.description || i.name || "").find((n) => /^WL(FEE|SALE)/.test(n));
      const wlNsu = (typeof order_nsu === "string" && /^WL(FEE|SALE)/.test(order_nsu)) ? order_nsu : wlItem;
      if (wlNsu) {
        const result = await processWhitelabelPayment(supabase, wlNsu);
        log("Whitelabel payment", { wlNsu, result });
        if (result.handled) {
          return new Response(JSON.stringify({ success: true, message: result.message }), { status: 200, headers: corsHeaders });
        }
      }
    }

    let email: string | null = null;
    let emailWithAffiliate: string | null = null;
    let username: string | null = null;
    let affiliateId: string | null = null;
    let isMROOrder = false;
    let isPromptsOrder = false;
    let isRendaExtOrder = false;
    let isVenderOrder = false;
    let isZapMROOrder = false;
    
    let isPostsComIAOrder = false;
    let isRendaSaoVivoOrder = false;
    let isSalaoBelOrder = false;
    let isDeliveryOrder = false;
    let isLocalVppOrder = false;
    let isZapMROUpgradeFee = false;
    let isHubOrder = false;
    let isLovablackOrder = false;
    let hubSlug: string | null = null;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const itemName = item.description || item.name || "";
        log("Processing item", { itemName });

        // Dashboard (hub de produtos) — formato: HUB_{slug}_{email}
        if (itemName.startsWith("HUB_")) {
          isHubOrder = true;
          const rest = itemName.slice(4);
          const sep = rest.lastIndexOf("_");
          if (sep > 0) {
            hubSlug = rest.slice(0, sep);
            email = rest.slice(sep + 1).toLowerCase();
          }
          log("Parsed HUB order", { hubSlug, email });
          break;
        }

        // Caso específico para o produto de audiobooks
        if (itemName.startsWith("AUDIIBOOKS_")) {
          isHubOrder = true;
          hubSlug = "audiibooks";
          email = itemName.replace("AUDIIBOOKS_", "").toLowerCase();
          log("Parsed AUDIIBOOKS order", { hubSlug, email });
          break;
        }

        if (itemName.startsWith("LOCALVPP_")) {

          isLocalVppOrder = true;
          email = itemName.replace("LOCALVPP_", "").toLowerCase();
          log("Parsed LOCALVPP order", { email });
          break;
        }

        if (itemName.startsWith("DELIVERY_")) {
          isDeliveryOrder = true;
          email = itemName.replace("DELIVERY_", "").toLowerCase();
          log("Parsed DELIVERY order", { email });
          break;
        }

        if (itemName.startsWith("LOVABLACK_")) {
          isLovablackOrder = true;
          email = itemName.replace("LOVABLACK_", "").toLowerCase();
          log("Parsed LOVABLACK order", { email });
          break;
        }

        if (itemName.startsWith("SALAOBEL_")) {
          isSalaoBelOrder = true;
          email = itemName.replace("SALAOBEL_", "").toLowerCase();
          log("Parsed SALAOBEL order", { email });
          break;
        }

        if (itemName.startsWith("RENDASAOVIVO_")) {
          isRendaSaoVivoOrder = true;
          email = itemName.replace("RENDASAOVIVO_", "").toLowerCase();
          log("Parsed RENDASAOVIVO order", { email });
          break;
        }

        if (itemName.startsWith("POSTSCOMIA_")) {
          isPostsComIAOrder = true;
          email = itemName.replace("POSTSCOMIA_BUMP_", "").replace("POSTSCOMIA_", "").toLowerCase();
          log("Parsed POSTSCOMIA order", { email });
          break;
        }

        if (itemName.startsWith("VENDER_")) {
          isVenderOrder = true;
          email = itemName.replace("VENDER_", "").toLowerCase();
          log("Parsed VENDER order", { email });
          break;
        }

        if (itemName.startsWith("RENDAEXT_")) {
          isRendaExtOrder = true;
          email = itemName.replace("RENDAEXT_", "").toLowerCase();
          log("Parsed RENDAEXT order", { email });
          break;
        }

        if (itemName.startsWith("PROMPTS_")) {
          isPromptsOrder = true;
          email = itemName.replace("PROMPTS_", "").toLowerCase();
          log("Parsed PROMPTS order", { email });
          break;
        }

        
        if (itemName.startsWith("ZAPMRO_") || itemName.startsWith("LOTARGRUPOS_")) {
          isZapMROOrder = true;

          // ZAPMRO_{PLAN}_{USERNAME}_{EMAIL} ou ZAPMRO_{PLAN}_{USERNAME}_{EMAIL}_BUMPS:{BUMPS}
          const parts = itemName.split("_");
          if (parts.length >= 4) {
            username = parts[2];
            email = parts[3].toLowerCase();
          }
          log("Parsed ZAPMRO order", { username, email });
          break;
        }

        if (itemName.startsWith("ZAPTAXA_")) {
          isZapMROUpgradeFee = true;
          // ZAPTAXA_{USERNAME}_{EMAIL}
          const parts = itemName.split("_");
          if (parts.length >= 3) {
            username = parts[1].toLowerCase().trim();
            email = parts.slice(2).join("_").toLowerCase().trim();
          }
          log("Parsed ZAPMRO Upgrade Fee order", { username, email });
          
          // Se tivermos um email, tentamos encontrar um usuario com esse email 
          // caso o username não bata exatamente.
          if (email && !username) {
             const { data: userData } = await supabase
               .from("zapmro_users")
               .select("username")
               .eq("email", email)
               .maybeSingle();
             if (userData) {
               username = userData.username.toLowerCase().trim();
               log("Inferred username from email", { username });
             }
          }
          break;
        }

        if (itemName.startsWith("MROIG_")) {
          isMROOrder = true;
          const parts = itemName.split("_");
          if (parts.length >= 4) {
            username = parts[2];
            emailWithAffiliate = parts.slice(3).join("_").toLowerCase();
            
            if (emailWithAffiliate && emailWithAffiliate.includes(":") && emailWithAffiliate.includes("@")) {
              const colonIndex = emailWithAffiliate.indexOf(":");
              const potentialAffiliate = emailWithAffiliate.substring(0, colonIndex);
              const potentialEmail = emailWithAffiliate.substring(colonIndex + 1);
              
              if (potentialEmail.includes("@")) {
                affiliateId = potentialAffiliate;
                email = potentialEmail;
                log("Detected affiliate sale", { affiliateId, realEmail: email });
              } else {
                email = emailWithAffiliate;
              }
            } else if (emailWithAffiliate) {
              email = emailWithAffiliate;
            }
          }
          log("Parsed MRO order", { username, email, emailWithAffiliate, affiliateId });
          break;
        }
        else if (itemName.startsWith("MRO_")) {
          email = itemName.replace("MRO_", "").toLowerCase();
          emailWithAffiliate = email;
          break;
        }
      }
    }

    log("Parsed webhook data", { 
      order_nsu, 
      transaction_nsu, 
      email, 
      isRendaExtOrder,
      isPromptsOrder,
      isMROOrder,
      amount, 
      paid_amount
    });

    // DASHBOARD (hub de produtos) - Handled below in the unified HUB logic
    if (isHubOrder || (order_nsu && typeof order_nsu === "string" && (order_nsu.startsWith("HUB") || order_nsu.startsWith("HUB_TRAFEGOPAGO") || order_nsu.startsWith("AUDIIBOOKS")))) {
      // Logic handled at the end of the script to ensure all flags are set
    }

    // VENDER NA INTERNET orders

    if (isVenderOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("VENDER"))) {
      log("Processing as VENDER order", { order_nsu, email });

      let vp = null;
      if (order_nsu) {
        const r = await supabase
          .from("vender_pagamentos")
          .select("*, vender_usuarios(*)")
          .eq("infinitepay_transaction_id", order_nsu)
          .eq("status", "pendente")
          .maybeSingle();
        vp = r.data;
      }
      if (!vp && email) {
        const r = await supabase
          .from("vender_usuarios")
          .select("id, email, vender_pagamentos!inner(*)")
          .eq("email", email)
          .eq("vender_pagamentos.status", "pendente")
          .maybeSingle();
        if (r.data && (r.data as any).vender_pagamentos?.length) {
          vp = {
            ...(r.data as any).vender_pagamentos[0],
            vender_usuarios: { id: (r.data as any).id, email: (r.data as any).email },
          };
        }
      }

      if (vp) {
        await supabase.from("vender_pagamentos").update({
          status: "pago",
          updated_at: new Date().toISOString(),
        }).eq("id", vp.id);

        await supabase.from("vender_usuarios").update({
          acesso_liberado: true,
        }).eq("id", vp.usuario_id);

        await sendMetaPurchaseEvent(
          email || vp.vender_usuarios?.email || "",
          Number(vp.valor) || 25,
          "MRO Vender Na Internet",
          order_nsu
        );

        // Fire-and-forget welcome email with credentials + grupo link
        try {
          await supabase.functions.invoke("vender-send-email", {
            body: { user_id: vp.usuario_id },
          });
          log("VENDER welcome email triggered");
        } catch (e) {
          log("VENDER welcome email error (non-blocking)", { error: String(e) });
        }

        log("VENDER order confirmed", { paymentId: vp.id, userId: vp.usuario_id });
        return new Response(JSON.stringify({ success: true, message: "VENDER confirmed" }), { status: 200, headers: corsHeaders });
      }
      log("VENDER: no pending payment found");
    }

    // RENDAEXT orders
    if (isRendaExtOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("RENDAEXT"))) {
      log("Processing as RENDAEXT order", { order_nsu, email });

      
      const { data: order } = await supabase
        .from("rendaext_orders")
        .select("*")
        .eq("nsu_order", order_nsu)
        .eq("status", "pending")
        .maybeSingle();

      if (order) {
        // Send email
        const emailSent = await sendRendaExtEmail(order.email, order.nome_completo);

        await supabase.from("rendaext_orders").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          email_sent: emailSent,
          email_sent_at: emailSent ? new Date().toISOString() : null,
        }).eq("id", order.id);

        await sendMetaPurchaseEvent(
          email || order.email,
          order.amount || 19.90,
          "Renda Extra - Aula",
          order.nsu_order
        );

        log("RENDAEXT order confirmed, email sent and tracked", { orderId: order.id, emailSent });
        
        return new Response(JSON.stringify({ success: true, message: "RENDAEXT confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // PROMPTS MRO orders
    if (isPromptsOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("PROMPTS"))) {
      log("Processing as PROMPTS order", { order_nsu, email });
      let promptsOrder = null;
      if (order_nsu) {
        const result = await supabase.from("prompts_mro_payment_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
        promptsOrder = result.data;
      }
      if (!promptsOrder && email) {
        const result = await supabase.from("prompts_mro_payment_orders").select("*").eq("email", email).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
        promptsOrder = result.data;
      }

      if (promptsOrder) {
        await supabase.from("prompts_mro_payment_orders").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", promptsOrder.id);
        const isMonthly = promptsOrder.amount <= 50;
        const planDays = isMonthly ? 30 : 365;
        const planLabel = isMonthly ? 'PRO Mensal (30 dias)' : 'PRO Anual (365 dias)';
        const subscriptionEnd = new Date(Date.now() + planDays * 24 * 60 * 60 * 1000).toISOString();
        if (promptsOrder.user_id) {
          await supabase.from("prompts_mro_users").update({ is_paid: true, paid_at: new Date().toISOString(), subscription_end: subscriptionEnd }).eq("id", promptsOrder.user_id);
        }
        await sendMetaPurchaseEvent(promptsOrder.email, promptsOrder.amount || 47, `Prompts MRO ${planLabel}`, promptsOrder.nsu_order);
        return new Response(JSON.stringify({ success: true, message: "PROMPTS Payment confirmed" }), { headers: corsHeaders, status: 200 });
      }
    }

    // MRO order
    if (isMROOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("MROIG"))) {
      log("Processing as MRO order");
      let mroOrder = null;
      if (order_nsu) {
        const result = await supabase.from("mro_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
        mroOrder = result.data;
      }
      if (mroOrder) {
        await supabase.from("mro_orders").update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", mroOrder.id);
        // REMOVED: sendMetaPurchaseEvent is now sent ONLY when order is "completed" in mro-payment-webhook
        // to avoid duplicate tracking and ensure only truly complete sales are counted.
        try {
          await supabase.functions.invoke("mro-payment-webhook", { body: { order_nsu: mroOrder.nsu_order, paid: true, status: "paid", items: [{ description: `MROIG_${mroOrder.plan_type === "lifetime" ? "VITALICIO" : mroOrder.plan_type === "trial" ? "TRIAL" : mroOrder.plan_type === "monthly" ? "MENSAL" : "ANUAL"}_${mroOrder.username}_${mroOrder.email}` }] } });
        } catch (e) { log("Error invoking MRO webhook", e); }
        return new Response(JSON.stringify({ success: true, message: "MRO Payment confirmed" }), { headers: corsHeaders, status: 200 });
      }
    }

    // POSTSCOMIA orders
    if (isPostsComIAOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("POSTSCOMIA"))) {
      log("Processing as POSTSCOMIA order", { order_nsu, email });
      let pcOrder = null;
      if (order_nsu) {
        const r = await supabase.from("postscomia_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
        pcOrder = r.data;
      }
      if (!pcOrder && email) {
        const r = await supabase.from("postscomia_orders").select("*").eq("email", email).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
        pcOrder = r.data;
      }
      if (pcOrder) {
        await supabase.from("postscomia_orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", pcOrder.id);
        await sendMetaPurchaseEvent(pcOrder.email, Number(pcOrder.amount) || 67, "Posts com IA", pcOrder.nsu_order, "https://maisresultadosonline.com.br/postscomia");
        return new Response(JSON.stringify({ success: true, message: "POSTSCOMIA confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // LOVABLACK orders (plano mensal R$97) — provisiona acesso automaticamente
    if (isLovablackOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("LOVABLACK"))) {
      log("Processing as LOVABLACK order", { order_nsu, email });
      let lbOrder: any = null;
      if (order_nsu) {
        const r = await supabase.from("lovablack_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
        lbOrder = r.data;
      }
      if (!lbOrder && email) {
        const r = await supabase.from("lovablack_orders").select("*").eq("email", email)
          .eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
        lbOrder = r.data;
      }
      if (lbOrder) {
        // Cria (ou reativa) o usuário da extensão com plano mensal
        const { data: existingUser } = await supabase.from("lovablack_users")
          .select("id").eq("email", lbOrder.email).maybeSingle();

        if (existingUser) {
          await supabase.from("lovablack_users").update({
            name: lbOrder.name,
            password: lbOrder.password,
            whatsapp: lbOrder.whatsapp,
            plan_type: "monthly",
            blocked: false,
          }).eq("id", existingUser.id);
        } else {
          const { error: userError } = await supabase.from("lovablack_users").insert({
            name: lbOrder.name,
            email: lbOrder.email,
            password: lbOrder.password,
            whatsapp: lbOrder.whatsapp,
            plan_type: "monthly",
          });
          if (userError) log("Error creating LOVABLACK user", userError);
        }

        await sendMetaPurchaseEvent(
          lbOrder.email,
          Number(lbOrder.amount) || 97,
          "Lovablack Mensal",
          lbOrder.nsu_order,
          "https://maisresultadosonline.com.br/lovablack"
        );

        await supabase.from("lovablack_orders").update({
          status: "paid",
          paid_at: new Date().toISOString(),
        }).eq("id", lbOrder.id);

        return new Response(JSON.stringify({ success: true, message: "LOVABLACK confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // RENDASAOVIVO orders
    if (isRendaSaoVivoOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("RENDASAOVIVO"))) {
      log("Processing as RENDASAOVIVO order", { order_nsu, email });
      let rsvOrder: any = null;
      if (order_nsu) {
        const r = await supabase.from("rendasaovivo_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
        rsvOrder = r.data;
      }
      if (!rsvOrder && email) {
        const r = await supabase.from("rendasaovivo_orders").select("*").eq("email", email).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
        rsvOrder = r.data;
      }
      if (rsvOrder) {
        const { data: settings } = await supabase.from("rendasaovivo_settings").select("*").limit(1).maybeSingle();
        const emailSent = await sendRendaSaoVivoEmail(
          rsvOrder.email,
          rsvOrder.nome_completo,
          settings?.whatsapp_group_link || "#",
          settings?.aula_data || "18/07"
        );
        const metaRes = await sendMetaPurchaseEvent(
          rsvOrder.email,
          Number(rsvOrder.amount) || 19,
          "Renda Ao Vivo",
          rsvOrder.nsu_order,
          "https://maisresultadosonline.com.br/rendasaovivo",
          { fbc: rsvOrder.fbc, fbp: rsvOrder.fbp, user_agent: rsvOrder.user_agent }
        );
        await supabase.from("rendasaovivo_orders").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          email_sent: emailSent,
          email_sent_at: emailSent ? new Date().toISOString() : null,
          pixel_sent: !!metaRes?.ok,
          pixel_sent_at: metaRes?.ok ? new Date().toISOString() : null,
        }).eq("id", rsvOrder.id);
        return new Response(JSON.stringify({ success: true, message: "RENDASAOVIVO confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // SALAOBEL orders
    if (isSalaoBelOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("SALAOBEL"))) {
      log("Processing as SALAOBEL order", { order_nsu, email });
      let sbOrder: any = null;
      if (order_nsu) {
        const r = await supabase.from("salaobel_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
        sbOrder = r.data;
      }
      if (!sbOrder && email) {
        const r = await supabase.from("salaobel_orders").select("*").eq("email", email).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
        sbOrder = r.data;
      }
      if (sbOrder) {
        const { data: settings } = await supabase.from("salaobel_settings").select("*").limit(1).maybeSingle();
        const emailSent = await sendSalaoBelEmail(
          sbOrder.email,
          sbOrder.nome_completo,
          settings?.whatsapp_group_link || "#",
          settings?.aula_data || "16/07"
        );
        const metaRes = await sendMetaPurchaseEvent(
          sbOrder.email,
          Number(sbOrder.amount) || Number(settings?.preco) || 10,
          "Salão Bel",

          sbOrder.nsu_order,
          "https://maisresultadosonline.com.br/salaobel",
          { fbc: sbOrder.fbc, fbp: sbOrder.fbp, user_agent: sbOrder.user_agent }
        );
        await supabase.from("salaobel_orders").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          email_sent: emailSent,
          email_sent_at: emailSent ? new Date().toISOString() : null,
          pixel_sent: !!metaRes?.ok,
          pixel_sent_at: metaRes?.ok ? new Date().toISOString() : null,
        }).eq("id", sbOrder.id);
        return new Response(JSON.stringify({ success: true, message: "SALAOBEL confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // DELIVERY orders
    if (isDeliveryOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("DELIVERY"))) {
      log("Processing as DELIVERY order", { order_nsu, email });
      let dOrder: any = null;
      if (order_nsu) {
        const r = await supabase.from("delivery_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
        dOrder = r.data;
      }
      if (!dOrder && email) {
        const r = await supabase.from("delivery_orders").select("*").eq("email", email).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
        dOrder = r.data;
      }
      if (dOrder) {
        const { data: settings } = await supabase.from("delivery_settings").select("*").limit(1).maybeSingle();
        const emailSent = await sendDeliveryEmail(
          dOrder.email,
          dOrder.nome_completo,
          settings?.whatsapp_group_link || "#",
          settings?.aula_data || "18/07"
        );
        const metaRes = await sendMetaPurchaseEvent(
          dOrder.email,
          Number(dOrder.amount) || Number(settings?.preco) || 19,
          "Delivery MRO",
          dOrder.nsu_order,
          "https://maisresultadosonline.com.br/delivery",
          { fbc: dOrder.fbc, fbp: dOrder.fbp, user_agent: dOrder.user_agent }
        );
        await supabase.from("delivery_orders").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          email_sent: emailSent,
          email_sent_at: emailSent ? new Date().toISOString() : null,
          pixel_sent: !!metaRes?.ok,
          pixel_sent_at: metaRes?.ok ? new Date().toISOString() : null,
        }).eq("id", dOrder.id);
        return new Response(JSON.stringify({ success: true, message: "DELIVERY confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // LOCALVPP orders
    if (isLocalVppOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("LOCALVPP"))) {
      log("Processing as LOCALVPP order", { order_nsu, email });
      let lOrder: any = null;
      if (order_nsu) {
        const r = await supabase.from("localvpp_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
        lOrder = r.data;
      }
      if (!lOrder && email) {
        const r = await supabase.from("localvpp_orders").select("*").eq("email", email).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
        lOrder = r.data;
      }
      if (lOrder) {
        const { data: settings } = await supabase.from("localvpp_settings").select("*").limit(1).maybeSingle();
        const emailSent = await sendLocalVppEmail(
          lOrder.email,
          lOrder.nome_completo,
          settings?.whatsapp_group_link || "#",
          settings?.aula_data || "20/07"
        );
        const metaRes = await sendMetaPurchaseEvent(
          lOrder.email,
          Number(lOrder.amount) || Number(settings?.preco) || 10,
          "LocalVPP MRO",
          lOrder.nsu_order,
          "https://maisresultadosonline.com.br/localvpp",
          { fbc: lOrder.fbc, fbp: lOrder.fbp, user_agent: lOrder.user_agent }
        );
        await supabase.from("localvpp_orders").update({
          status: "paid",
          paid_at: new Date().toISOString(),
          email_sent: emailSent,
          email_sent_at: emailSent ? new Date().toISOString() : null,
          pixel_sent: !!metaRes?.ok,
          pixel_sent_at: metaRes?.ok ? new Date().toISOString() : null,
        }).eq("id", lOrder.id);
        return new Response(JSON.stringify({ success: true, message: "LOCALVPP confirmed" }), { status: 200, headers: corsHeaders });
      }
    }




    // TRAFEGOPAGOVISITAS / HUB orders
    if (isHubOrder || (order_nsu && typeof order_nsu === 'string' && (order_nsu.startsWith("HUB") || order_nsu.startsWith("HUB_TRAFEGOPAGO") || order_nsu.startsWith("AUDIIBOOKS")))) {
      log("Processing as HUB order", { order_nsu, email, hubSlug });

      let hubOrder: Record<string, unknown> | null = null;
      if (order_nsu) {
        const r = await supabase.from("hub_orders").select("*").eq("nsu_order", order_nsu).maybeSingle();
        hubOrder = r.data;
      }
      if (!hubOrder && email) {
        const r = await supabase
          .from("hub_orders")
          .select("*")
          .eq("email", email)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        hubOrder = r.data;
      }

      if (hubOrder) {
        const slug = (hubOrder.product_slug as string) || hubSlug;
        
        await supabase
          .from("hub_orders")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", hubOrder.id as string);

        if (hubOrder.product_id) {
          // Garante acesso por 1 ano
          await supabase.from("hub_access").insert({
            product_id: hubOrder.product_id as string,
            email: (hubOrder.email as string) || email,
            source: "purchase",
            status: 'active',
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          });
        }
        
        // Dispara e-mail de boas-vindas
        try {
          if (slug === "renddx" || (order_nsu && order_nsu.startsWith("HUB_RENDDX"))) {
            const { data: userData } = await supabase
              .from("zapmro_users")
              .select("username, password_plain")
              .eq("email", (hubOrder.email as string) || email)
              .maybeSingle();

            await sendRenddxWelcomeEmail(
              (hubOrder.email as string) || email || "",
              (hubOrder.name as string) || "Cliente",
              userData?.username || (hubOrder.name as string)?.toLowerCase().replace(/\s/g, "") || "usuario",
              userData?.password_plain || "mro123"
            );
          } else {
            await supabase.functions.invoke("delivery-email", {
              body: { 
                email: (hubOrder.email as string) || email,
                name: (hubOrder.name as string) || "Cliente",
                product_title: slug === "audiibooks" ? "O SEGREDO PARA VENDER MAIS !" : "Tráfego Pago (Visitas no Perfil)",
                dashboard_url: "https://maisresultadosonline.com.br/dashboard",
                type: "welcome_hub"
              }
            });
          }
        } catch (e) { log("Error sending welcome email", e); }
        
        // Track Meta Purchase Event for HUB orders
        await sendMetaPurchaseEvent(
          (hubOrder.email as string) || email || "",
          Number(hubOrder.amount) || 300,
          slug === "audiibooks" ? "O SEGREDO PARA VENDER MAIS !" : slug === "renddx" ? "Renddx - Plano 30 Dias" : "Produto Hub",
          hubOrder.nsu_order as string,
          slug === "audiibooks" 
            ? `https://maisresultadosonline.com.br/audiobooks/obrigado?paid=1`
            : `https://maisresultadosonline.com.br/mroobrigado?paid=1`
        );

        log("HUB order paid + access granted + email triggered + Meta tracked", { id: hubOrder.id });
        return new Response(JSON.stringify({ success: true, message: "HUB confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // ZAPMRO orders
    if (isZapMROOrder || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("ZAPMRO"))) {
      log("Processing as ZAPMRO order", { order_nsu, email, username });
      
      let zapOrder: any = null;
      if (order_nsu) {
        const { data } = await supabase.from("zapmro_orders").select("*").eq("nsu_order", order_nsu).maybeSingle();
        zapOrder = data;
      }
      
      if (!zapOrder && email) {
        const { data } = await supabase.from("zapmro_orders").select("*").eq("email", email.toLowerCase()).eq("status", "pending").maybeSingle();
        zapOrder = data;
      }

      if (zapOrder) {
        const uEmail = (zapOrder.email || email || "").toLowerCase();
        const uName = zapOrder.username || username || uEmail.split('@')[0];
        const planType = (zapOrder.plan_type || "annual").toLowerCase();
        const passwordPlain = uName.toLowerCase(); // Usuário é o mesmo que a senha, minúsculo

        
        // Hash for internal DB
        const data = new TextEncoder().encode(passwordPlain);
        const digest = await crypto.subtle.digest("SHA-256", data);
        const passwordHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

        const days = planType === 'lifetime' || planType === 'vitalicio' ? 999999 : (planType === 'monthly' || planType === 'mensal' ? 30 : 365);
        
        // Create user in zapmro_users (admin panel DB)
        const { data: newUser, error: userErr } = await supabase.from("zapmro_users").upsert({
          username: uName,
          email: uEmail,
          password_hash: passwordHash,
          password_plain: passwordPlain,
          days_remaining: days,
          expires_at: days >= 3650 ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
          whatsapp_limit: planType === 'lifetime' || planType === 'vitalicio' ? -1 : 2
        }, { onConflict: 'username' }).select().single();

        if (userErr) log("Error creating ZAPMRO user", userErr);

        // Update order status
        await supabase.from("zapmro_orders").update({ 
          status: "paid", 
          paid_at: new Date().toISOString() 
        }).eq("id", zapOrder.id);

        // Process order bumps for ZAPMRO
        const itemName = items?.[0]?.description || items?.[0]?.name || "";
        if (itemName.includes("_BUMPS:")) {
          const bumpsPart = itemName.split("_BUMPS:")[1];
          const bumps = bumpsPart.split("+");
          
          for (const bumpSlug of bumps) {
            log(`Processing bump: ${bumpSlug} for ${uEmail}`);
            const { data: prod } = await supabase.from("hub_products").select("id").eq("slug", bumpSlug).maybeSingle();
            if (prod) {
              await supabase.from("hub_access").insert({
                product_id: prod.id,
                email: uEmail,
                source: "order_bump",
                status: 'active',
                expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              });
              
              if (bumpSlug === 'audiibooks') {
                await supabase.from("audiobooks_orders").insert({
                  email: uEmail,
                  name: uName,
                  whatsapp: zapOrder.phone || "",
                  amount: 0, // Inclusivo no total do ZAPMRO
                  order_nsu: zapOrder.nsu_order,
                  has_bump_lifetime: true
                });
              }
            }
          }
        }

        // Provisionamento automático completo (mesmo fluxo do "Aprovar Manual"):
        // cria o usuário na API externa da ferramenta, envia o e-mail de acesso
        // e marca o pedido como "completed".
        try {
          const { data: provisionData, error: provisionError } = await supabase.functions.invoke(
            "zapmro-payment-webhook",
            {
              headers: {
                "x-internal-call": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
              },
              body: {
                order_id: zapOrder.id,
                order_nsu: zapOrder.nsu_order,
                manual_approve: true,
                items: [{
                  description: `ZAPMRO_${planType === "lifetime" || planType === "vitalicio" ? "VITALICIO" : planType === "monthly" || planType === "mensal" ? "MENSAL" : "ANUAL"}_${uName}_${uEmail}`,
                }],
              },
            },

          );
          if (provisionError) throw provisionError;
          log("ZAPMRO auto-provisioning done", provisionData);
        } catch (e) {
          log("Error on ZAPMRO auto-provisioning, falling back to send_access", e);
          // Fallback: pelo menos garante o envio das credenciais por e-mail.
          try {
            await supabase.functions.invoke("zapmro-api", {
              body: { action: "send_access", id: newUser?.id },
            });
          } catch (e2) { log("Fallback send_access failed", e2); }
        }


        // Meta Tracking (Server-side CAPI)
        await sendMetaPurchaseEvent(
          uEmail,
          Number(zapOrder.amount) || 67,
          `ZAPMRO ${planType}`,
          zapOrder.nsu_order,
          "https://maisresultadosonline.com.br/zapmro/vendas/obrigado",
          { 
            user_agent: zapOrder.user_agent || null,
            client_ip: zapOrder.client_ip || null
          }
        );

        return new Response(JSON.stringify({ success: true, message: "ZAPMRO confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // LOTARGRUPOS orders
    if (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("LOTARGRUPOS")) {
      log("Processing as LOTARGRUPOS order", { order_nsu, email, username });
      
      let lgOrder: any = null;
      if (order_nsu) {
        const { data } = await supabase.from("zapmro_orders").select("*").eq("nsu_order", order_nsu).maybeSingle();
        lgOrder = data;
      }
      
      if (!lgOrder && email) {
        const { data } = await supabase.from("zapmro_orders").select("*").eq("email", email.toLowerCase()).eq("status", "pending").maybeSingle();
        lgOrder = data;
      }

      if (lgOrder) {
        const uEmail = (lgOrder.email || email || "").toLowerCase();
        const uName = lgOrder.username || username || uEmail.split('@')[0];
        const passwordPlain = (lgOrder.metadata as any)?.password_plain || uName.toLowerCase(); 

        // 1. Logic for lotargrupos_users
        // First check if user exists in auth for the membership area
        const { data: authUser } = await supabase.auth.admin.getUserByEmail(uEmail);
        
        if (!authUser?.user) {
          log("Creating auth user for Lotar Grupos membership", { uEmail });
          const { data: newAuth, error: authErr } = await supabase.auth.admin.createUser({
            email: uEmail,
            password: passwordPlain,
            email_confirm: true,
            user_metadata: { full_name: uName }
          });
          if (authErr) log("Error creating auth user", authErr);
        }

        const { data: newUser, error: userErr } = await supabase.from("lotargrupos_users").upsert({
          name: uName,
          email: uEmail,
          status: 'active'
        }, { onConflict: 'email' }).select().single();

        if (userErr) log("Error creating LOTARGRUPOS user", userErr);

        // 2. Update order status
        await supabase.from("zapmro_orders").update({ 
          status: "paid", 
          paid_at: new Date().toISOString() 
        }).eq("id", lgOrder.id);

        // 3. Send Welcome Email
        const emailSent = await sendLotarGruposEmail(uEmail, uName, passwordPlain);
        log("LOTARGRUPOS welcome email status", { emailSent });

        // 4. Meta Tracking
        await sendMetaPurchaseEvent(
          uEmail,
          Number(lgOrder.amount) || 37,
          "Lotar Grupos",
          lgOrder.nsu_order,
          "https://maisresultadosonline.com.br/lotargrupos/obrigado",
          { 
            user_agent: lgOrder.user_agent || null,
            client_ip: lgOrder.client_ip || null
          }
        );

        return new Response(JSON.stringify({ success: true, message: "LOTARGRUPOS confirmed" }), { status: 200, headers: corsHeaders });
      }
    }

    // ZAPMRO Upgrade Fee orders (taxa de atualização)
    if (isZapMROUpgradeFee || (order_nsu && typeof order_nsu === 'string' && order_nsu.startsWith("ZAPTAXA"))) {

      log("Processing as ZAPMRO Upgrade Fee order", {
        order_nsu,
        transaction_nsu,
        invoice_slug,
        email,
        username,
        amount,
        paid_amount,
      });
      
      let feeOrder: any = null;
      if (order_nsu) {
        const { data } = await supabase.from("zapmro_upgrade_fees").select("*").eq("nsu_order", order_nsu).maybeSingle();
        feeOrder = data;
      }
      
      if (!feeOrder && username) {
        // Fallback somente pelo usuário do item. Nunca pelo e-mail, pois contas
        // distintas podem compartilhar o mesmo endereço.
        const { data } = await supabase.from("zapmro_upgrade_fees").select("*").eq("username", username).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
        feeOrder = data;
      }

      if (feeOrder) {
        log("Found ZAPTAXA order to confirm", { feeId: feeOrder.id, currentStatus: feeOrder.status });
        
        // O formato do webhook varia e nem sempre inclui `paid: true`. Confirme
        // pela API oficial usando os identificadores recebidos antes de liberar.
        const paidFlag = body.paid === true || nestedBody.paid === true || body.status === 'paid' || nestedBody.status === 'paid';
        const paymentVerification = await verifyPaymentWithAPI(
          feeOrder.nsu_order,
          transaction_nsu,
          invoice_slug,
        );
        const isPaidInWebhook = paidFlag || paymentVerification.paid;
        
        if (!isPaidInWebhook) {
          log("Webhook notification received but status is not paid, ignoring update", { 
            orderNsu: order_nsu, 
            bodyStatus: body.status,
            paidFlag: body.paid,
            verification: paymentVerification.data,
          });
          return new Response(JSON.stringify({ success: true, message: "Webhook ignored (not paid)" }), { status: 200, headers: corsHeaders });
        }

        const { error: feeUpdateError } = await supabase.from("zapmro_upgrade_fees").update({ 
          status: "paid", 
          paid_at: new Date().toISOString()
        }).eq("id", feeOrder.id);

        if (feeUpdateError) {
          log("ZAPMRO Upgrade Fee update failed", {
            orderNsu: order_nsu,
            feeId: feeOrder.id,
            error: feeUpdateError.message,
          });
          return new Response(
            JSON.stringify({ success: false, error: "Failed to update ZAPMRO fee" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        log("ZAPMRO Upgrade Fee confirmed via Webhook", {
          orderNsu: order_nsu,
          transactionNsu: transaction_nsu,
          username: feeOrder.username,
        });
        
        // Meta Tracking
        await sendMetaPurchaseEvent(
          feeOrder.email || email || "",
          Number(feeOrder.amount) || 67,
          "ZAPMRO Taxa de Atualização",
          feeOrder.nsu_order || order_nsu,
          "https://maisresultadosonline.com.br/zapmro"
        );

        return new Response(
          JSON.stringify({ success: true, message: "ZAPMRO Upgrade Fee confirmed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      log("ZAPMRO Upgrade Fee order not found", { order_nsu, username, email });
    }

    // Default payment orders
    let order = null;
    if (order_nsu) {
      const result = await supabase.from("payment_orders").select("*").eq("nsu_order", order_nsu).eq("status", "pending").maybeSingle();
      order = result.data;
    }
    if (order) {
      await supabase.from("payment_orders").update({ status: "paid", paid_at: new Date().toISOString(), verified_at: new Date().toISOString() }).eq("id", order.id);
      await sendMetaPurchaseEvent(order.email, order.amount || 300, 'MRO Payment', order.nsu_order);
      return new Response(JSON.stringify({ success: true, message: "Payment confirmed" }), { headers: corsHeaders, status: 200 });
    }

    return new Response(JSON.stringify({ success: false, error: "No pending order found" }), { headers: corsHeaders, status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { headers: corsHeaders, status: 400 });
  }
});
