import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mesmas credenciais administrativas usadas pelos demais painéis (validadas só no servidor).
const ADMIN_EMAIL = "mro@gmail.com";
const ADMIN_PASSWORD = "Ga145523@";
const RETENTION_DAYS = 90;

const clip = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n) || null);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const isAdmin = () =>
      String(body.email || "").trim().toLowerCase() === ADMIN_EMAIL && String(body.password || "") === ADMIN_PASSWORD;

    if (action === "admin_login") return isAdmin() ? json({ success: true }) : json({ success: false }, 401);

    if (action === "get_video") {
      const { data } = await supabase.from("euro_page_settings").select("video_url, hls_url, video_title")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      return json({ video_url: data?.video_url || null, hls_url: data?.hls_url || null, video_title: data?.video_title || null });
    }

    if (action === "set_video") {
      if (!isAdmin()) return json({ success: false, error: "Não autorizado" }, 401);
      const row = {
        video_url: clip(body.video_url, 500), hls_url: clip(body.hls_url, 500),
        video_title: clip(body.video_title, 200), updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase.from("euro_page_settings").select("id")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      const { error } = existing
        ? await supabase.from("euro_page_settings").update(row).eq("id", existing.id)
        : await supabase.from("euro_page_settings").insert(row);
      return error ? json({ success: false, error: error.message }, 500) : json({ success: true });
    }

    if (action === "track_visit") {
      const h = req.headers;
      const ip = (h.get("cf-connecting-ip") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "").trim();
      await supabase.from("euro_page_visits").insert({
        ip: clip(ip, 64),
        // Região aproximada vinda dos cabeçalhos do proxy (sem consulta externa).
        country: clip(h.get("cf-ipcountry"), 8),
        region: clip(h.get("cf-region") || h.get("x-vercel-ip-country-region"), 80),
        city: clip(h.get("cf-ipcity") || h.get("x-vercel-ip-city"), 80),
        path: clip(body.path, 200),
        user_agent: clip(h.get("user-agent"), 300),
      });
      // Retenção: apaga registros antigos.
      await supabase.from("euro_page_visits").delete()
        .lt("created_at", new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString());
      return json({ success: true });
    }

    if (action === "list_visits") {
      if (!isAdmin()) return json({ success: false, error: "Não autorizado" }, 401);
      const { data, error } = await supabase.from("euro_page_visits")
        .select("id, ip, country, region, city, path, user_agent, created_at")
        .order("created_at", { ascending: false }).limit(500);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, visits: data || [] });
    }

    if (action === "list_orders") {
      if (!isAdmin()) return json({ success: false, error: "Não autorizado" }, 401);
      const { data, error } = await supabase.from("mro_euro_orders")
        .select("*").order("created_at", { ascending: false }).limit(2000);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, orders: data || [] });
    }

    if (action === "delete_order") {
      if (!isAdmin()) return json({ success: false, error: "Não autorizado" }, 401);
      const id = clip(body.id, 64);
      if (!id) return json({ success: false, error: "ID inválido" }, 400);
      const { error } = await supabase.from("mro_euro_orders").delete().eq("id", id);
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
