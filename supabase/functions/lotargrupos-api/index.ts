import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyAdminSessionToken } from "../_shared/admin-session.ts";

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
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
