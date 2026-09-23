/**
 * Auth próprio, compatível com o endpoint `/auth/v1` do SDK.
 *
 * Observação importante sobre este projeto: a autenticação real dos produtos
 * já é custom (tabelas `*_users` com SHA-256, validada nas funções). Este
 * módulo cobre o que o SDK espera — sessão, refresh e leitura de usuário —
 * apoiado na tabela `auth_users` local, para que as telas que usam
 * `supabase.auth` continuem funcionando sem alteração.
 */

import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { adminQuery } from "../db.js";
import { env } from "../env.js";
import { resolveAuth, signToken } from "../auth-context.js";
import { RestError } from "../rest/identifiers.js";

export const authRouter = Router();

interface AuthUserRow {
  id: string;
  email: string;
  password_hash: string;
  email_confirmed_at: string | null;
  user_metadata: Record<string, unknown> | null;
  banned_until: string | null;
  updated_at?: string | null;
}

/**
 * PBKDF2-SHA512 com salt por usuário. Não usamos bcrypt para manter a mesma
 * decisão já adotada no projeto (Web Crypto puro, sem dependência nativa),
 * mas com derivação de chave adequada — SHA-256 simples é fraco para senha.
 */
const PBKDF2_ITERATIONS = 120_000;
const RECOVERY_TTL_SECONDS = 30 * 60;

function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt ?? crypto.randomBytes(16).toString("hex");
  const derived = crypto
    .pbkdf2Sync(password, usedSalt, PBKDF2_ITERATIONS, 64, "sha512")
    .toString("hex");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${usedSalt}$${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith("pbkdf2$")) {
    const [, iterations, salt, expected] = stored.split("$");
    const iterationCount = Number(iterations);
    if (!salt || !expected || !Number.isInteger(iterationCount) || iterationCount <= 0) return false;
    const derived = crypto
      .pbkdf2Sync(password, salt, iterationCount, 64, "sha512")
      .toString("hex");
    return timingSafeEqualHex(derived, expected);
  }
  // Compatibilidade com hashes SHA-256 legados já existentes no projeto.
  const legacy = crypto.createHash("sha256").update(password).digest("hex");
  return timingSafeEqualHex(legacy, stored);
}

/**
 * Os usuários importados do provedor anterior chegam como `bcrypt:$2...`.
 * O PostgreSQL já possui pgcrypto; validamos o hash dentro do banco e, após
 * sucesso, o substituímos por PBKDF2 para não manter bcrypt no runtime Node.
 */
async function verifyStoredPassword(password: string, stored: string): Promise<boolean> {
  const isPrefixedBcrypt = stored.startsWith("bcrypt:");
  const isRawBcrypt = /^\$2[aby]\$\d{2}\$/.test(stored);
  if (!isPrefixedBcrypt && !isRawBcrypt) return verifyPassword(password, stored);

  const bcryptHash = isPrefixedBcrypt ? stored.slice("bcrypt:".length) : stored;
  if (!/^\$2[aby]\$\d{2}\$/.test(bcryptHash)) return false;

  const rows = await adminQuery<{ valid: boolean }>(
    "SELECT crypt($1, $2) = $2 AS valid",
    [password, bcryptHash],
  );
  return rows[0]?.valid === true;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length !== bufferB.length || bufferA.length === 0) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function buildSession(user: AuthUserRow) {
  const { token: accessToken, expiresAt } = signToken({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    extra: { user_metadata: user.user_metadata ?? {} },
  });

  const { token: refreshToken } = signToken({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    ttlSeconds: env.auth.refreshTokenTtlSeconds,
    extra: { typ: "refresh" },
  });

  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: env.auth.accessTokenTtlSeconds,
    expires_at: expiresAt,
    refresh_token: refreshToken,
    user: publicUser(user),
  };
}

function publicUser(user: AuthUserRow) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    user_metadata: user.user_metadata ?? {},
    app_metadata: { provider: "email" },
  };
}

function hasServiceRoleCredential(req: Parameters<typeof resolveAuth>[0]): boolean {
  const supplied = req.header("authorization")?.replace(/^Bearer\s+/i, "").trim()
    || req.header("apikey")?.trim()
    || "";
  const expected = env.auth.serviceRoleKey;
  if (!supplied || !expected) return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function requireServiceRole(req: Parameters<typeof resolveAuth>[0]): void {
  if (!hasServiceRoleCredential(req)) throw new RestError(401, "Acesso administrativo inválido.");
}

/** Compatibilidade com auth.admin.createUser usada pelas funções legadas. */
authRouter.post("/admin/users", async (req, res) => {
  requireServiceRole(req);
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
    throw new RestError(400, "Dados do usuário inválidos.");
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    res.status(422).json({ message: "A user with this email address has already been registered" });
    return;
  }

  const rows = await adminQuery<AuthUserRow>(
    `INSERT INTO auth_users (email, password_hash, email_confirmed_at, user_metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, password_hash, email_confirmed_at, user_metadata, banned_until`,
    [
      email,
      hashPassword(password),
      req.body?.email_confirm === false ? null : new Date(),
      JSON.stringify(req.body?.user_metadata ?? {}),
    ],
  );
  res.json({ user: publicUser(rows[0]) });
});

/** Compatibilidade com auth.admin.generateLink para o acesso direto ao Lotar Grupos. */
authRouter.post("/admin/generate_link", async (req, res) => {
  requireServiceRole(req);
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const type = String(req.body?.type ?? "magiclink");
  if (type !== "magiclink" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new RestError(400, "Tipo de link ou e-mail inválido.");
  }

  const user = await findUserByEmail(email);
  if (!user) throw new RestError(404, "Usuário não encontrado.");
  const { token } = signToken({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    ttlSeconds: 5 * 60,
    extra: { typ: "magiclink", user_metadata: user.user_metadata ?? {} },
  });

  res.json({
    properties: {
      action_link: `${env.publicUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=magiclink`,
      hashed_token: token,
      redirect_to: "",
      email_otp: "",
    },
    user: publicUser(user),
  });
});

/** Compatibilidade com auth.verifyOtp({ token_hash, type: "email" }). */
authRouter.post("/verify", async (req, res) => {
  const token = String(req.body?.token_hash ?? req.body?.token ?? "");
  const type = String(req.body?.type ?? "");
  if (!token || !["email", "magiclink"].includes(type)) {
    throw new RestError(400, "Token de acesso inválido.");
  }

  let claims: Record<string, unknown>;
  try {
    claims = jwt.verify(token, env.auth.jwtSecret, { algorithms: ["HS256"] }) as Record<string, unknown>;
  } catch {
    throw new RestError(401, "Token de acesso inválido ou expirado.");
  }
  if (claims.typ !== "magiclink" || typeof claims.sub !== "string") {
    throw new RestError(401, "Token de acesso inválido.");
  }

  const user = await findUserById(claims.sub);
  if (!user || user.banned_until && new Date(user.banned_until) > new Date()) {
    throw new RestError(403, "Usuário bloqueado ou inexistente.");
  }
  res.json(buildSession(user));
});

/** POST /auth/v1/token?grant_type=password | refresh_token */
authRouter.post("/token", async (req, res) => {
  const grantType = String(req.query.grant_type ?? "password");

  if (grantType === "refresh_token") {
    const auth = resolveAuth({
      header: () => `Bearer ${req.body?.refresh_token ?? ""}`,
    } as never);

    if (!auth.userId) {
      throw new RestError(401, "Refresh token inválido.");
    }

    const user = await findUserById(auth.userId);
    if (!user) throw new RestError(401, "Usuário não encontrado.");
    res.json(buildSession(user));
    return;
  }

  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    throw new RestError(400, "E-mail e senha são obrigatórios.");
  }

  const user = await findUserByEmail(email);
  const passwordValid = user ? await verifyStoredPassword(password, user.password_hash) : false;
  if (!user || !passwordValid) {
    // Mensagem genérica: não revelamos se o e-mail existe.
    console.warn(`[auth] login rejeitado email=${maskEmail(email)} motivo=credenciais_invalidas`);
    res.status(400).json({ error: "invalid_grant", error_description: "Invalid login credentials" });
    return;
  }

  if (user.banned_until && new Date(user.banned_until) > new Date()) {
    throw new RestError(403, "Usuário bloqueado.");
  }

  if (user.password_hash.startsWith("bcrypt:") || /^\$2[aby]\$\d{2}\$/.test(user.password_hash)) {
    await adminQuery(
      "UPDATE auth_users SET password_hash = $2, last_sign_in_at = now(), updated_at = now() WHERE id = $1",
      [user.id, hashPassword(password)],
    );
    console.info(`[auth] hash legado atualizado user=${user.id}`);
  } else {
    await adminQuery("UPDATE auth_users SET last_sign_in_at = now() WHERE id = $1", [user.id]);
  }

  console.info(`[auth] login concluído user=${user.id}`);
  res.json(buildSession(user));
});

/** POST /auth/v1/signup */
authRouter.post("/signup", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const password = String(req.body?.password ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new RestError(400, "E-mail inválido.");
  }
  if (password.length < 8) {
    throw new RestError(400, "A senha precisa ter no mínimo 8 caracteres.");
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new RestError(400, "Usuário já cadastrado.");
  }

  const rows = await adminQuery<AuthUserRow>(
    `INSERT INTO auth_users (email, password_hash, email_confirmed_at, user_metadata)
     VALUES ($1, $2, now(), $3)
     RETURNING id, email, password_hash, email_confirmed_at, user_metadata, banned_until`,
    [email, hashPassword(password), JSON.stringify(req.body?.data ?? {})],
  );

  res.json(buildSession(rows[0]));
});

/** POST /auth/v1/recover — envia um link de recuperação válido por 30 minutos. */
authRouter.post("/recover", async (req, res) => {
  const email = String(req.body?.email ?? "").toLowerCase().trim();
  const rawRedirect = String(req.query.redirect_to ?? req.body?.redirect_to ?? "");
  const redirectTo = safeRecoveryRedirect(rawRedirect);
  const user = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? await findUserByEmail(email) : null;

  // Resposta uniforme para não revelar quais e-mails estão cadastrados.
  if (!user) {
    console.info(`[auth] recuperação solicitada email=${maskEmail(email)} conta=nao_localizada`);
    res.json({});
    return;
  }

  const smtpPassword = process.env.SMTP_PASSWORD?.trim();
  if (!smtpPassword) {
    console.error("[auth] recuperação indisponível motivo=smtp_nao_configurado");
    throw new RestError(503, "Serviço de recuperação temporariamente indisponível.");
  }

  const { token } = signToken({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    ttlSeconds: RECOVERY_TTL_SECONDS,
    extra: { typ: "recovery", user_metadata: user.user_metadata ?? {} },
  });
  const link = `${redirectTo}#access_token=${encodeURIComponent(token)}&token_type=bearer&type=recovery&expires_in=${RECOVERY_TTL_SECONDS}`;
  const smtpUser = process.env.SMTP_USER?.trim() || "suporte@maisresultadosonline.com.br";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.hostinger.com",
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword },
  });

  try {
    await transport.sendMail({
      from: `MRO - Mais Resultados Online <${smtpUser}>`,
      to: user.email,
      subject: "Redefinição de senha do Instagram MRO",
      text: `Use este link para redefinir sua senha. Ele expira em 30 minutos: ${link}`,
      html: `<p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${escapeHtml(link)}">Definir nova senha</a></p><p>O link expira em 30 minutos. Se você não fez esta solicitação, ignore este e-mail.</p>`,
    });
    console.info(`[auth] recuperação enviada user=${user.id}`);
  } catch (error) {
    console.error(`[auth] recuperação falhou user=${user.id} motivo=${error instanceof Error ? error.message : "erro_desconhecido"}`);
    throw new RestError(503, "Não foi possível enviar o e-mail de recuperação.");
  }

  res.json({});
});

/** GET /auth/v1/user */
authRouter.get("/user", async (req, res) => {
  const auth = resolveAuth(req);
  if (!auth.userId) throw new RestError(401, "Sessão inválida.");

  const user = await findUserById(auth.userId);
  if (!user) throw new RestError(404, "Usuário não encontrado.");
  res.json(publicUser(user));
});

/** PUT /auth/v1/user — troca de senha/metadados. */
authRouter.put("/user", async (req, res) => {
  const auth = resolveAuth(req);
  if (!auth.userId) throw new RestError(401, "Sessão inválida.");

  if (typeof req.body?.password === "string" && auth.claims?.typ === "recovery") {
    const currentUser = await findUserById(auth.userId);
    if (!currentUser) throw new RestError(401, "Link de recuperação inválido.");
    const issuedAt = Number(auth.claims?.iat ?? 0);
    if (currentUser.updated_at && issuedAt * 1000 <= new Date(currentUser.updated_at).getTime()) {
      throw new RestError(401, "Este link de recuperação já foi utilizado.");
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [auth.userId];

  if (typeof req.body?.password === "string") {
    if (req.body.password.length < 8) {
      throw new RestError(400, "A senha precisa ter no mínimo 8 caracteres.");
    }
    params.push(hashPassword(req.body.password));
    updates.push(`password_hash = $${params.length}`);
  }
  if (req.body?.data && typeof req.body.data === "object") {
    params.push(JSON.stringify(req.body.data));
    updates.push(`user_metadata = $${params.length}`);
  }

  if (updates.length === 0) throw new RestError(400, "Nada para atualizar.");

  const rows = await adminQuery<AuthUserRow>(
    `UPDATE auth_users SET ${updates.join(", ")}, updated_at = now()
      WHERE id = $1
      RETURNING id, email, password_hash, email_confirmed_at, user_metadata, banned_until`,
    params,
  );

  res.json(publicUser(rows[0]));
});

authRouter.post("/logout", (_req, res) => {
  // Tokens são stateless; o cliente descarta a sessão localmente.
  res.status(204).end();
});

async function findUserByEmail(email: string): Promise<AuthUserRow | null> {
  const rows = await adminQuery<AuthUserRow>(
    `SELECT id, email, password_hash, email_confirmed_at, user_metadata, banned_until, updated_at
       FROM auth_users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

async function findUserById(id: string): Promise<AuthUserRow | null> {
  const rows = await adminQuery<AuthUserRow>(
    `SELECT id, email, password_hash, email_confirmed_at, user_metadata, banned_until, updated_at
       FROM auth_users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

function safeRecoveryRedirect(value: string): string {
  try {
    const url = new URL(value || "https://maisresultadosonline.com.br/IG/reset-password");
    if (url.protocol !== "https:" || url.hostname !== "maisresultadosonline.com.br") throw new Error();
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "https://maisresultadosonline.com.br/IG/reset-password";
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

export { hashPassword, verifyPassword };
