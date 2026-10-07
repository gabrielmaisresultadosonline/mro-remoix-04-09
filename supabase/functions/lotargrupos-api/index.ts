import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyAdminSessionToken } from "../_shared/admin-session.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { htmlToPlainText } from "../_shared/email-encode.ts";

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Envia e-mail e senha de acesso ao Lotar Grupos (entrada pelo /dashboard). */
async function sendCredentialsEmail(to: string, name: string, password: string): Promise<boolean> {
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  if (!smtpPassword) return false;
  const url = "https://maisresultadosonline.com.br/dashboard";
  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:0;background:#f4f7f9;font-family:Arial,sans-serif;color:#333"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px"><tr><td style="padding:30px;text-align:center;background:#16a34a;color:#fff"><h1 style="margin:0;font-size:24px">Lotar Grupos</h1><p style="margin:8px 0 0">Seus dados de acesso</p></td></tr><tr><td style="padding:30px"><p>Olá, <strong>${esc(name)}</strong>!</p><p>Seus dados de acesso ao <strong>Lotar Grupos</strong> foram atualizados. Entre pela área de membros:</p><table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin:16px 0"><tr><td><p style="margin:4px 0"><strong>E-mail:</strong> ${esc(to)}</p><p style="margin:4px 0"><strong>Senha:</strong> ${esc(password)}</p></td></tr></table><p style="text-align:center"><a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:bold">Acessar o Dashboard</a></p><p style="font-size:13px;color:#666">No dashboard, clique em <strong>Acessar</strong> no card Lotar Grupos.</p></td></tr></table></body></html>`;
  try {
    const client = new SMTPClient({ connection: { hostname: "smtp.hostinger.com", port: 465, tls: true, auth: { username: "suporte@maisresultadosonline.com.br", password: smtpPassword } } });
    await client.send({ from: "MRO <suporte@maisresultadosonline.com.br>", to, subject: "Seus dados de acesso - Lotar Grupos", content: htmlToPlainText(html), html });
    await client.close();
    return true;
  } catch (e) { console.error("[lotargrupos] email error", e); return false; }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, admin_token } = body;

    // Verify admin token (same HMAC session token used by the main admin panel)
    if (action.startsWith("admin_")) {
      const sessionSecret = Deno.env.get("MRO_ADMIN_SESSION_SECRET") ?? "";
      const admin = sessionSecret
        ? await verifyAdminSessionToken(admin_token, sessionSecret, "mro-main-admin")
        : null;

      if (!admin) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "admin_list_lessons") {
      const { data, error } = await supabaseClient
        .from("lotargrupos_lessons")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, lessons: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_save_lesson") {
      const { lesson } = body;
      const { data, error } = await supabaseClient
        .from("lotargrupos_lessons")
        .upsert(lesson)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, lesson: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_delete_lesson") {
      const { id } = body;
      const { error } = await supabaseClient.from("lotargrupos_lessons").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_list_users") {
      const { data, error } = await supabaseClient
        .from("lotargrupos_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, users: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_add_user_manual") {
      const { user } = body;
      const normalizedEmail = String(user?.email ?? "").trim().toLowerCase();
      if (!normalizedEmail || !user?.name) throw new Error("Nome e e-mail são obrigatórios");
      
      // Criar o usuário no Auth se não existir
      const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
        email: normalizedEmail,
        password: user.password || 'Mro@123456',
        email_confirm: true,
        user_metadata: { name: user.name }
      });

      if (authError && authError.message !== 'User already exists') throw authError;

      const user_id = authUser?.user?.id;
      
      const { data: existingUsers, error: lookupError } = await supabaseClient
        .from("lotargrupos_users")
        .select("id,user_id,status,created_at")
        .ilike("email", normalizedEmail)
        .order("created_at", { ascending: true });
      if (lookupError) throw lookupError;

      const existingUser = (existingUsers || []).find((entry) => entry.status === "active")
        || existingUsers?.[0];
      const payload = {
        user_id: user_id || existingUser?.user_id || null,
        name: user.name,
        email: normalizedEmail,
        status: "active",
      };
      const query = existingUser
        ? supabaseClient.from("lotargrupos_users").update(payload).eq("id", existingUser.id)
        : supabaseClient.from("lotargrupos_users").insert(payload);
      const { data, error } = await query
        .select()
        .single();
        
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, user: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_update_user") {
      const { id, updates } = body;
      const { data, error } = await supabaseClient
        .from("lotargrupos_users")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, user: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_set_credentials") {
      const id = String(body.id || "");
      const name = String(body.name || "").trim().slice(0, 120);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 255);
      const password = String(body.password || "").trim();
      const sendEmail = body.send_email !== false;
      if (!id || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Nome e e-mail válidos são obrigatórios");
      if (password && (password.length < 6 || password.length > 72)) throw new Error("A senha precisa ter de 6 a 72 caracteres");

      const { data: row, error: rowErr } = await supabaseClient.from("lotargrupos_users").select("*").eq("id", id).maybeSingle();
      if (rowErr) throw rowErr;
      if (!row) throw new Error("Aluno não encontrado");

      // Localiza o login do aluno: vínculo salvo, e-mail atual ou novo e-mail.
      const findByEmail = async (target: string): Promise<string | null> => {
        if (!target) return null;
        for (let page = 1; page <= 20; page++) {
          const { data: list, error: lErr } = await supabaseClient.auth.admin.listUsers({ page, perPage: 1000 });
          if (lErr) throw lErr;
          const found = list?.users?.find((u) => (u.email || "").toLowerCase() === target.toLowerCase());
          if (found) return found.id;
          if (!list?.users?.length || list.users.length < 1000) break;
        }
        return null;
      };
      let authId: string | null = row.user_id || null;
      if (authId) {
        const { data: chk } = await supabaseClient.auth.admin.getUserById(authId);
        if (!chk?.user) authId = null; // vínculo antigo apontando para login removido
      }
      if (!authId) authId = await findByEmail(String(row.email || ""));
      // Se o novo e-mail já pertence a outro login, usa esse login (evita conflito "already registered").
      const owner = email !== String(row.email || "").toLowerCase() ? await findByEmail(email) : null;
      if (owner && owner !== authId) authId = owner;
      if (authId) {
        const attrs: Record<string, unknown> = { email, email_confirm: true, user_metadata: { name } };
        if (password) attrs.password = password;
        const { error } = await supabaseClient.auth.admin.updateUserById(authId, attrs);
        if (error) throw new Error(`Não foi possível atualizar o login: ${error.message}`);
      } else {
        if (!password) throw new Error("Defina uma senha para criar o login deste aluno");
        const { data: created, error } = await supabaseClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
        if (error) throw new Error(`Não foi possível criar o login: ${error.message}`);
        authId = created.user?.id || null;
      }

      const { data: updated, error: upErr } = await supabaseClient.from("lotargrupos_users")
        .update({ name, email, user_id: authId }).eq("id", id).select().single();
      if (upErr) throw upErr;

      let emailSent = false;
      if (sendEmail && password) emailSent = await sendCredentialsEmail(email, name, password);
      return new Response(JSON.stringify({ success: true, user: updated, email_sent: emailSent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_list_sales") {
      const { data, error } = await supabaseClient
        .from("zapmro_orders")
        .select("*")
        .eq("plan_type", "lotargrupos")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, sales: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_approve_sale") {
      const { nsu_order } = body;
      
      // Buscar o pedido
      const { data: order, error: orderErr } = await supabaseClient
        .from("zapmro_orders")
        .select("*")
        .eq("nsu_order", nsu_order)
        .maybeSingle();
        
      if (orderErr || !order) throw new Error("Pedido não encontrado");

      // Invocar o webhook internamente para simular a aprovação (ou processar manualmente)
      // Como o webhook é externo, vamos replicar a lógica de ativação aqui por simplicidade
      
      const normalizedEmail = String(order.email ?? "").trim().toLowerCase();
      const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
        email: normalizedEmail,
        password: order.metadata?.password_plain || 'Mro@123456',
        email_confirm: true,
        user_metadata: { name: order.username }
      });

      if (authError && authError.message !== 'User already exists') {
        // Se já existe, apenas buscar o ID
      }

      const { data: existingUsers } = await supabaseClient
        .from("lotargrupos_users")
        .select("id,user_id,status,created_at")
        .ilike("email", normalizedEmail)
        .order("created_at", { ascending: true });
      const existingUser = (existingUsers || []).find((entry) => entry.status === "active")
        || existingUsers?.[0];
      const payload = {
        user_id: authUser?.user?.id || existingUser?.user_id || null,
        name: order.username,
        email: normalizedEmail,
        status: "active",
      };
      if (existingUser) {
        await supabaseClient.from("lotargrupos_users").update(payload).eq("id", existingUser.id);
      } else {
        await supabaseClient.from("lotargrupos_users").insert(payload);
      }

      await supabaseClient
        .from("zapmro_orders")
        .update({ status: 'paid' })
        .eq("nsu_order", nsu_order);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Status 200 com success:false para que o painel mostre a mensagem real (não "non-2xx").
    const message = error instanceof Error ? error.message : (error as { message?: string })?.message || String(error);
    console.error("[lotargrupos-api] error", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
