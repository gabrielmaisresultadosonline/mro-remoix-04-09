/**
 * API do Whitelabel MRO.
 * - Ações públicas: `login`, `public_link_info`, `public_checkout`.
 * - Ações do revendedor: token HMAC (escopo whitelabel-reseller) em `token`.
 * - Ações `admin_*`: sessão do /admin principal (require-admin.ts).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveMroAdminCredentials } from "../_shared/mro-admin-credentials.ts";
import { createAdminSessionToken, verifyAdminSessionToken } from "../_shared/admin-session.ts";
import { isAdminRequest } from "../_shared/require-admin.ts";
import {
  WL_FEES, WL_PRICES, WlPlan, isEmail, normEmail, normUser, provisionClient, sha256, processWhitelabelPayment,
} from "../_shared/whitelabel-core.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const SCOPE = "whitelabel-reseller";
const BUCKET = "whitelabel-files";
const SITE = "https://maisresultadosonline.com.br";
const HANDLE = "paguemro";
const asPlan = (v: unknown): WlPlan | null => (v === "annual" || v === "lifetime" ? v : null);
const genNsu = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

type WlDb = ReturnType<typeof createClient>;
async function logoUrl(db: WlDb, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 86400);
  return data?.signedUrl ?? null;
}

async function handleLogo(db: WlDb, id: string, action: string, body: Record<string, unknown>): Promise<Response> {
  if (action.endsWith('logo_upload_url')) {
    const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    const extension = extensions[String(body.content_type)];
    if (!extension) return json({ success: false, error: 'Formato de logo inválido' }, 400);
    const path = `${id}/logos/${crypto.randomUUID()}.${extension}`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return json({ success: false, error: 'Não foi possível preparar o envio' }, 500);
    return json({ success: true, path, token: data.token });
  }
  const path = String(body.path ?? '');
  // A signed upload only authorizes this reseller's logo directory.
  if (!path.startsWith(`${id}/logos/`) || path.includes('..') || !/\.(png|jpg|webp)$/.test(path))
    return json({ success: false, error: 'Logo inválida' }, 400);
  const { data: file, error: fileError } = await db.storage.from(BUCKET).download(path);
  if (fileError || !file || file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    return json({ success: false, error: 'Envie uma logo PNG, JPG ou WebP de até 5 MB' }, 400);
  const { error } = await db.from('whitelabel_resellers').update({ brand_logo_path: path }).eq('id', id);
  return error ? json({ success: false, error: 'Não foi possível salvar a logo' }, 500) : json({ success: true });
}

async function createInfinitePayLink(nsu: string, cents: number, email: string, redirect: string): Promise<string> {
  const webhook = `${Deno.env.get("SUPABASE_URL")}/functions/v1/infinitepay-webhook`;
  const items = [{ description: nsu, quantity: 1, price: cents }];
  try {
    const r = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: HANDLE, items, itens: items, order_nsu: nsu, redirect_url: redirect, webhook_url: webhook, customer: { email } }),
    });
    const d = await r.json().catch(() => ({}));
    const url = d.checkout_url || d.link || d.url;
    if (r.ok && url) return url;
  } catch (_) { /* fallback abaixo */ }
  const enc = encodeURIComponent(JSON.stringify([{ name: nsu, price: cents, quantity: 1 }]));
  return `https://checkout.infinitepay.io/${HANDLE}?items=${enc}&order_nsu=${nsu}&redirect_url=${encodeURIComponent(redirect)}&webhook_url=${encodeURIComponent(webhook)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const { sessionSecret } = resolveMroAdminCredentials();

    // ---------------- Públicas ----------------
    if (action === "login") {
      const username = normUser(body.username);
      const password = String(body.password ?? "");
      const { data: r } = await db.from("whitelabel_resellers").select("*").eq("username", username).maybeSingle();
      if (!r || r.password_hash !== (await sha256(password))) return json({ success: false, error: "Usuário ou senha incorretos" }, 401);
      if (r.status !== "active") return json({ success: false, error: "Acesso bloqueado. Fale com a MRO." }, 403);
      const token = await createAdminSessionToken({ email: r.id, scope: SCOPE, exp: Date.now() + 7 * 864e5 }, sessionSecret);
      return json({ success: true, token });
    }

    if (action === "public_link_info") {
      const { data: r } = await db.from("whitelabel_resellers").select("name, status, active_until, brand_logo_path").eq("link_code", clean(body.code, 40)).maybeSingle();
      const ok = r && r.status === "active" && (!r.active_until || new Date(r.active_until) > new Date());
      return json({ success: !!ok, name: ok ? r.name : null, logo_url: ok ? await logoUrl(db, r.brand_logo_path) : null, prices: WL_PRICES });
    }

    if (action === "public_checkout") {
      const { data: r } = await db.from("whitelabel_resellers").select("id, status, active_until").eq("link_code", clean(body.code, 40)).maybeSingle();
      if (!r || r.status !== "active" || (r.active_until && new Date(r.active_until) <= new Date()))
        return json({ success: false, error: "Link indisponível" }, 404);
      const plan = asPlan(body.plan);
      const linkType = body.link_type === "renda_extra" ? "renda_extra" : "cliente_final";
      const email = normEmail(body.email), username = normUser(body.username), name = clean(body.name, 120);
      if (!plan || !isEmail(email) || username.length < 3) return json({ success: false, error: "Preencha nome, e-mail e usuário (mín. 3 letras)" }, 400);
      const { data: taken } = await db.from("mro_tool_users").select("id").eq("username", username).maybeSingle();
      if (taken) return json({ success: false, error: "Esse nome de usuário já existe, escolha outro" }, 400);
      const amount = WL_PRICES[plan], fee = WL_FEES[plan];
      const nsu = genNsu("WLSALE");
      const url = await createInfinitePayLink(nsu, Math.round(amount * 100), email, `${SITE}/wl/${body.code}?pago=1`);
      const { error: saleError } = await db.from("whitelabel_sales").insert({
        reseller_id: r.id, link_type: linkType, plan, buyer_name: name, buyer_email: email, buyer_username: username,
        amount, fee_amount: fee, net_amount: amount - fee, nsu, checkout_url: url,
      });
      if (saleError) return json({ success: false, error: 'Não foi possível registrar a venda. Tente novamente.' }, 500);
      return json({ success: true, checkout_url: url });
    }

    // ---------------- Admin principal ----------------
    if (action.startsWith("admin_")) {
      if (!(await isAdminRequest(req, body))) return json({ success: false, error: "Sessão admin inválida" }, 401);
      return await handleAdmin(db, action, body);
    }

    // ---------------- Revendedor ----------------
    const payload = await verifyAdminSessionToken(String(body.token ?? ""), sessionSecret, SCOPE);
    if (!payload?.email) return json({ success: false, error: "Sessão expirada" }, 401);
    const { data: me } = await db.from("whitelabel_resellers").select("*").eq("id", payload.email).maybeSingle();
    if (!me || me.status !== "active") return json({ success: false, error: "Acesso bloqueado" }, 403);
    const canSell = !me.active_until || new Date(me.active_until) > new Date();

    if (action === 'logo_upload_url' || action === 'set_logo') return await handleLogo(db, me.id, action, body);

    if (action === "me") {
      const [clients, fees, sales, tutorials] = await Promise.all([
        db.from("whitelabel_clients").select("*").eq("reseller_id", me.id).order("created_at", { ascending: false }),
        db.from("whitelabel_fees").select("*").eq("reseller_id", me.id).order("created_at", { ascending: false }),
        db.from("whitelabel_sales").select("id, link_type, plan, buyer_name, buyer_email, buyer_username, amount, fee_amount, net_amount, status, payout_status, created_at, paid_at").eq("reseller_id", me.id).order("created_at", { ascending: false }).limit(500),
        db.from("whitelabel_tutorials").select("*").eq("is_active", true).order("order_index"),
      ]);
      const ids = (clients.data ?? []).map((c: { mro_user_id: string }) => c.mro_user_id).filter(Boolean);
      const { data: users } = ids.length
        ? await db.from("mro_tool_users").select("id, is_active, extra_accounts, plan_accounts, trials_used, expires_at, expiration_days").in("id", ids)
        : { data: [] };
      const { password_hash: _h, password_plain: _p, ...safe } = me;
      return json({
        success: true, reseller: { ...safe, can_sell: canSell, brand_logo_url: await logoUrl(db, me.brand_logo_path) }, clients: clients.data ?? [], users: users ?? [],
        fees: fees.data ?? [], sales: sales.data ?? [], tutorials: tutorials.data ?? [], prices: WL_PRICES, fee_table: WL_FEES,
      });
    }

    if (action === "download_url") {
      if (!me.brand_file_path) return json({ success: false, error: "Arquivo ainda não disponível" }, 404);
      const { data, error } = await db.storage.from(BUCKET).createSignedUrl(me.brand_file_path, 3600, { download: me.brand_file_name || true });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, url: data.signedUrl });
    }

    if (action === "save_pix") {
      await db.from("whitelabel_resellers").update({ pix_type: clean(body.pix_type, 30), pix_key: clean(body.pix_key, 200) }).eq("id", me.id);
      return json({ success: true });
    }

    if (action === "create_client") {
      if (!canSell) return json({ success: false, error: "Seu período de revenda expirou" }, 403);
      const plan = asPlan(body.plan), username = normUser(body.username), email = normEmail(body.email);
      if (!plan || username.length < 3 || !isEmail(email)) return json({ success: false, error: "Usuário (mín. 3) e e-mail válidos são obrigatórios" }, 400);
      const res = await provisionClient(db, { resellerId: me.id, username, email, plan, origin: "manual" });
      return res.ok ? json({ success: true }) : json({ success: false, error: res.error }, 400);
    }

    // Ações sobre um cliente do próprio revendedor
    if (action === "add_extras" || action === "reset_trials") {
      const { data: c } = await db.from("whitelabel_clients").select("*").eq("id", String(body.client_id ?? "")).eq("reseller_id", me.id).maybeSingle();
      if (!c?.mro_user_id) return json({ success: false, error: "Cliente não encontrado" }, 404);
      if (action === "reset_trials") {
        await db.from("mro_tool_users").update({ trials_used: 0, trials_period_start: new Date().toISOString().slice(0, 10) }).eq("id", c.mro_user_id);
        return json({ success: true });
      }
      if (!canSell) return json({ success: false, error: "Seu período de revenda expirou" }, 403);
      const qty = Math.trunc(Number(body.quantity));
      if (!Number.isFinite(qty) || qty < 1 || qty > 100) return json({ success: false, error: "Quantidade inválida" }, 400);
      const { data: u } = await db.from("mro_tool_users").select("extra_accounts").eq("id", c.mro_user_id).maybeSingle();
      await db.from("mro_tool_users").update({ extra_accounts: (Number(u?.extra_accounts) || 0) + qty }).eq("id", c.mro_user_id);
      await db.from("whitelabel_clients").update({ extras_added: c.extras_added + qty }).eq("id", c.id);
      const kind = c.plan === "lifetime" ? "extra_lifetime" : "extra_annual";
      await db.from("whitelabel_fees").insert({ reseller_id: me.id, client_id: c.id, kind, quantity: qty, amount: WL_FEES[kind] * qty, description: `${qty} conta(s) adicional(is) — ${c.username}` });
      return json({ success: true });
    }

    if (action === "pay_fees") {
      const { data: fees } = await db.from("whitelabel_fees").select("id, amount").eq("reseller_id", me.id).eq("status", "pending").is("sale_id", null);
      const total = (fees ?? []).reduce((s: number, f: { amount: number }) => s + Number(f.amount), 0);
      if (total <= 0) return json({ success: false, error: "Nenhuma taxa pendente" }, 400);
      const nsu = genNsu("WLFEE");
      const url = await createInfinitePayLink(nsu, Math.round(total * 100), me.email || "", `${SITE}/whitelabel?taxas=pago`);
      await db.from("whitelabel_fee_payments").insert({ reseller_id: me.id, nsu, amount: total, fee_ids: (fees ?? []).map((f: { id: string }) => f.id), checkout_url: url });
      return json({ success: true, checkout_url: url });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("[whitelabel-api]", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function deleteMroUsers(db: any, ids: string[]) {
  if (!ids.length) return;
  await db.from("mro_tool_accounts").delete().in("user_id", ids);
  await db.from("mro_tool_users").delete().in("id", ids);
}

// deno-lint-ignore no-explicit-any
async function handleAdmin(db: any, action: string, body: Record<string, unknown>): Promise<Response> {
  const id = String(body.id ?? "");

  if (action === "admin_list") {
    const [r, c, f, s, t, p] = await Promise.all([
      db.from("whitelabel_resellers").select("*").order("created_at", { ascending: false }),
      db.from("whitelabel_clients").select("*").order("created_at", { ascending: false }),
      db.from("whitelabel_fees").select("*").order("created_at", { ascending: false }),
      db.from("whitelabel_sales").select("*").order("created_at", { ascending: false }).limit(2000),
      db.from("whitelabel_tutorials").select("*").order("order_index"),
      db.from("whitelabel_fee_payments").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    const ids = (c.data ?? []).map((x: { mro_user_id: string }) => x.mro_user_id).filter(Boolean);
    const { data: users } = ids.length
      ? await db.from("mro_tool_users").select("id, is_active, extra_accounts, plan_accounts, trials_used, expires_at, password_plain").in("id", ids)
      : { data: [] };
    const resellers = await Promise.all((r.data ?? []).map(async (reseller: { brand_logo_path: string | null }) => ({ ...reseller, brand_logo_url: await logoUrl(db, reseller.brand_logo_path) })));
    return json({ success: true, resellers, clients: c.data ?? [], users: users ?? [], fees: f.data ?? [], sales: s.data ?? [], tutorials: t.data ?? [], payments: p.data ?? [] });
  }

  if (action === 'admin_logo_upload_url' || action === 'admin_set_logo') {
    const { data: reseller } = await db.from('whitelabel_resellers').select('id').eq('id', id).maybeSingle();
    if (!reseller) return json({ success: false, error: 'Revendedor não encontrado' }, 404);
    return await handleLogo(db, id, action, body);
  }

  if (action === "admin_save_reseller") {
    const username = normUser(body.username);
    const name = clean(body.name, 120);
    if (!username || !name) return json({ success: false, error: "Nome e usuário são obrigatórios" }, 400);
    const row: Record<string, unknown> = {
      name, username, email: normEmail(body.email) || null, notes: clean(body.notes, 1000) || null,
      status: body.status === "blocked" ? "blocked" : "active",
      active_until: body.active_until ? new Date(String(body.active_until)).toISOString() : null,
    };
    if (body.password) { row.password_hash = await sha256(String(body.password)); row.password_plain = String(body.password); }
    if (id) {
      const { error } = await db.from("whitelabel_resellers").update(row).eq("id", id);
      if (error) return json({ success: false, error: error.message }, 400);
    } else {
      if (!body.password) return json({ success: false, error: "Senha obrigatória" }, 400);
      row.link_code = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      const { error } = await db.from("whitelabel_resellers").insert(row);
      if (error) return json({ success: false, error: error.message.includes("duplicate") ? "Usuário já existe" : error.message }, 400);
    }
    return json({ success: true });
  }

  if (action === "admin_delete_reseller") {
    if (body.with_clients) {
      const { data } = await db.from("whitelabel_clients").select("mro_user_id").eq("reseller_id", id);
      await deleteMroUsers(db, (data ?? []).map((x: { mro_user_id: string }) => x.mro_user_id).filter(Boolean));
    }
    const { data: r } = await db.from("whitelabel_resellers").select("brand_file_path").eq("id", id).maybeSingle();
    if (r?.brand_file_path) await db.storage.from(BUCKET).remove([r.brand_file_path]);
    await db.from("whitelabel_resellers").delete().eq("id", id);
    return json({ success: true });
  }

  if (action === "admin_upload_url") {
    const fileName = clean(body.file_name, 150).replace(/[^\w.\- ]/g, "_") || "arquivo.zip";
    const path = `${id}/${Date.now()}-${fileName}`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, path, token: data.token });
  }

  if (action === "admin_set_file") {
    const { data: r } = await db.from("whitelabel_resellers").select("brand_file_path").eq("id", id).maybeSingle();
    if (r?.brand_file_path && r.brand_file_path !== body.path) await db.storage.from(BUCKET).remove([r.brand_file_path]);
    await db.from("whitelabel_resellers").update({ brand_file_path: clean(body.path, 400), brand_file_name: clean(body.file_name, 150) }).eq("id", id);
    return json({ success: true });
  }

  if (action === "admin_client") {
    const { data: c } = await db.from("whitelabel_clients").select("*").eq("id", id).maybeSingle();
    if (!c) return json({ success: false, error: "Cliente não encontrado" }, 404);
    const op = String(body.op ?? "");
    if (op === "password") {
      const pw = String(body.password ?? "");
      if (pw.length < 3) return json({ success: false, error: "Senha muito curta" }, 400);
      await db.from("mro_tool_users").update({ password_hash: await sha256(pw), password_plain: pw }).eq("id", c.mro_user_id);
    } else if (op === "block" || op === "unblock") {
      await db.from("mro_tool_users").update({ is_active: op === "unblock" }).eq("id", c.mro_user_id);
    } else if (op === "extras") {
      const v = Math.max(0, Math.trunc(Number(body.value)) || 0);
      await db.from("mro_tool_users").update({ extra_accounts: v }).eq("id", c.mro_user_id);
    } else if (op === "delete") {
      await deleteMroUsers(db, c.mro_user_id ? [c.mro_user_id] : []);
      await db.from("whitelabel_clients").delete().eq("id", c.id);
    } else if (op === "accounts") {
      const { data } = await db.from("mro_tool_accounts").select("id, instagram_username, is_trial, created_at").eq("user_id", c.mro_user_id);
      return json({ success: true, accounts: data ?? [] });
    } else if (op === "remove_account") {
      await db.from("mro_tool_accounts").delete().eq("id", String(body.account_id ?? "")).eq("user_id", c.mro_user_id);
    } else return json({ success: false, error: "Operação inválida" }, 400);
    return json({ success: true });
  }

  if (action === "admin_mark_fees_paid") {
    const q = db.from("whitelabel_fees").update({ status: "paid", paid_at: new Date().toISOString(), paid_via: "admin" }).eq("reseller_id", id).eq("status", "pending");
    await (body.fee_id ? q.eq("id", String(body.fee_id)) : q.is("sale_id", null));
    return json({ success: true });
  }

  /** Baixa do repasse: marca vendas pagas como repassadas e quita as taxas descontadas delas. */
  if (action === "admin_payout") {
    const now = new Date().toISOString();
    const { data: sales } = await db.from("whitelabel_sales").select("id").eq("reseller_id", id).eq("status", "paid").eq("payout_status", "pending");
    const saleIds = (sales ?? []).map((s: { id: string }) => s.id);
    if (saleIds.length) {
      await db.from("whitelabel_sales").update({ payout_status: "paid", payout_at: now }).in("id", saleIds);
      await db.from("whitelabel_fees").update({ status: "paid", paid_at: now, paid_via: "desconto_repasse" }).in("sale_id", saleIds).eq("status", "pending");
    }
    return json({ success: true, count: saleIds.length });
  }

  if (action === "admin_confirm_payment") {
    return json({ success: true, result: await processWhitelabelPayment(db, clean(body.nsu, 80)) });
  }

  if (action === "admin_save_tutorial") {
    const row = { title: clean(body.title, 200), content: String(body.content ?? "").slice(0, 10000), video_url: clean(body.video_url, 500) || null, order_index: Number(body.order_index) || 0, is_active: body.is_active !== false };
    if (!row.title) return json({ success: false, error: "Título obrigatório" }, 400);
    const { error } = id ? await db.from("whitelabel_tutorials").update(row).eq("id", id) : await db.from("whitelabel_tutorials").insert(row);
    return error ? json({ success: false, error: error.message }, 400) : json({ success: true });
  }

  if (action === "admin_delete_tutorial") {
    await db.from("whitelabel_tutorials").delete().eq("id", id);
    return json({ success: true });
  }

  return json({ success: false, error: "Ação inválida" }, 400);
}
