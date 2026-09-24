import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const INFINITEPAY_HANDLE = "paguemro";
const LIFETIME_DAYS = 999999;
const DB_TIMEOUT_MS = 10_000;

function createTimedClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DB_TIMEOUT_MS);
        return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
      },
    },
  });
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genNSU() {
  return `HUB${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Verifica se o registro de usuário (MRO ou ZAPMRO) ainda está com acesso válido.
 *
 * IMPORTANTE: `expiration_days` / `days_remaining` são contadores de dias RESTANTES
 * (atualizados diariamente), NÃO a duração total do plano. Por isso nunca se deve
 * calcular a expiração como `created_at + dias`: um cliente criado há 28 dias com
 * 20 dias restantes apareceria como expirado. Quando existe uma data explícita
 * (`expires_at`), ela tem prioridade.
 */
function isAccessActive(row: Record<string, unknown> | null): boolean {
  if (!row) return false;
  if (row.is_active === false) return false;

  const days = Number(row.expiration_days ?? row.days_remaining ?? 0);
  if (Number.isFinite(days) && days >= LIFETIME_DAYS) return true;

  const explicitExpiry = row.expires_at ?? row.subscription_end ?? null;
  if (explicitExpiry) {
    const ts = new Date(String(explicitExpiry)).getTime();
    if (!Number.isNaN(ts)) return Date.now() < ts;
  }

  return Number.isFinite(days) && days > 0;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createTimedClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    let body: Record<string, unknown> = {};
    try {
      const raw = await req.text();
      if (raw) body = JSON.parse(raw);
    } catch {
      body = {};
    }
    const action = String(body.action || "");

    // ================= LOGIN =================
    if (action === "login") {
      const identifier = String(body.identifier || body.username || body.email || "").trim().toLowerCase();
      const rawPassword = String(body.password || "");
      const password = rawPassword.trim();
      if (!identifier || !password) return json({ success: false, error: "Informe usuário/e-mail e senha" }, 400);
      if (identifier.length > 255 || password.length > 255) return json({ success: false, error: "Credenciais inválidas" }, 400);

      const hash = await sha256(password);
      const rawHash = await sha256(rawPassword);
      // Compara senha ignorando espaços acidentais no cadastro/digitação.
      const passwordMatches = (row: Record<string, unknown> | null) => {
        if (!row) return false;
        const storedHash = row.password_hash ? String(row.password_hash) : "";
        const storedPlain = row.password_plain ? String(row.password_plain) : "";
        return (
          (!!storedHash && (storedHash === hash || storedHash === rawHash)) ||
          (!!storedPlain && (storedPlain === rawPassword || storedPlain.trim() === password))
        );
      };

      let username: string | null = null;
      let email: string | null = null;
      let name: string | null = null;
      let matched = false;

      // Busca direta e paralela nas duas fontes. Evita OR sem índice e elimina
      // uma segunda espera quando o usuário existe apenas no ZAPMRO.
      const lookupColumn = identifier.includes("@") ? "email" : "username";
      const [mroResult, zapResult] = await Promise.all([
        supabase
          .from("mro_tool_users")
          .select("*")
          .ilike(lookupColumn, identifier)
          .limit(100),
        supabase
          .from("zapmro_users")
          .select("*")
          .ilike(lookupColumn, identifier)
          .limit(100),
      ]);

      const mroRows = mroResult.data;
      // Cadastros históricos podem repetir usuário/e-mail. O login original já
      // aceitou uma dessas linhas; escolher apenas a primeira fazia o SSO falhar
      // quando ela guardava uma senha antiga.
      const mro = mroRows?.find((candidate) => passwordMatches(candidate)) || null;
      if (passwordMatches(mro)) {
        matched = true;
        username = mro.username;
        email = mro.email;
        name = mro.name;
      }

      // 2) ZAPMRO
      if (!matched) {
        const zapRows = zapResult.data;
        const zap = zapRows?.find((candidate) => passwordMatches(candidate)) || null;
        if (passwordMatches(zap)) {
          matched = true;
          username = zap.username;
          email = zap.email;
          name = zap.name;
        }
      }

      // 3) Posts com IA (compras pagas)
      if (!matched && identifier.includes("@")) {
        const { data: order } = await supabase
          .from("postscomia_orders")
          .select("*")
          .eq("email", identifier)
          .eq("status", "paid")
          .order("paid_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (order && order.password && order.password === password) {
          matched = true;
          email = order.email;
          name = order.name;
        }
      }

      if (!matched) return json({ success: false, error: "Usuário ou senha incorretos" }, 200);

      // Bloqueio manual feito pelo admin na dashboard de produtos.
      const blockFilters: string[] = [];
      if (email) blockFilters.push(`email.eq.${String(email).toLowerCase()}`);
      if (username) blockFilters.push(`username.eq.${String(username).toLowerCase()}`);
      if (blockFilters.length) {
        const { data: blockedRows } = await supabase
          .from("hub_blocked_users")
          .select("id")
          .or(blockFilters.join(","))
          .limit(1);
        if (blockedRows && blockedRows.length > 0) {
          return json({ success: false, error: "Acesso bloqueado. Fale com o suporte." }, 200);
        }
      }

      let lotarGruposTokenHash: string | null = null;
      let lotarGruposSsoError: string | null = null;

      // SSO opcional para a área de membros Lotar Grupos. O token só é emitido
      // depois que as credenciais do Hub foram validadas acima e o cliente possui
      // acesso ao produto (licença própria OU liberação manual/compra no Hub).
      if (body.issue_lotargrupos_sso === true) {
        let normalizedEmail = String(email || "").trim().toLowerCase();
        const normalizedUsername = username ? String(username).trim().toLowerCase() : "";
        const requestedProductId = String(body.lotargrupos_product_id || "").trim();

        // Algumas liberações antigas foram salvas pelo usuário, embora o e-mail
        // estivesse somente no próprio hub_access. Recuperamos esse e-mail antes
        // de criar a sessão, mantendo o card liberado como fonte da verdade.
        if (!normalizedEmail && normalizedUsername && requestedProductId) {
          const { data: grantRows } = await supabase
            .from("hub_access")
            .select("email")
            .eq("product_id", requestedProductId)
            .ilike("username", normalizedUsername)
            .not("email", "is", null)
            .limit(1);
          normalizedEmail = String(grantRows?.[0]?.email || "").trim().toLowerCase();
          if (normalizedEmail) email = normalizedEmail;
        }

        if (!normalizedEmail || !normalizedEmail.includes("@")) {
          lotarGruposSsoError = "O cadastro precisa de um e-mail válido para abrir o Lotar Grupos.";
        } else {

        const { data: lotarUsers } = await supabase
          .from("lotargrupos_users")
          .select("id,email,status,name,user_id,created_at")
          .ilike("email", normalizedEmail)
          .order("created_at", { ascending: true });

        // Registros antigos podem ter diferenças de maiúsculas ou duplicatas.
        // Escolhemos deterministicamente o ativo/vinculado, sem excluir histórico.
        let lotarUser = (lotarUsers || []).find(
          (candidate: { status: string; user_id: string | null }) => candidate.status === "active" && candidate.user_id,
        ) || (lotarUsers || []).find(
          (candidate: { status: string }) => candidate.status === "active",
        ) || lotarUsers?.[0] || null;

        let hasAccess = !!lotarUser && lotarUser.status === "active";

        // Liberações feitas pela dashboard de produtos (hub_access) também valem.
        if (!hasAccess) {
          // O card liberado no painel é a fonte de verdade. Cadastros antigos usam
          // tanto `lotargrupos` quanto `lotar-grupos`, por isso o fallback aceita
          // ambos e também o access_source histórico.
          let product: { id: string; slug: string; access_source: string } | null = null;
          if (requestedProductId) {
            const { data } = await supabase
              .from("hub_products")
              .select("id,slug,access_source")
              .eq("id", requestedProductId)
              .limit(1)
              .maybeSingle();
            if (
              data &&
              (data.slug === "lotargrupos" ||
                data.slug === "lotar-grupos" ||
                data.access_source === "lotargrupos")
            ) {
              product = data;
            }
          }

          if (!product) {
            const { data: products } = await supabase
              .from("hub_products")
              .select("id,slug,access_source")
              .or("slug.eq.lotargrupos,slug.eq.lotar-grupos,access_source.eq.lotargrupos")
              .order("order_index", { ascending: true })
              .limit(1);
            product = products?.[0] || null;
          }

          if (product?.id) {
            const filters = [`email.eq.${normalizedEmail}`];
            if (normalizedUsername) filters.push(`username.eq.${normalizedUsername}`);
            const { data: grants } = await supabase
              .from("hub_access")
              .select("expires_at")
              .eq("product_id", product.id)
              .or(filters.join(","));
            hasAccess = (grants || []).some(
              (g: { expires_at: string | null }) =>
                !g.expires_at || new Date(g.expires_at).getTime() > Date.now(),
            );
          }
        }

        if (hasAccess) {
          // A área de membros exige um registro ativo em lotargrupos_users.
          if (!lotarUser) {
            const { data: createdUser } = await supabase
              .from("lotargrupos_users")
              .insert({
                email: normalizedEmail,
                name: name || "Aluno",
                status: "active",
              })
              .select("id,email,status,name,user_id,created_at")
              .single();
            lotarUser = createdUser;
          } else if (lotarUser.status !== "active") {
            await supabase
              .from("lotargrupos_users")
              .update({ email: normalizedEmail, status: "active" })
              .eq("id", lotarUser.id);
          } else if (lotarUser.email !== normalizedEmail) {
            await supabase
              .from("lotargrupos_users")
              .update({ email: normalizedEmail })
              .eq("id", lotarUser.id);
          }

          let { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: "magiclink",
            email: normalizedEmail,
          });

          // Compras antigas ou liberações manuais podem ainda não possuir uma
          // conta no Auth. Criamos a identidade com senha aleatória e tentamos
          // gerar o token novamente, sem alterar a senha usada no Hub.
          if (linkError || !linkData?.properties?.hashed_token) {
            const randomPassword = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
            await supabase.auth.admin.createUser({
              email: normalizedEmail,
              password: randomPassword,
              email_confirm: true,
              user_metadata: { full_name: name || "Aluno" },
            });

            const retry = await supabase.auth.admin.generateLink({
              type: "magiclink",
              email: normalizedEmail,
            });
            linkData = retry.data;
            linkError = retry.error;
          }

          if (!linkError && linkData?.properties?.hashed_token) {
            lotarGruposTokenHash = linkData.properties.hashed_token;

            // A policy da área de membros lê o registro pelo auth.uid(), então o
            // vínculo precisa existir antes do primeiro acesso.
            const authUserId = (linkData as { user?: { id?: string } })?.user?.id;
            if (authUserId && lotarUser?.id) {
              await supabase
                .from("lotargrupos_users")
                .update({ user_id: authUserId })
                .eq("id", lotarUser.id)
                .is("user_id", null);
            }
          } else {
            lotarGruposSsoError = "Não foi possível criar a sessão do Lotar Grupos.";
          }

        } else {
          lotarGruposSsoError = "A liberação do Lotar Grupos não foi encontrada para este usuário.";
        }
        }
      }


      return json({
        success: true,
        user: { username, email, name },
        lotargrupos_token_hash: lotarGruposTokenHash,
        lotargrupos_sso_error: lotarGruposSsoError,
      });

    }

    // ================= PRODUTOS + ACESSOS =================
    if (action === "products") {
      const username = String(body.username || "").trim().toLowerCase();
      const email = String(body.email || "").trim().toLowerCase();

      const { data: products } = await supabase
        .from("hub_products")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      const access: Record<string, boolean> = {};
      const details: Record<string, unknown> = {};

      // Identidade efetiva: o cliente pode ter entrado só com usuário (MRO/ZAPMRO)
      // mas ter o mesmo e-mail cadastrado em outros produtos (Posts com IA etc).
      let effEmail = email;
      let effUsername = username;

      // MRO Ferramenta
      if (username || email) {
        const parts: string[] = [];
        if (username) parts.push(`username.eq.${username}`);
        if (email) parts.push(`email.eq.${email}`);
        const { data: mroRows } = await supabase.from("mro_tool_users").select("*").or(parts.join(",")).limit(1);
        const mro = mroRows?.[0] || null;
        access.mro_tool = isAccessActive(mro);
        if (mro) {
          details.mro_tool = { expiration_days: mro.expiration_days, username: mro.username };
          effEmail = effEmail || String(mro.email || "").trim().toLowerCase();
          effUsername = effUsername || String(mro.username || "").trim().toLowerCase();
        }

        const { data: zapRows } = await supabase.from("zapmro_users").select("*").or(parts.join(",")).limit(1);
        const zap = zapRows?.[0] || null;
        access.zapmro = isAccessActive(zap);
        if (zap) {
          details.zapmro = { expiration_days: zap.expiration_days ?? zap.days_remaining, username: zap.username };
          effEmail = effEmail || String(zap.email || "").trim().toLowerCase();
          effUsername = effUsername || String(zap.username || "").trim().toLowerCase();
        }

        // Se descobrimos o e-mail agora, checa os produtos que só usam e-mail.
        if (effEmail && !email) {
          const extraParts: string[] = [`email.eq.${effEmail}`];
          if (!access.mro_tool) {
            const { data: r } = await supabase.from("mro_tool_users").select("*").or(extraParts.join(",")).limit(1);
            if (r?.[0]) {
              access.mro_tool = isAccessActive(r[0]);
              if (access.mro_tool) details.mro_tool = { expiration_days: r[0].expiration_days, username: r[0].username };
            }
          }
          if (!access.zapmro) {
            const { data: r } = await supabase.from("zapmro_users").select("*").or(extraParts.join(",")).limit(1);
            if (r?.[0]) {
              access.zapmro = isAccessActive(r[0]);
              if (access.zapmro) details.zapmro = { expiration_days: r[0].expiration_days, username: r[0].username };
            }
          }
        }
      }

      if (effEmail) {
        const { data: pOrder } = await supabase
          .from("postscomia_orders")
          .select("email,status")
          .eq("email", effEmail)
          .eq("status", "paid")
          .limit(1)
          .maybeSingle();
        access.postscomia = !!pOrder;

        const { data: lgUser } = await supabase
          .from("lotargrupos_users")
          .select("email,status")
          .eq("email", effEmail)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        access.lotargrupos = !!lgUser;
      }

      // Liberações manuais / compras feitas pela dashboard
      const grantFilters: string[] = [];
      if (effEmail) grantFilters.push(`email.eq.${effEmail}`);
      if (effUsername) grantFilters.push(`username.eq.${effUsername}`);
      let grants: { product_id: string; expires_at: string | null }[] = [];
      if (grantFilters.length) {
        const { data } = await supabase.from("hub_access").select("product_id,expires_at").or(grantFilters.join(","));
        grants = data || [];
      }
      const grantedIds = new Set(
        grants.filter((g) => !g.expires_at || new Date(g.expires_at).getTime() > Date.now()).map((g) => g.product_id),
      );

      // Cliente bloqueado manualmente perde acesso a tudo.
      let isBlocked = false;
      if (grantFilters.length) {
        const { data: blockedRows } = await supabase
          .from("hub_blocked_users")
          .select("id")
          .or(grantFilters.join(","))
          .limit(1);
        isBlocked = !!(blockedRows && blockedRows.length > 0);
      }

      const result = (products || []).map((p) => ({
        ...p,
        unlocked: p.is_redirect_only || (!isBlocked && (grantedIds.has(p.id) || !!access[p.access_source])),
      }));

      // Identidade efetiva devolvida para o front hidratar o login das ferramentas
      // (ex.: Posts com IA só reconhece e-mail, mesmo se o cliente entrou por usuário).
      return json({
        success: true,
        products: result,
        access,
        details,
        blocked: isBlocked,
        identity: { email: effEmail || null, username: effUsername || null },
      });

    }

    // ================= PRODUTO + TUTORIAIS =================
    if (action === "product") {
      const slug = String(body.slug || "").trim();
      let product = null;
      if (slug === "audiibooks") {
        const { data: p } = await supabase.from("hub_products").select("*").eq("slug", slug).maybeSingle();
        product = p;
        if (!product) {
          const { data: newP } = await supabase.from("hub_products").insert({
            slug: "audiibooks",
            title: "O SEGREDO PARA VENDER MAIS !",
            description: "4 eBooks + 4 Audiobooks estratégicos",
            price: 37,
            access_source: "audiibooks",
            is_active: true,
            order_index: 99,
            status: 'active'
          }).select().single();
          product = newP;
        }
      } else {
        const { data: p } = await supabase.from("hub_products").select("*").eq("slug", slug).maybeSingle();
        product = p;
      }
      
      if (!product) return json({ success: false, error: "Produto não encontrado" }, 200);
      const { data: tutorials } = await supabase
        .from("hub_product_tutorials")
        .select("*")
        .eq("product_id", product.id)
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      return json({ success: true, product, tutorials: tutorials || [] });
    }

    // ================= CHECKOUT =================
    if (action === "create_checkout") {
      const slug = String(body.slug || "").trim();
      const cleanEmail = String(body.email || "").trim().toLowerCase();
      const cleanName = String(body.name || "").trim();
      const cleanPhone = String(body.whatsapp || "").replace(/\D/g, "");

      if (!slug) return json({ success: false, error: "Produto inválido" }, 400);
      if (!cleanEmail.includes("@")) return json({ success: false, error: "E-mail inválido" }, 400);
      if (!cleanName) return json({ success: false, error: "Nome obrigatório" }, 400);

      let product = null;
      if (slug === "audiibooks") {
        const { data: p } = await supabase.from("hub_products").select("*").eq("slug", slug).maybeSingle();
        product = p;
        if (!product) {
          // Auto-provision product if missing
          const { data: newP, error: insErr } = await supabase.from("hub_products").insert({
            slug: "audiibooks",
            title: "O SEGREDO PARA VENDER MAIS !",
            description: "4 eBooks + 4 Audiobooks estratégicos",
            price: 37,
            access_source: "audiibooks",
            is_active: true,
            order_index: 99,
            status: 'active'
          }).select().single();
          if (!insErr) product = newP;
        }
      } else {
        const { data: p } = await supabase.from("hub_products").select("*").eq("slug", slug).maybeSingle();
        product = p;
      }

      if (!product) return json({ success: false, error: "Produto não encontrado" }, 404);

      const amount = Number(product.price || 0);
      if (amount <= 0) return json({ success: false, error: "Produto sem preço configurado" }, 400);

      const nsu = genNSU();
      const orderBumps = (body.orderBumps || {}) as { lifetime?: boolean; analysis?: boolean };
      let finalAmount = amount;
      if (orderBumps.lifetime) finalAmount += 9;
      if (orderBumps.analysis) finalAmount += 19;

      const priceCents = Math.round(finalAmount * 100);
      const redirectUrl = slug === "audiibooks" 
        ? `https://maisresultadosonline.com.br/audiobooks/obrigado?paid=1&nsu=${nsu}`
        : `https://maisresultadosonline.com.br/dashboard?paid=1&nsu=${nsu}`;
      
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/infinitepay-webhook`;
      
      let description = slug === "audiibooks" ? `AUDIIBOOKS_${cleanEmail}` : `HUB_${slug}_${cleanEmail}`;
      if (orderBumps.lifetime || orderBumps.analysis) {
        description += `_BUMPS:${orderBumps.lifetime ? 'L' : ''}${orderBumps.analysis ? 'A' : ''}`;
      }

      const items = [{ name: description, quantity: 1, price: priceCents }];
      const phoneWithCC = cleanPhone ? `55${cleanPhone}` : undefined;

      const payload = {
        handle: INFINITEPAY_HANDLE,
        items,
        itens: items,
        order_nsu: nsu,
        redirect_url: redirectUrl,
        webhook_url: webhookUrl,
        customer: { name: cleanName, email: cleanEmail, phone: phoneWithCC },
        customer_name: cleanName,
        customer_email: cleanEmail,
        customer_phone: phoneWithCC,
      };

      let paymentLink: string | null = null;
      try {
        const r = await fetch("https://api.checkout.infinitepay.io/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (r.ok) paymentLink = data.checkout_url || data.link || data.url || null;
      } catch (_e) {
        paymentLink = null;
      }

      const prefill = new URLSearchParams({
        customer_name: cleanName,
        customer_email: cleanEmail,
        customer_cellphone: cleanPhone,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
      }).toString();

      if (!paymentLink) {
        const enc = encodeURIComponent(JSON.stringify([{ name: description, price: priceCents, quantity: 1 }]));
        paymentLink = `https://checkout.infinitepay.io/${INFINITEPAY_HANDLE}?items=${enc}&redirect_url=${encodeURIComponent(redirectUrl)}&webhook_url=${encodeURIComponent(webhookUrl)}&${prefill}`;
      } else {
        paymentLink += (paymentLink.includes("?") ? "&" : "?") + prefill;
      }

      await supabase.from("hub_orders").insert({
        product_id: product.id,
        product_slug: slug,
        name: cleanName,
        email: cleanEmail,
        whatsapp: cleanPhone,
        amount: finalAmount,
        nsu_order: nsu,
        infinitepay_link: paymentLink,
        status: "pending",
      });

      // Salva na tabela específica de audiobooks para o admin
      if (slug === "audiibooks") {
        await supabase.from("audiobooks_orders").insert({
          email: cleanEmail,
          name: cleanName,
          whatsapp: cleanPhone,
          amount: finalAmount,
          order_nsu: nsu,
          has_bump_lifetime: !!orderBumps.lifetime,
          has_bump_profile_analysis: !!orderBumps.analysis
        });
      }

      return json({ success: true, nsu, payment_link: paymentLink });
    }

    if (action === "check_payment") {
      const nsu = String(body.nsu || "");
      if (!nsu) return json({ success: false, error: "NSU obrigatório" }, 400);
      const { data: order } = await supabase.from("hub_orders").select("*").eq("nsu_order", nsu).maybeSingle();
      return json({ success: true, paid: order?.status === "paid", order: order || null });
    }

    // ================= ADMIN =================
    if (action === "admin_list_products") {
      const { data: products } = await supabase
        .from("hub_products")
        .select("*")
        .order("order_index", { ascending: true });
      const { data: tutorials } = await supabase
        .from("hub_product_tutorials")
        .select("*")
        .order("order_index", { ascending: true });
      return json({ success: true, products: products || [], tutorials: tutorials || [] });
    }

    if (action === "admin_save_product") {
      const p = (body.product || {}) as Record<string, unknown>;
      const slug = String(p.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (!slug || !String(p.title || "").trim()) {
        return json({ success: false, error: "Slug e título são obrigatórios" }, 400);
      }
      const payload = {
        slug,
        title: String(p.title),
        description: p.description ? String(p.description) : null,
        thumb_url: p.thumb_url ? String(p.thumb_url) : null,
        app_route: p.app_route ? String(p.app_route) : null,
        sales_page_url: p.sales_page_url ? String(p.sales_page_url) : null,
        price: Number(p.price || 0),
        access_source: String(p.access_source || "manual"),
        order_index: Number(p.order_index || 0),
        is_active: p.is_active !== false,
        status: String(p.status || 'active'),
        is_pinned: !!p.is_pinned,
        new_until: p.new_until ? String(p.new_until) : null,
        is_ebook_hub: !!p.is_ebook_hub,
        badge_text: p.badge_text ? String(p.badge_text) : null,
        plan_type: p.plan_type ? String(p.plan_type) : 'vitalicio',
        is_redirect_only: p.is_redirect_only === true,
      };
      if (p.id) {
        const { error } = await supabase.from("hub_products").update(payload).eq("id", String(p.id));
        if (error) return json({ success: false, error: error.message }, 400);
      } else {
        const { error } = await supabase.from("hub_products").insert(payload);
        if (error) return json({ success: false, error: error.message }, 400);
      }
      return json({ success: true });
    }

    if (action === "admin_delete_product") {
      const id = String(body.id || "");
      if (!id) return json({ success: false, error: "ID obrigatório" }, 400);
      await supabase.from("hub_products").delete().eq("id", id);
      return json({ success: true });
    }

    if (action === "admin_save_tutorial") {
      const t = (body.tutorial || {}) as Record<string, unknown>;
      if (!t.product_id || !String(t.title || "").trim()) {
        return json({ success: false, error: "Produto e título são obrigatórios" }, 400);
      }
      const payload = {
        product_id: String(t.product_id),
        title: String(t.title),
        description: t.description ? String(t.description) : null,
        cover_url: t.cover_url ? String(t.cover_url) : null,
        video_url: t.video_url ? String(t.video_url) : null,
        download_url: t.download_url ? String(t.download_url) : null,
        order_index: Number(t.order_index || 0),
        is_active: t.is_active !== false,
      };
      if (t.id) {
        const { error } = await supabase.from("hub_product_tutorials").update(payload).eq("id", String(t.id));
        if (error) return json({ success: false, error: error.message }, 400);
      } else {
        const { error } = await supabase.from("hub_product_tutorials").insert(payload);
        if (error) return json({ success: false, error: error.message }, 400);
      }
      return json({ success: true });
    }

    if (action === "admin_save_ebook") {
      const e = (body.ebook || {}) as Record<string, unknown>;
      if (!e.product_id || !String(e.title || "").trim()) {
        return json({ success: false, error: "Produto e título são obrigatórios" }, 400);
      }
      const payload = {
        product_id: String(e.product_id),
        title: String(e.title),
        description: e.description ? String(e.description) : null,
        cover_url: e.cover_url ? String(e.cover_url) : null,
        audio_url: e.audio_url ? String(e.audio_url) : null,
        ebook_url: e.ebook_url ? String(e.ebook_url) : null,
        order_index: Number(e.order_index || 0),
      };
      if (e.id) {
        const { error } = await supabase.from("hub_product_ebooks").update(payload).eq("id", String(e.id));
        if (error) return json({ success: false, error: error.message }, 400);
      } else {
        const { error } = await supabase.from("hub_product_ebooks").insert(payload);
        if (error) return json({ success: false, error: error.message }, 400);
      }
      return json({ success: true });
    }

    if (action === "admin_delete_tutorial") {
      const id = String(body.id || "");
      if (!id) return json({ success: false, error: "ID obrigatório" }, 400);
      await supabase.from("hub_product_tutorials").delete().eq("id", id);
      return json({ success: true });
    }

    if (action === "admin_list_orders") {
      const { data } = await supabase
        .from("hub_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return json({ success: true, orders: data || [] });
    }

    if (action === "admin_grant_access") {
      const productId = String(body.product_id || "");
      const email = String(body.email || "").trim().toLowerCase() || null;
      const username = String(body.username || "").trim().toLowerCase() || null;
      if (!productId || (!email && !username)) {
        return json({ success: false, error: "Produto e e-mail/usuário são obrigatórios" }, 400);
      }
      await supabase.from("hub_access").insert({ product_id: productId, email, username, source: "manual" });
      return json({ success: true });
    }

    /** Remove uma liberação manual (hub_access) de um produto para o cliente. */
    if (action === "admin_revoke_access") {
      const productId = String(body.product_id || "");
      const email = String(body.email || "").trim().toLowerCase();
      const username = String(body.username || "").trim().toLowerCase();
      if (!productId || (!email && !username)) {
        return json({ success: false, error: "Produto e e-mail/usuário são obrigatórios" }, 400);
      }
      if (email) await supabase.from("hub_access").delete().eq("product_id", productId).eq("email", email);
      if (username) await supabase.from("hub_access").delete().eq("product_id", productId).eq("username", username);
      return json({ success: true });
    }

    /** Bloqueia/desbloqueia totalmente o cliente na dashboard de produtos. */
    if (action === "admin_toggle_block") {
      const email = String(body.email || "").trim().toLowerCase();
      const username = String(body.username || "").trim().toLowerCase();
      const blocked = body.blocked !== false;
      if (!email && !username) return json({ success: false, error: "E-mail ou usuário obrigatório" }, 400);

      if (blocked) {
        await supabase.from("hub_blocked_users").insert({
          email: email || null,
          username: username || null,
          reason: body.reason ? String(body.reason).slice(0, 300) : null,
        });
      } else {
        if (email) await supabase.from("hub_blocked_users").delete().eq("email", email);
        if (username) await supabase.from("hub_blocked_users").delete().eq("username", username);
      }
      return json({ success: true, blocked });
    }

    /**
     * Lista unificada de todos os clientes (MRO, ZAPMRO, Posts com IA, compras da
     * dashboard e liberações manuais) com o mapa de acesso por produto.
     */
    if (action === "admin_list_users") {
      const fetchAll = async (table: string, columns: string) => {
        const out: Record<string, unknown>[] = [];
        let from = 0;
        const size = 1000;
        // Paginação para não truncar em 1000 linhas.
        for (;;) {
          const { data, error } = await supabase.from(table).select(columns).order("created_at", { ascending: true }).range(from, from + size - 1);
          if (error || !data || data.length === 0) break;
          out.push(...(data as Record<string, unknown>[]));
          if (data.length < size) break;
          from += size;
        }
        return out;
      };

      const [products, mroUsers, zapUsers, postsOrders, hubOrders, grants, blocked] = await Promise.all([
        supabase.from("hub_products").select("*").order("order_index", { ascending: true }),
        fetchAll("mro_tool_users", "id,username,email,name,expiration_days,is_active,password_plain"),
        fetchAll("zapmro_users", "id,username,email,name,days_remaining,is_active,password_plain"),
        fetchAll("postscomia_orders", "email,name,status,paid_at"),
        fetchAll("hub_orders", "email,name,product_slug,status"),
        fetchAll("hub_access", "product_id,email,username,expires_at"),
        fetchAll("hub_blocked_users", "email,username,reason"),
      ]);

      const productList = products.data || [];

      type HubUser = {
        key: string;
        username: string | null;
        email: string | null;
        name: string | null;
        password: string | null;
        sources: string[];
        blocked: boolean;
        access: Record<string, { unlocked: boolean; manual: boolean; origin: string }>;
      };

      // Índice por "apelido": cada e-mail e cada usuário aponta para o MESMO registro.
      // Assim o cliente que usa o mesmo e-mail no MRO, ZAPMRO e Posts com IA
      // aparece uma única vez com todos os acessos juntos.
      const aliasIndex = new Map<string, HubUser>();
      const norm = (v?: string | null) => String(v || "").trim().toLowerCase() || null;

      const mergeInto = (target: HubUser, other: HubUser) => {
        target.email = target.email || other.email;
        target.username = target.username || other.username;
        target.name = target.name || other.name;
        target.password = target.password || other.password;
        target.blocked = target.blocked || other.blocked;
        for (const s of other.sources) if (!target.sources.includes(s)) target.sources.push(s);
        for (const [k, v] of Object.entries(other.access)) target.access[k] = target.access[k] || v;
        for (const [alias, ref] of aliasIndex.entries()) if (ref === other) aliasIndex.set(alias, target);
      };

      const touch = (
        email: string | null,
        username: string | null,
        name: string | null,
        source: string,
        password?: string | null,
      ): HubUser | null => {
        const e = norm(email);
        const un = norm(username);
        if (!e && !un) return null;

        const byEmail = e ? aliasIndex.get(`e:${e}`) : undefined;
        const byUser = un ? aliasIndex.get(`u:${un}`) : undefined;

        let user = byEmail || byUser || null;
        if (byEmail && byUser && byEmail !== byUser) {
          mergeInto(byEmail, byUser);
          user = byEmail;
        }

        if (!user) {
          user = {
            key: e || un || "",
            username: un,
            email: e,
            name: name || null,
            password: password || null,
            sources: [source],
            blocked: false,
            access: {},
          };
        } else {
          user.email = user.email || e;
          user.username = user.username || un;
          user.name = user.name || name || null;
          user.password = user.password || password || null;
          if (!user.sources.includes(source)) user.sources.push(source);
        }

        if (e) aliasIndex.set(`e:${e}`, user);
        if (un) aliasIndex.set(`u:${un}`, user);
        return user;
      };

      const allUsers = (): HubUser[] => Array.from(new Set(aliasIndex.values()));


      const setAccess = (u: HubUser | null, source: string, unlocked: boolean, origin: string, manual = false) => {
        if (!u || !unlocked) return;
        u.access[source] = { unlocked: true, manual, origin };
      };

      for (const row of mroUsers) {
        const u = touch(
          (row.email as string) || null,
          (row.username as string) || null,
          (row.name as string) || null,
          "mro_tool",
          (row.password_plain as string) || null,
        );
        setAccess(u, "mro_tool", isAccessActive(row), "MRO Ferramenta");
      }
      for (const row of zapUsers) {
        const u = touch(
          (row.email as string) || null,
          (row.username as string) || null,
          (row.name as string) || null,
          "zapmro",
          (row.password_plain as string) || null,
        );
        setAccess(u, "zapmro", isAccessActive(row), "ZAPMRO");
      }
      for (const row of postsOrders) {
        if (row.status !== "paid") continue;
        const u = touch((row.email as string) || null, null, (row.name as string) || null, "postscomia");
        setAccess(u, "postscomia", true, "Posts com IA");
      }
      for (const row of hubOrders) {
        const u = touch((row.email as string) || null, null, (row.name as string) || null, "dashboard");
        if (row.status === "paid" && row.product_slug) {
          const prod = productList.find((p) => p.slug === row.product_slug);
          if (prod) setAccess(u, `product:${prod.id}`, true, "Compra na dashboard");
        }
      }

      // Liberações manuais por produto
      for (const g of grants) {
        const expired = g.expires_at ? new Date(String(g.expires_at)).getTime() <= Date.now() : false;
        if (expired) continue;
        const u = touch((g.email as string) || null, (g.username as string) || null, null, "manual");
        setAccess(u, `product:${g.product_id}`, true, "Liberado manualmente", true);
      }

      // Bloqueios
      for (const b of blocked) {
        const e = norm(b.email as string);
        const un = norm(b.username as string);
        const u = (e ? aliasIndex.get(`e:${e}`) : undefined) || (un ? aliasIndex.get(`u:${un}`) : undefined);
        if (u) u.blocked = true;
      }

      // Lista final: cada conta de ferramenta (MRO / ZAPMRO) vira uma linha própria,
      // preservando o username individual mesmo quando várias contas dividem o mesmo e-mail.
      // O vínculo por e-mail continua valendo apenas para liberar os produtos.
      const buildProducts = (group: HubUser) =>
        productList.map((p) => {
          const manualEntry = group.access[`product:${p.id}`];
          const planEntry = group.access[p.access_source];
          const entry = manualEntry || planEntry;
          return {
            id: p.id,
            slug: p.slug,
            title: p.title,
            unlocked: !!entry && !group.blocked,
            manual: !!manualEntry,
            origin: entry?.origin || null,
          };
        });

      const groupAliases = new Map<HubUser, string[]>();
      for (const [alias, ref] of aliasIndex.entries()) {
        const arr = groupAliases.get(ref) || [];
        const value = alias.slice(2);
        if (!arr.includes(value)) arr.push(value);
        groupAliases.set(ref, arr);
      }

      const rows: Record<string, unknown>[] = [];
      const coveredGroups = new Set<HubUser>();

      const pushAccountRow = (
        row: Record<string, unknown>,
        source: string,
      ) => {
        const e = norm(row.email as string);
        const un = norm(row.username as string);
        const group = (un ? aliasIndex.get(`u:${un}`) : undefined) || (e ? aliasIndex.get(`e:${e}`) : undefined);
        if (!group) return;
        coveredGroups.add(group);
        rows.push({
          key: `${source}:${row.id}`,
          username: un,
          email: e,
          name: (row.name as string) || group.name || null,
          password: (row.password_plain as string) || null,
          sources: group.sources,
          aliases: groupAliases.get(group) || [],
          blocked: group.blocked,
          access: group.access,
          account_source: source,
          products: buildProducts(group),
        });
      };

      for (const row of mroUsers) pushAccountRow(row, "mro_tool");
      for (const row of zapUsers) pushAccountRow(row, "zapmro");

      // Identidades sem conta de ferramenta (compras Posts com IA / dashboard / liberações manuais)
      for (const group of allUsers()) {
        if (coveredGroups.has(group)) continue;
        rows.push({
          key: group.key,
          username: group.username,
          email: group.email,
          name: group.name,
          password: group.password,
          sources: group.sources,
          aliases: groupAliases.get(group) || [],
          blocked: group.blocked,
          access: group.access,
          account_source: group.sources[0] || null,
          products: buildProducts(group),
        });
      }

      const list = rows;

      list.sort((a, b) =>
        String(a.name || a.email || a.username || "").localeCompare(String(b.name || b.email || b.username || "")),
      );

      return json({ success: true, products: productList, users: list, total: list.length });

    }

    /** Reenvia o acesso do cliente por email, sempre apontando para /dashboard. */
    if (action === "admin_send_access") {
      const email = String(body.email || "").trim().toLowerCase();
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!email.includes("@")) return json({ success: false, error: "Cliente sem email cadastrado" }, 400);
      if (!password) return json({ success: false, error: "Senha não disponível para este cliente" }, 400);

      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          email,
          username: username || email,
          password,
          daysRemaining: Number(body.daysRemaining || 0) || undefined,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.success === false) {
        return json({ success: false, error: result?.error || "Falha ao enviar email" }, 500);
      }
      return json({ success: true, email });
    }

    // ================= PERFIL DO CLIENTE (/dashboard → Configurações) =================
    /**
     * Localiza todas as contas de ferramenta (MRO/ZAPMRO) do cliente a partir do
     * usuário e/ou e-mail informados, validando a senha antes de expor qualquer dado.
     */
    const findAccounts = async (username: string, email: string, rawPassword: string) => {
      const password = rawPassword.trim();
      const hash = await sha256(password);
      const rawHash = await sha256(rawPassword);
      const safeUser = username.replace(/[,()"']/g, "");
      const safeEmail = email.replace(/[,()"']/g, "");
      const filters: string[] = [];
      if (safeUser) filters.push(`username.eq.${safeUser}`);
      if (safeEmail) filters.push(`email.eq.${safeEmail}`);
      if (!filters.length) return { mro: null, zap: null } as Record<string, Record<string, unknown> | null>;

      const ok = (row: Record<string, unknown> | null) => {
        if (!row) return false;
        const storedHash = row.password_hash ? String(row.password_hash) : "";
        const storedPlain = row.password_plain ? String(row.password_plain) : "";
        return (
          (!!storedHash && (storedHash === hash || storedHash === rawHash)) ||
          (!!storedPlain && (storedPlain === rawPassword || storedPlain.trim() === password))
        );
      };

      const { data: mroRows } = await supabase.from("mro_tool_users").select("*").or(filters.join(",")).limit(5);
      const { data: zapRows } = await supabase.from("zapmro_users").select("*").or(filters.join(",")).limit(5);
      const mro = (mroRows || []).find(ok) || null;
      const zap = (zapRows || []).find(ok) || null;
      return { mro, zap };
    };

    if (action === "profile") {
      const username = String(body.username || "").trim().toLowerCase();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!password || (!username && !email)) return json({ success: false, error: "Credenciais inválidas" }, 400);

      const { mro, zap } = await findAccounts(username, email, password);
      if (!mro && !zap) return json({ success: false, error: "Não foi possível validar seu acesso" }, 200);

      const src = mro || zap!;
      return json({
        success: true,
        profile: {
          username: String(src.username || username || ""),
          email: String(src.email || email || ""),
          name: src.name ? String(src.name) : "",
          whatsapp: src.whatsapp ? String(src.whatsapp) : "",
          has_email: !!(src.email || email),
          username_locked: !!src.username,
        },
      });
    }

    if (action === "update_profile") {
      const username = String(body.username || "").trim().toLowerCase();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!password || (!username && !email)) return json({ success: false, error: "Credenciais inválidas" }, 400);

      const newEmailRaw = body.new_email === undefined ? null : String(body.new_email || "").trim().toLowerCase();
      const newName = body.new_name === undefined ? null : String(body.new_name || "").trim().slice(0, 120);
      const newWhats = body.new_whatsapp === undefined ? null : String(body.new_whatsapp || "").replace(/\D/g, "").slice(0, 15);
      const newPassword = body.new_password ? String(body.new_password) : "";

      if (newEmailRaw !== null && newEmailRaw && (!newEmailRaw.includes("@") || newEmailRaw.length > 255)) {
        return json({ success: false, error: "E-mail inválido" }, 400);
      }
      if (newPassword && (newPassword.length < 4 || newPassword.length > 100)) {
        return json({ success: false, error: "A nova senha deve ter entre 4 e 100 caracteres" }, 400);
      }

      const { mro, zap } = await findAccounts(username, email, password);
      if (!mro && !zap) return json({ success: false, error: "Senha atual incorreta" }, 200);

      // E-mail já usado por outro cliente? (o vínculo é único por e-mail)
      if (newEmailRaw) {
        const safeEmail = newEmailRaw.replace(/[,()"']/g, "");
        const { data: dupeMro } = await supabase
          .from("mro_tool_users")
          .select("id,username")
          .eq("email", safeEmail)
          .limit(5);
        const { data: dupeZap } = await supabase
          .from("zapmro_users")
          .select("id,username")
          .eq("email", safeEmail)
          .limit(5);
        // Acessos que o cliente está usando agora (precisam aparecer na lista de escolha)
        const currentAccounts = [
          ...(mro ? [{ tool: "MRO Ferramenta", username: String(mro.username || ""), current: true }] : []),
          ...(zap ? [{ tool: "ZAPMRO", username: String(zap.username || ""), current: true }] : []),
        ].filter((r) => r.username);

        const others = [
          ...(dupeMro || []).filter((r) => r.id !== (mro?.id as string)).map((r) => ({ tool: "MRO Ferramenta", username: String(r.username || ""), current: false })),
          ...(dupeZap || []).filter((r) => r.id !== (zap?.id as string)).map((r) => ({ tool: "ZAPMRO", username: String(r.username || ""), current: false })),
        ].filter((r) => r.username && !currentAccounts.some((c) => c.username.toLowerCase() === r.username.toLowerCase()));

        if (others.length) {
          return json({
            success: false,
            conflict: true,
            // O acesso logado sempre vem primeiro para poder ser mantido como principal
            conflict_accounts: [...currentAccounts, ...others],
            error: "Este e-mail já está vinculado a outro acesso",
          }, 200);
        }

      }


      const patch: Record<string, unknown> = {};
      if (newEmailRaw) patch.email = newEmailRaw;
      if (newName !== null) patch.name = newName || null;
      if (newWhats !== null) patch.whatsapp = newWhats || null;
      if (newPassword) {
        patch.password_hash = await sha256(newPassword);
        patch.password_plain = newPassword;
      }
      if (Object.keys(patch).length === 0) return json({ success: true, unchanged: true });

      if (mro) await supabase.from("mro_tool_users").update(patch).eq("id", mro.id as string);
      if (zap) await supabase.from("zapmro_users").update(patch).eq("id", zap.id as string);

      const finalEmail = (patch.email as string) || String(mro?.email || zap?.email || email || "");
      const finalUser = String(mro?.username || zap?.username || username || "");

      return json({
        success: true,
        profile: {
          username: finalUser,
          email: finalEmail,
          name: (patch.name as string) ?? (mro?.name || zap?.name || ""),
          whatsapp: (patch.whatsapp as string) ?? (mro?.whatsapp || zap?.whatsapp || ""),
        },
        password: newPassword || password,
      });
    }

    // ================= UNIFICAR ACESSOS NO MESMO E-MAIL =================
    /**
     * Vincula o e-mail informado a TODOS os acessos do cliente (MRO + ZAPMRO),
     * inclusive os que já usavam esse e-mail, e envia um resumo por e-mail.
     */
    if (action === "merge_accounts") {
      const username = String(body.username || "").trim().toLowerCase();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const targetEmail = String(body.target_email || "").trim().toLowerCase();
      const newName = String(body.new_name || "").trim().slice(0, 120);
      const newWhats = String(body.new_whatsapp || "").replace(/\D/g, "").slice(0, 15);

      if (!password || (!username && !email)) return json({ success: false, error: "Credenciais inválidas" }, 400);
      if (!targetEmail.includes("@") || targetEmail.length > 255) return json({ success: false, error: "E-mail inválido" }, 400);
      if (newName && newName.length < 3) return json({ success: false, error: "Informe seu nome completo" }, 400);
      if (newWhats && newWhats.length < 10) return json({ success: false, error: "Informe um WhatsApp válido com DDD" }, 400);

      const { mro, zap } = await findAccounts(username, email, password);
      if (!mro && !zap) return json({ success: false, error: "Senha atual incorreta" }, 200);

      const safeEmail = targetEmail.replace(/[,()"']/g, "");

      // Guarda o estado ANTERIOR dos acessos que serão alterados (para permitir desfazer no /admin)
      const snapshot: Array<Record<string, unknown>> = [];
      if (mro) {
        snapshot.push({
          table: "mro_tool_users",
          tool: "MRO Ferramenta",
          id: String(mro.id),
          username: String(mro.username || ""),
          previous_email: mro.email ? String(mro.email) : null,
          changed: String(mro.email || "") !== targetEmail,
        });
      }
      if (zap) {
        snapshot.push({
          table: "zapmro_users",
          tool: "ZAPMRO",
          id: String(zap.id),
          username: String(zap.username || ""),
          previous_email: zap.email ? String(zap.email) : null,
          changed: String(zap.email || "") !== targetEmail,
        });
      }

      const completedProfilePatch: Record<string, unknown> = { email: targetEmail };
      if (newName) completedProfilePatch.name = newName;
      if (newWhats) completedProfilePatch.whatsapp = newWhats;

      // Aplica e-mail + dados obrigatórios nos acessos atuais
      if (mro) await supabase.from("mro_tool_users").update(completedProfilePatch).eq("id", mro.id as string);
      if (zap) await supabase.from("zapmro_users").update(completedProfilePatch).eq("id", zap.id as string);

      // Recolhe todos os acessos que agora compartilham o mesmo e-mail
      const { data: mroAll } = await supabase
        .from("mro_tool_users")
        .select("id,username,password_plain,expiration_days")
        .eq("email", safeEmail)
        .limit(20);
      const { data: zapAll } = await supabase
        .from("zapmro_users")
        .select("id,username,password_plain,days_remaining")
        .eq("email", safeEmail)
        .limit(20);

      const accounts = [
        ...(mroAll || []).map((r) => ({ tool: "MRO Ferramenta", username: String(r.username || ""), password: String(r.password_plain || "") })),
        ...(zapAll || []).map((r) => ({ tool: "ZAPMRO", username: String(r.username || ""), password: String(r.password_plain || "") })),
      ].filter((a) => a.username);

      // Garante que todos os acessos agora vinculados ao e-mail também recebam nome/WhatsApp,
      // evitando que o dashboard peça "Complete seu cadastro" novamente após atualizar a página.
      if (newName || newWhats) {
        const fullPatch: Record<string, unknown> = {};
        if (newName) fullPatch.name = newName;
        if (newWhats) fullPatch.whatsapp = newWhats;
        await supabase.from("mro_tool_users").update(fullPatch).eq("email", safeEmail);
        await supabase.from("zapmro_users").update(fullPatch).eq("email", safeEmail);
      }

      // Acessos que já usavam o e-mail antes da unificação entram no log apenas como referência
      const snapshotIds = new Set(snapshot.map((s) => String(s.id)));
      for (const r of mroAll || []) {
        if (!snapshotIds.has(String(r.id))) {
          snapshot.push({ table: "mro_tool_users", tool: "MRO Ferramenta", id: String(r.id), username: String(r.username || ""), previous_email: targetEmail, changed: false });
        }
      }
      for (const r of zapAll || []) {
        if (!snapshotIds.has(String(r.id))) {
          snapshot.push({ table: "zapmro_users", tool: "ZAPMRO", id: String(r.id), username: String(r.username || ""), previous_email: targetEmail, changed: false });
        }
      }

      // O cliente pode escolher qual acesso quer manter como principal
      const chosen = String(body.primary_username || "").trim().toLowerCase();
      const primary =
        (chosen ? accounts.find((a) => a.username.toLowerCase() === chosen) : null) ||
        accounts.find((a) => a.username.toLowerCase() === username) ||
        accounts[0] ||
        null;
      const primaryPassword = primary?.password || password;

      let emailSent = false;
      try {
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-unified-access-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            email: targetEmail,
            name: newName || String(mro?.name || zap?.name || ""),
            primaryUsername: primary?.username || username,
            primaryPassword,
            accounts,
          }),
        });
        const result = await res.json().catch(() => ({}));
        emailSent = res.ok && result?.success !== false;
      } catch {
        emailSent = false;
      }

      // Registra o log da unificação (permite desfazer depois pelo /admin)
      try {
        await supabase.from("hub_merge_logs").insert({
          target_email: targetEmail,
          primary_username: primary?.username || username,
          primary_tool: primary?.tool || (mro ? "MRO Ferramenta" : "ZAPMRO"),
          reason: "Unificação solicitada pelo cliente no /dashboard (e-mail já vinculado a outro acesso)",
          accounts: snapshot,
          email_sent: emailSent,
        });
      } catch (_e) {
        // O log é auxiliar: nunca deve quebrar a unificação em si
      }

      return json({
        success: true,
        email: targetEmail,
        emailSent,
        accounts,
        primary: { username: primary?.username || username, password: primaryPassword },
        profile: {
          username: primary?.username || username,
          email: targetEmail,
          name: newName || String(mro?.name || zap?.name || ""),
          whatsapp: newWhats || String(mro?.whatsapp || zap?.whatsapp || ""),
        },
      });
    }

    // ================= ADMIN: LOGS DE UNIFICAÇÃO =================
    if (action === "admin_list_merges") {
      const { data, error } = await supabase
        .from("hub_merge_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) return json({ success: false, error: "Não foi possível carregar os logs" }, 500);
      return json({ success: true, merges: data || [] });
    }

    if (action === "admin_undo_merge") {
      const id = String(body.id || "").trim();
      if (!id) return json({ success: false, error: "Log inválido" }, 400);

      const { data: log } = await supabase.from("hub_merge_logs").select("*").eq("id", id).maybeSingle();
      if (!log) return json({ success: false, error: "Log não encontrado" }, 404);
      if (log.reverted) return json({ success: false, error: "Esta unificação já foi desfeita" }, 200);

      const rows = Array.isArray(log.accounts) ? (log.accounts as Array<Record<string, unknown>>) : [];
      let restored = 0;
      for (const row of rows) {
        // Só desfaz o que realmente foi alterado pela unificação
        if (!row?.changed) continue;
        const table = String(row.table || "");
        if (table !== "mro_tool_users" && table !== "zapmro_users") continue;
        const prev = row.previous_email ? String(row.previous_email) : null;
        const { error } = await supabase.from(table).update({ email: prev }).eq("id", String(row.id));
        if (!error) restored++;
      }

      await supabase
        .from("hub_merge_logs")
        .update({ reverted: true, reverted_at: new Date().toISOString() })
        .eq("id", id);

      return json({ success: true, restored });
    }




    // ================= RECUPERAR ACESSO POR E-MAIL =================
    if (action === "recover_access") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email.includes("@") || email.length > 255) return json({ success: false, error: "Informe um e-mail válido" }, 400);
      const safeEmail = email.replace(/[,()"']/g, "");

      const { data: mroRows } = await supabase
        .from("mro_tool_users")
        .select("username,email,password_plain,expiration_days")
        .eq("email", safeEmail)
        .limit(1);
      const { data: zapRows } = await supabase
        .from("zapmro_users")
        .select("username,email,password_plain,days_remaining")
        .eq("email", safeEmail)
        .limit(1);

      const account = mroRows?.[0] || zapRows?.[0] || null;
      if (!account) {
        return json({
          success: false,
          notFound: true,
          error:
            "Não encontramos seu e-mail no nosso sistema. Por favor entre em contato com nosso administrador em maisresultadosonline.com.br/whatsapp",
        }, 200);
      }
      if (!account.password_plain) {
        return json({
          success: false,
          error:
            "Não conseguimos recuperar sua senha automaticamente. Fale com nosso administrador em maisresultadosonline.com.br/whatsapp",
        }, 200);
      }

      // Um único e-mail de lembrete, pois todos os produtos ficam vinculados ao mesmo e-mail.
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          email,
          username: account.username || email,
          password: account.password_plain,
          daysRemaining: Number(account.expiration_days ?? account.days_remaining ?? 0) || undefined,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.success === false) {
        return json({ success: false, error: "Falha ao enviar o e-mail. Tente novamente em instantes." }, 200);
      }
      return json({ success: true, email });
    }

    return json({ success: false, error: "Ação inválida" }, 400);

  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Erro inesperado" }, 500);
  }
});
