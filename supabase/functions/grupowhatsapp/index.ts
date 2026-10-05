import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isMroAdminLogin, resolveMroAdminCredentials } from "../_shared/mro-admin-credentials.ts";
import { createAdminSessionToken, verifyAdminSessionToken } from "../_shared/admin-session.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const SCOPE = "grupowhatsapp-admin";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const { sessionSecret } = resolveMroAdminCredentials();
    const isAdmin = async () => !!(await verifyAdminSessionToken(String(body.token ?? ""), sessionSecret, SCOPE));

    const getLink = async () => {
      const { data } = await db.from("grupowhatsapp_settings").select("id, grupo_link")
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      return data;
    };

    if (action === "login") {
      if (!isMroAdminLogin(body.email, body.password)) return json({ success: false, error: "Credenciais inválidas" }, 401);
      const token = await createAdminSessionToken(
        { email: String(body.email).toLowerCase(), scope: SCOPE, exp: Date.now() + 7 * 864e5 }, sessionSecret);
      return json({ success: true, token });
    }

    if (action === "register") {
      const nome = clean(body.nome, 120), email = clean(body.email, 255).toLowerCase(), whatsapp = clean(body.whatsapp, 30);
      if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || whatsapp.replace(/\D/g, "").length < 10)
        return json({ success: false, error: "Dados inválidos" }, 400);
      const tem = typeof body.tem_computador === "boolean" ? body.tem_computador : null;
      const { error } = await db.from("grupowhatsapp_leads").insert({ nome, email, whatsapp, tem_computador: tem });
      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, grupo_link: tem ? (await getLink())?.grupo_link ?? "" : "" });
    }

    if (!(await isAdmin())) return json({ success: false, error: "Unauthorized" }, 401);

    if (action === "list") {
      const { data, error } = await db.from("grupowhatsapp_leads").select("*")
        .order("created_at", { ascending: false }).limit(5000);
      if (error) return json({ success: false, error: error.message }, 400);
      return json({ success: true, leads: data ?? [], grupo_link: (await getLink())?.grupo_link ?? "" });
    }

    if (action === "save_settings") {
      const link = clean(body.grupo_link, 500);
      if (link && !/^https:\/\//i.test(link)) return json({ success: false, error: "Use um link https://" }, 400);
      const cur = await getLink();
      if (cur?.id) await db.from("grupowhatsapp_settings").update({ grupo_link: link, updated_at: new Date().toISOString() }).eq("id", cur.id);
      else await db.from("grupowhatsapp_settings").insert({ grupo_link: link });
      return json({ success: true });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
