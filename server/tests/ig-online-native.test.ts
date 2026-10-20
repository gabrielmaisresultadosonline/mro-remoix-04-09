/**
 * Teste de integração do IG Online nativo contra um PostgreSQL real.
 * Uso: IG_TEST_DATABASE_URL=postgres://... npx tsx tests/ig-online-native.test.ts
 * (o banco precisa das migrações 019–021 e das tabelas mro_tool_* / teste002_users).
 */
import assert from "node:assert/strict";
process.env.DATABASE_URL = process.env.IG_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";
const express = (await import("express")).default;
const { handleNativeIgOnline } = await import("../src/functions/ig-online-native.js");
const { createAdminSession } = await import("../src/admin-session.js");
const { pool } = await import("../src/db.js");

const app = express();
app.use(express.json());
app.post("/fn", async (req, res) => { await handleNativeIgOnline(req, res); });
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const admin = createAdminSession("mro@gmail.com").token;
const call = async (body: object, token?: string) => {
  const r = await fetch(`http://127.0.0.1:${port}/fn`, {
    method: "POST", headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, json: (await r.json()) as Record<string, any> };
};

const RID = `t-${Date.now()}`;
try {
  await pool.query("DELETE FROM ig_online_sessions WHERE instagram_username IN ('perfilcliente','perfilfora')");
  await pool.query("DELETE FROM ig_online_metrics WHERE instagram_username IN ('perfilcliente','perfilfora')");

  // Classificação: cliente cadastrado vs. fora do banco
  const p1 = await call({ action: "ping", instagram: "@PerfilCliente" });
  assert.equal(p1.json.status, "client"); assert.equal(p1.json.mro_username, "cliente01");
  const p2 = await call({ action: "ping", instagram: "https://instagram.com/perfilfora/" });
  assert.equal(p2.json.status, "unknown"); assert.equal(p2.json.registered, false);

  // Métricas: seguidores iniciais/atuais e boas-vindas somadas como incremento
  await call({ action: "metrics", instagram: "perfilcliente", followers: 100, welcome_sent: 3, session: "start", request_id: RID });
  const dup = await call({ action: "metrics", instagram: "perfilcliente", welcome_sent: 3, request_id: RID });
  assert.equal(dup.json.duplicate, true, "request_id repetido não soma de novo");
  await call({ action: "metrics", instagram: "perfilcliente", followers: 112, welcome_sent: 2 });
  const bad = await call({ action: "metrics", instagram: "perfilcliente", followers: -5 });
  assert.equal(bad.status, 400);
  const m = await call({ action: "admin_metrics", days: 7 }, admin);
  const row = m.json.rows.find((r: any) => r.instagram_username === "perfilcliente");
  assert.equal(row.followers_initial, 100); assert.equal(row.followers_current, 112);
  assert.equal(row.followers_diff, 12); assert.equal(row.welcome_total, 5);
  const fora = m.json.rows.find((r: any) => r.instagram_username === "perfilfora");
  assert.equal(fora.followers_current, null, "sem envio = Aguardando dados (null)");

  // Painel exige sessão admin
  assert.equal((await call({ action: "admin_metrics" })).status, 401);
  assert.equal((await call({ action: "admin_set_block", instagram: "perfilcliente", blocked: true })).status, 401);

  // Bloqueio afeta só o perfil escolhido e persiste
  await call({ action: "admin_set_block", instagram: "perfilcliente", blocked: true, block_message: "Bloqueado teste" }, admin);
  const c1 = await call({ action: "check_access", instagram: "perfilcliente" });
  assert.equal(c1.json.allowed, false); assert.equal(c1.json.block_message, "Bloqueado teste");
  assert.equal((await call({ action: "check_access", instagram: "perfilfora" })).json.allowed, true);
  assert.equal((await call({ action: "ping", instagram: "perfilcliente" })).json.blocked, true);

  // Desbloqueio libera, mantém métricas e grava histórico
  await call({ action: "admin_set_block", instagram: "perfilcliente", blocked: false }, admin);
  assert.equal((await call({ action: "check_access", instagram: "perfilcliente" })).json.allowed, true);
  const d = await call({ action: "admin_profile_detail", instagram: "perfilcliente" }, admin);
  assert.equal(d.json.session.followers_current, 112);
  assert.deepEqual(d.json.block_history.map((h: any) => h.action), ["unblocked", "blocked"]);

  // Avisos: entregues no ping e eventos registrados
  const sent = await call({ action: "admin_send_message", target_scope: "one", target_instagram: "perfilfora", title: "Oi", body: "Teste" }, admin);
  const p3 = await call({ action: "ping", instagram: "perfilfora" });
  assert.equal(p3.json.messages.length, 1);
  await call({ action: "message_event", instagram: "perfilfora", message_id: sent.json.id, event: "closed" });
  assert.equal((await call({ action: "ping", instagram: "perfilfora" })).json.messages.length, 0);
  const msgs = await call({ action: "admin_messages" }, admin);
  assert.equal(msgs.json.messages.find((x: any) => x.id === sent.json.id).closed, 1);
  await call({ action: "admin_delete_message", id: sent.json.id }, admin);

  console.log("ig-online-native: todos os testes passaram");
} finally {
  await pool.query("DELETE FROM ig_online_sessions WHERE instagram_username IN ('perfilcliente','perfilfora')");
  await pool.query("DELETE FROM ig_online_metrics WHERE instagram_username IN ('perfilcliente','perfilfora')");
  await pool.query("DELETE FROM ig_online_block_history WHERE instagram_username = 'perfilcliente'");
  server.close(); await pool.end();
}
