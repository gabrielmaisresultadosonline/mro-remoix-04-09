// Regras compartilhadas do teste grátis /teste002 (1 dia, 1 Instagram, só Seguir/Curtir/Boas-vindas).
// O Instagram é cadastrado pela extensão no primeiro uso; o dia de teste começa nesse momento.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const TESTE002_ALLOWED = ["follow", "like", "welcome_message"] as const;
export const TESTE002_BLOCKED = [
  "audience_tracking", "mass_message", "ai_agent", "crm_kanban", "auto_stories", "unfollow", "ai_strategy",
] as const;
export const TESTE002_BUY_LINK = "https://maisresultadosonline.com.br/ferramentapromo";

export interface Teste002Row {
  id: string; full_name: string; email: string; whatsapp: string; instagram_username: string | null;
  username: string; password_hash: string; expires_at: string | null; last_access: string | null; created_at: string;
}

export const sha256Hex = async (v: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

export const normalizeHandle = (v: unknown) =>
  String(v ?? "").trim().toLowerCase().replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/^@+/, "")
    .split(/[/?#]/)[0].replace(/[^a-z0-9._]/g, "").slice(0, 30);

export function teste002Info(row: Teste002Row) {
  const started = Boolean(row.instagram_username && row.expires_at);
  const ms = row.expires_at ? Date.parse(row.expires_at) - Date.now() : 864e5;
  return {
    username: row.username,
    instagram: row.instagram_username,
    instagram_registered: Boolean(row.instagram_username),
    started,
    created_at: row.created_at,
    expires_at: row.expires_at,
    expired: started && ms <= 0,
    remaining_hours: started ? Math.max(0, Math.round((ms / 36e5) * 10) / 10) : 24,
    duration_hours: 24,
    max_accounts: 1,
    allowed_features: [...TESTE002_ALLOWED],
    blocked_features: [...TESTE002_BLOCKED],
  };
}

/** Busca o usuário de teste por usuário ou e-mail e confere a senha. */
export async function teste002Auth(db: Db, identifier: unknown, password: unknown) {
  const id = String(identifier ?? "").trim().toLowerCase().replace(/^@+/, "");
  const pass = String(password ?? "");
  if (!id || !pass) return { row: null as Teste002Row | null, found: false };
  const safe = id.replace(/[^a-z0-9._@+-]/g, "");
  const { data } = await db.from("teste002_users").select("*")
    .or(`username.eq.${safe},email.eq.${safe}`).order("created_at", { ascending: false }).limit(1);
  const row = (data?.[0] ?? null) as Teste002Row | null;
  if (!row) return { row: null, found: false };
  const h = await sha256Hex(pass);
  const ok = h === row.password_hash || (await sha256Hex(pass.trim().toLowerCase())) === row.password_hash;
  return { row: ok ? row : null, found: true };
}

/** Cadastra o Instagram do teste (1 por cadastro, 1 teste por Instagram). */
export async function teste002RegisterInstagram(db: Db, row: Teste002Row, igRaw: unknown) {
  const ig = normalizeHandle(igRaw);
  if (ig.length < 2) return { ok: false as const, body: { success: false, error: "Informe o @ do Instagram." } };
  if (row.instagram_username) {
    if (row.instagram_username === ig) return { ok: true as const, row };
    return { ok: false as const, body: { success: false, is_test_user: true, instagram_not_registered: true, instagram: ig, test: teste002Info(row),
      error: `O teste grátis é válido apenas para o Instagram @${row.instagram_username}.` } };
  }
  const { data: used } = await db.from("teste002_users").select("full_name, email").eq("instagram_username", ig).neq("id", row.id).limit(1);
  if (used?.length) {
    return { ok: false as const, body: {
      success: false, is_test_user: true, instagram_already_tested: true, needs_purchase: true, instagram: ig,
      tested_by: { name: used[0].full_name, email: used[0].email },
      error: `Este Instagram @${ig} já foi usado no teste grátis de ${used[0].full_name} (${used[0].email}). Para usar novamente neste Instagram é preciso comprar um plano.`,
      buy_link: TESTE002_BUY_LINK,
    } };
  }
  const expires_at = new Date(Date.now() + 864e5).toISOString();
  const { data: upd, error } = await db.from("teste002_users")
    .update({ instagram_username: ig, expires_at, updated_at: new Date().toISOString() })
    .eq("id", row.id).is("instagram_username", null).select("*").maybeSingle();
  if (error || !upd) {
    return { ok: false as const, body: { success: false, is_test_user: true, instagram_already_tested: true, needs_purchase: true,
      instagram: ig, error: `Este Instagram @${ig} já foi usado no teste grátis. Para usar novamente é preciso comprar um plano.`, buy_link: TESTE002_BUY_LINK } };
  }
  return { ok: true as const, row: upd as Teste002Row, registered_now: true };
}

function successPayload(row: Teste002Row, verifiedIg: string | null) {
  const test = teste002Info(row);
  const accounts = row.instagram_username
    ? [{ id: row.id, instagram_username: row.instagram_username, is_trial: true, trial_expires_at: row.expires_at }] : [];
  return {
    success: true,
    is_test_user: true,
    ...(verifiedIg ? { instagram_verified: true, instagram: { username: verifiedIg, registered: true, source: "teste002", is_trial: true, trial_expires_at: row.expires_at } } : {}),
    test,
    user: {
      id: row.id, username: row.username, email: row.email, name: row.full_name, is_active: true,
      is_test_user: true, plan_accounts: 1, extra_accounts: 0, total_accounts: 1,
      expires_at: row.expires_at, access_allowed: true, expired: false, created_at: row.created_at,
    },
    accounts,
    trial_accounts: [],
    slots: { total: 1, used: accounts.length, available: 1 - accounts.length },
  };
}

const expiredBody = (row: Teste002Row) => ({
  success: false, is_test_user: true, test_expired: true, needs_renewal: true, needs_purchase: true, test: teste002Info(row),
  error: `Seu teste grátis de 1 dia terminou. O Instagram @${row.instagram_username} já fez o teste — para continuar, adquira um plano.`,
  buy_link: TESTE002_BUY_LINK,
});

/** Login da extensão com usuário de teste. Retorna null se o identificador não é de teste. */
export async function teste002ExtensionLogin(db: Db, identifier: string, password: string, instagramRaw: unknown) {
  const { row, found } = await teste002Auth(db, identifier, password);
  if (!found) return null;
  if (!row) return { success: false, error: "Usuário ou senha incorretos" };
  if (teste002Info(row).expired) return expiredBody(row);
  const ig = normalizeHandle(instagramRaw);
  let current = row;
  if (ig) {
    const r = await teste002RegisterInstagram(db, row, ig);
    if (!r.ok) return r.body;
    current = r.row;
  }
  await db.from("teste002_users").update({ last_access: new Date().toISOString(), last_extension_access: new Date().toISOString() }).eq("id", row.id);
  return successPayload(current, ig || null);
}

/** Ação explícita de cadastro do Instagram do teste (pela extensão). */
export async function teste002AddAccount(db: Db, identifier: unknown, password: unknown, instagramRaw: unknown) {
  const { row, found } = await teste002Auth(db, identifier, password);
  if (!found) return null;
  if (!row) return { success: false, error: "Usuário ou senha incorretos" };
  if (teste002Info(row).expired) return expiredBody(row);
  const r = await teste002RegisterInstagram(db, row, instagramRaw);
  if (!r.ok) return r.body;
  return { ...successPayload(r.row, r.row.instagram_username), registered_now: Boolean(r.registered_now) };
}
