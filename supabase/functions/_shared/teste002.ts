// Regras compartilhadas do teste grátis /teste002 (1 dia, 1 Instagram, só Seguir/Curtir/Boas-vindas).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const TESTE002_ALLOWED = ["follow", "like", "welcome_message"] as const;
export const TESTE002_BLOCKED = [
  "audience_tracking", "mass_message", "ai_agent", "crm_kanban", "auto_stories", "unfollow", "ai_strategy",
] as const;
export const TESTE002_BUY_LINK = "https://maisresultadosonline.com.br/ferramentamropromo";

export interface Teste002Row {
  id: string; full_name: string; email: string; whatsapp: string; instagram_username: string;
  username: string; password_hash: string; expires_at: string; last_access: string | null; created_at: string;
}

export const sha256Hex = async (v: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

export const normalizeHandle = (v: unknown) =>
  String(v ?? "").trim().toLowerCase().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .split(/[/?#]/)[0].replace(/[^a-z0-9._]/g, "").slice(0, 30);

export function teste002Info(row: Teste002Row) {
  const ms = Date.parse(row.expires_at) - Date.now();
  return {
    username: row.username,
    instagram: row.instagram_username,
    created_at: row.created_at,
    expires_at: row.expires_at,
    expired: ms <= 0,
    remaining_hours: Math.max(0, Math.round((ms / 36e5) * 10) / 10),
    max_accounts: 1,
    allowed_features: [...TESTE002_ALLOWED],
    blocked_features: [...TESTE002_BLOCKED],
  };
}

/** Login da extensão com usuário de teste. Retorna null se o identificador não é de teste. */
export async function teste002ExtensionLogin(db: Db, identifier: string, password: string, instagramRaw: unknown) {
  const id = identifier.trim().toLowerCase();
  const { data } = await db.from("teste002_users").select("*")
    .or(`username.eq.${normalizeHandle(id)},email.eq.${id.replace(/[,()]/g, "")}`).order("created_at", { ascending: false }).limit(1);
  const row = (data?.[0] ?? null) as Teste002Row | null;
  if (!row) return null;
  if ((await sha256Hex(password)) !== row.password_hash) return { success: false, error: "Usuário ou senha incorretos" };
  const test = teste002Info(row);
  if (test.expired) {
    return {
      success: false, is_test_user: true, test_expired: true, needs_renewal: true, test,
      error: "Seu teste grátis de 1 dia terminou. Este Instagram já fez o teste — para continuar, adquira um plano.",
      buy_link: TESTE002_BUY_LINK,
    };
  }
  const ig = normalizeHandle(instagramRaw);
  if (ig && ig !== row.instagram_username) {
    return {
      success: false, is_test_user: true, instagram_not_registered: true, instagram: ig, test,
      error: `O teste grátis é válido apenas para o Instagram @${row.instagram_username}.`,
    };
  }
  await db.from("teste002_users").update({ last_access: new Date().toISOString() }).eq("id", row.id);
  return {
    success: true,
    is_test_user: true,
    ...(ig ? { instagram_verified: true, instagram: { username: ig, registered: true, source: "teste002", is_trial: true, trial_expires_at: row.expires_at } } : {}),
    test,
    user: {
      id: row.id, username: row.username, email: row.email, name: row.full_name, is_active: true,
      is_test_user: true, plan_accounts: 1, extra_accounts: 0, total_accounts: 1,
      expires_at: row.expires_at, access_allowed: true, expired: false, created_at: row.created_at,
    },
    accounts: [{ id: row.id, instagram_username: row.instagram_username, is_trial: true, trial_expires_at: row.expires_at }],
    trial_accounts: [],
    slots: { total: 1, used: 1, available: 0 },
  };
}
