/**
 * Referência inicial única por perfil (painel + admin) contra um PostgreSQL real.
 * Uso: IG_TEST_DATABASE_URL=postgres://... npx tsx tests/ig-profile-baseline.test.ts
 * (o banco precisa das migrações 019–024 e das tabelas mro_tool_*, user_sessions,
 *  squarecloud_user_profiles).
 */
import assert from "node:assert/strict";
process.env.DATABASE_URL = process.env.IG_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";
const express = (await import("express")).default;
const { handleNativeIgOnline } = await import("../src/functions/ig-online-native.js");
const { handleNativeUserCloudStorage } = await import("../src/functions/user-cloud-storage-native.js");
const { recordProfileReading } = await import("../src/functions/ig-profile-baseline.js");
const { createAdminSession } = await import("../src/admin-session.js");
const { pool } = await import("../src/db.js");

const app = express();
app.use(express.json({ limit: "5mb" }));
app.post("/ig", async (req, res) => { await handleNativeIgOnline(req, res); });
app.post("/cloud", async (req, res) => {
  try { await handleNativeUserCloudStorage(req, res); }
  catch (e: any) { res.status(e?.status ?? 500).json({ error: String(e?.message ?? e) }); }
});
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const admin = createAdminSession("mro@gmail.com").token;
const post = async (path: string, body: object, token?: string) => {
  const r = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: (await r.json()) as Record<string, any> };
};
const USER = "baseuser";
const auth = { username: USER, auth_token: `${USER}_tok` };
const placeholder = (ig: string, id: string) => ({
  id, profile: { username: ig, followers: 0, following: 0, posts: 0, dataSource: "placeholder", needsScreenshotAnalysis: true },
  initialSnapshot: { date: "2026-01-01T00:00:00.000Z", followers: 0, following: 0, posts: 0, avgLikes: 0, avgComments: 0, engagement: 0 },
  growthHistory: [{ date: "2026-01-01T00:00:00.000Z", followers: 0, following: 0, posts: 0, avgLikes: 0, avgComments: 0, engagement: 0 }],
});
const withPrint = (ig: string, id: string, followers: number, at: string) => ({
  ...placeholder(ig, id),
  profile: { username: ig, followers, following: 300, posts: 40, dataSource: "screenshot", needsScreenshotAnalysis: false },
  screenshotHistory: [{ url: `https://x/${ig}.png`, uploadedAt: at }],
});
const baseline = async (ig: string) =>
  (await pool.query("SELECT * FROM ig_profile_baselines WHERE lower(instagram_username)=$1", [ig])).rows;

try {
  const igs = ["perfila", "perfilb", "perfilc", "perfilcorrida"];
  await pool.query("DELETE FROM ig_profile_baselines WHERE lower(instagram_username) = ANY($1)", [igs]);
  await pool.query("DELETE FROM ig_online_sessions WHERE instagram_username = ANY($1)", [igs]);
  await pool.query("DELETE FROM ig_online_metrics WHERE instagram_username = ANY($1)", [igs]);
  await pool.query("DELETE FROM user_sessions WHERE squarecloud_username=$1", [USER]);
  await pool.query("DELETE FROM squarecloud_user_profiles WHERE squarecloud_username=$1", [USER]);
  // perfila e perfilb pertencem ao usuário; perfilc não.
  await pool.query("INSERT INTO squarecloud_user_profiles (squarecloud_username, instagram_username) VALUES ($1,'perfila'),($1,'@PerfilB')", [USER]);

  // 1) Cadastro sem print → extensão manda 2.500 → vira referência inicial.
  await post("/cloud", { action: "save", ...auth, profileSessions: [placeholder("perfila", "a1"), placeholder("perfilc", "c1")], archivedProfiles: [] });
  await post("/ig", { action: "metrics", instagram: "perfila", followers: 2500, following: 310, posts: 42 });
  let b = await baseline("perfila");
  assert.equal(b.length, 1);
  assert.equal(b[0].initial_followers, 2500); assert.equal(b[0].initial_source, "extensao");
  assert.equal(b[0].initial_following, 310); assert.equal(b[0].initial_posts, 42);

  // 2) Painel recebe os dados automaticamente (sem print).
  let load = await post("/cloud", { action: "load", ...auth });
  let a = load.json.data.profileSessions.find((s: any) => s.id === "a1");
  assert.equal(a.initialSnapshot.followers, 2500, "referência inicial no painel");
  assert.equal(a.profile.followers, 2500, "dados atuais preenchidos pela extensão");
  assert.equal(a.profile.posts, 42);
  const c = load.json.data.profileSessions.find((s: any) => s.id === "c1");
  assert.equal(c.profile.followers, 0, "perfil que não é do usuário não recebe dados");

  // 3) Print posterior com 2.700 NÃO troca a referência inicial.
  await post("/cloud", { action: "save", ...auth, profileSessions: [withPrint("perfila", "a1", 2700, new Date().toISOString())], archivedProfiles: [] });
  b = await baseline("perfila");
  assert.equal(b[0].initial_followers, 2500, "print não sobrescreve a referência");
  const stored = (await pool.query("SELECT profile_sessions FROM user_sessions WHERE squarecloud_username=$1", [USER])).rows[0].profile_sessions;
  assert.equal(stored[0].initialSnapshot.followers, 2500, "salvo no banco com a referência central");
  assert.equal(stored[0].profile.followers, 2700, "print continua valendo como dado atual");

  // 4) Nova leitura da extensão → atual muda, inicial fica. Admin usa a mesma referência.
  await post("/ig", { action: "metrics", instagram: "perfila", followers: 2600 });
  b = await baseline("perfila");
  assert.equal(b[0].initial_followers, 2500); assert.equal(b[0].current_followers, 2600);
  const m = await post("/ig", { action: "admin_metrics", days: 7 }, admin);
  const row = m.json.rows.find((r: any) => r.instagram_username === "perfila");
  assert.equal(row.followers_initial, 2500); assert.equal(row.followers_current, 2600);
  assert.equal(row.followers_diff, 100); assert.equal(row.initial_source, "extensao");

  // 5) Print primeiro → referência vem do print; extensão depois não troca.
  await post("/cloud", { action: "save", ...auth, profileSessions: [withPrint("perfilb", "b1", 1000, "2026-02-01T00:00:00.000Z")], archivedProfiles: [] });
  b = await baseline("perfilb");
  assert.equal(b[0].initial_followers, 1000); assert.equal(b[0].initial_source, "print");
  await post("/ig", { action: "metrics", instagram: "perfilb", followers: 1100 });
  b = await baseline("perfilb");
  assert.equal(b[0].initial_followers, 1000); assert.equal(b[0].current_followers, 1100);
  const m2 = await post("/ig", { action: "admin_metrics", days: 7 }, admin);
  const rowB = m2.json.rows.find((r: any) => r.instagram_username === "perfilb");
  assert.equal(rowB.followers_initial, 1000, "admin usa a referência do print do painel");
  load = await post("/cloud", { action: "load", ...auth });
  const bs = load.json.data.profileSessions.find((s: any) => s.id === "b1");
  assert.equal(bs.initialSnapshot.followers, 1000); assert.equal(bs.profile.followers, 1100);

  // 6) Perfil que não pertence ao usuário: print não cria referência.
  await post("/cloud", { action: "save", ...auth, profileSessions: [withPrint("perfilc", "c1", 50, "2026-02-01T00:00:00.000Z")], archivedProfiles: [] });
  assert.equal((await baseline("perfilc")).length, 0);

  // 7) Leituras simultâneas: uma linha só e a referência não muda depois.
  await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
    recordProfileReading("perfilcorrida", null, { followers: n * 100, following: null, posts: null }, "extensao")));
  b = await baseline("perfilcorrida");
  assert.equal(b.length, 1);
  const first = b[0].initial_followers;
  await recordProfileReading("perfilcorrida", { followers: 9, following: null, posts: null }, null, "print");
  assert.equal((await baseline("perfilcorrida"))[0].initial_followers, first);

  console.log("ig-profile-baseline: todos os testes passaram");
} finally {
  server.close();
  await pool.end();
}
