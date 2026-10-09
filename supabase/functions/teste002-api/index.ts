import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { isMroAdminLogin, resolveMroAdminCredentials } from "../_shared/mro-admin-credentials.ts";
import { createAdminSessionToken, verifyAdminSessionToken } from "../_shared/admin-session.ts";
import { normalizeHandle, sha256Hex, teste002Info, type Teste002Row } from "../_shared/teste002.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const SCOPE = "teste002-admin";
const SITE = "https://maisresultadosonline.com.br/teste002/dashboard";

async function sendAccessEmail(to: string, name: string, username: string, expiresAt: string): Promise<boolean> {
  const pass = Deno.env.get("SMTP_PASSWORD");
  if (!pass) return false;
  const fim = new Date(expiresAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const html = `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;color:#fafafa"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#171717;border-radius:10px;border:1px solid #404040"><tr><td style="padding:28px;text-align:center;border-bottom:3px solid #eab308"><h1 style="margin:0;font-size:24px;color:#eab308">TESTE GRÁTIS — Ferramenta MRO</h1><p style="margin:8px 0 0;color:#d4d4d4">Seu acesso de 1 dia está pronto</p></td></tr><tr><td style="padding:28px"><p>Olá, <strong>${esc(name)}</strong>!</p><p>Use os dados abaixo para entrar:</p><table width="100%" style="background:#0a0a0a;border:1px solid #404040;border-radius:8px;padding:16px;margin:16px 0"><tr><td><p style="margin:4px 0"><strong>Site:</strong> ${SITE}</p><p style="margin:4px 0"><strong>Usuário:</strong> ${esc(username)}</p><p style="margin:4px 0"><strong>Senha:</strong> ${esc(username)}</p><p style="margin:4px 0;color:#eab308"><strong>Válido até:</strong> ${esc(fim)}</p></td></tr></table><p style="text-align:center"><a href="${SITE}" style="display:inline-block;background:#eab308;color:#0a0a0a;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">ACESSAR MEU TESTE</a></p><p style="font-size:13px;color:#a3a3a3">No teste estão liberados apenas Seguir, Curtir e Boas-vindas, em 1 conta do Instagram. Após o teste, esse Instagram fica registrado como teste já realizado.</p></td></tr></table></body></html>`;
  try {
    const client = new SMTPClient({ connection: { hostname: "smtp.hostinger.com", port: 465, tls: true, auth: { username: "suporte@maisresultadosonline.com.br", password: pass } } });
    await client.send({ from: "MRO <suporte@maisresultadosonline.com.br>", to, subject: "Seu TESTE GRÁTIS da Ferramenta MRO está liberado", html, content: `Usuário: ${username} | Senha: ${username} | Acesse: ${SITE}` });
    await client.close();
    return true;
  } catch (e) {
    console.error("[teste002] email falhou:", e instanceof Error ? e.message : e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const { sessionSecret } = resolveMroAdminCredentials();

    const getSettings = async () => {
      const { data } = await db.from("teste002_settings").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
      return data as { id: string; video_url: string; install_url: string } | null;
    };

    if (action === "register") {
      const full_name = clean(body.full_name, 120);
      const email = clean(body.email, 255).toLowerCase();
      const whatsapp = clean(body.whatsapp, 30);
      const instagram = normalizeHandle(body.instagram);
      if (full_name.length < 3) return json({ success: false, error: "Informe seu nome completo." }, 400);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ success: false, error: "E-mail inválido." }, 400);
      if (whatsapp.replace(/\D/g, "").length < 10) return json({ success: false, error: "WhatsApp inválido." }, 400);
      if (instagram.length < 2) return json({ success: false, error: "Informe o @ do Instagram." }, 400);

      const { data: exists } = await db.from("teste002_users").select("id").eq("instagram_username", instagram).limit(1);
      if (exists?.length) return json({ success: false, already_tested: true, error: `O Instagram @${instagram} já fez o teste grátis. Para continuar, adquira um plano.` }, 409);

      const username = instagram;
      const { data: row, error } = await db.from("teste002_users").insert({
        full_name, email, whatsapp, instagram_username: instagram, username,
        password_hash: await sha256Hex(username),
        expires_at: new Date(Date.now() + 864e5).toISOString(),
      }).select("*").single();
      if (error) {
        if (error.code === "23505") return json({ success: false, already_tested: true, error: `O Instagram @${instagram} já fez o teste grátis.` }, 409);
        return json({ success: false, error: error.message }, 400);
      }
      const sent = await sendAccessEmail(email, full_name, username, row.expires_at);
      if (sent) await db.from("teste002_users").update({ email_sent: true }).eq("id", row.id);
      return json({ success: true, username, email_sent: sent, expires_at: row.expires_at });
    }

    if (action === "user_login") {
      const u = normalizeHandle(body.username);
      const p = String(body.password ?? "").trim().toLowerCase();
      if (!u || !p) return json({ success: false, error: "Informe usuário e senha." }, 400);
      const { data } = await db.from("teste002_users").select("*").eq("username", u).limit(1);
      const row = data?.[0] as Teste002Row | undefined;
      if (!row || (await sha256Hex(p)) !== row.password_hash) return json({ success: false, error: "Usuário ou senha incorretos." }, 401);
      await db.from("teste002_users").update({ last_access: new Date().toISOString() }).eq("id", row.id);
      const s = await getSettings();
      return json({ success: true, name: row.full_name, test: teste002Info(row), video_url: s?.video_url ?? "", install_url: s?.install_url ?? "" });
    }

    if (action === "login") {
      if (!isMroAdminLogin(body.email, body.password)) return json({ success: false, error: "Credenciais inválidas" }, 401);
      const token = await createAdminSessionToken({ email: String(body.email).toLowerCase(), scope: SCOPE, exp: Date.now() + 7 * 864e5 }, sessionSecret);
      return json({ success: true, token });
    }

    if (!(await verifyAdminSessionToken(String(body.token ?? ""), sessionSecret, SCOPE))) return json({ success: false, error: "Unauthorized" }, 401);

    if (action === "list") {
      const { data, error } = await db.from("teste002_users")
        .select("id, full_name, email, whatsapp, instagram_username, username, expires_at, last_access, email_sent, created_at")
        .order("created_at", { ascending: false }).limit(5000);
      if (error) return json({ success: false, error: error.message }, 400);
      const s = await getSettings();
      return json({ success: true, users: data ?? [], video_url: s?.video_url ?? "", install_url: s?.install_url ?? "" });
    }

    if (action === "save_settings") {
      const video_url = clean(body.video_url, 600), install_url = clean(body.install_url, 600);
      for (const l of [video_url, install_url]) if (l && !/^https:\/\//i.test(l)) return json({ success: false, error: "Use links https://" }, 400);
      const cur = await getSettings();
      if (cur?.id) await db.from("teste002_settings").update({ video_url, install_url, updated_at: new Date().toISOString() }).eq("id", cur.id);
      else await db.from("teste002_settings").insert({ video_url, install_url });
      return json({ success: true });
    }

    if (action === "delete") {
      await db.from("teste002_users").delete().eq("id", String(body.id ?? ""));
      return json({ success: true });
    }

    return json({ success: false, error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
