/**
 * Etapa 2b — Contas de login.
 *
 * Ponto importante: pela API do Supabase os hashes de senha não são
 * exportáveis. Mas com acesso direto ao banco (LEGACY_DATABASE_URL) eles são —
 * `auth.users.encrypted_password` é um hash bcrypt. Copiamos o hash como está,
 * então ninguém precisa redefinir senha depois da migração.
 *
 * O backend local aceita os dois formatos (bcrypt legado e PBKDF2 novo) e faz
 * a atualização do formato no primeiro login bem-sucedido.
 */

import { requireLegacy } from "../src/env.js";
import { pool } from "../src/db.js";
import { runOrThrow } from "./lib/shell.js";
import { log } from "./lib/log.js";

interface LegacyUser {
  id: string;
  email: string;
  encrypted_password: string;
  email_confirmed_at: string | null;
  raw_user_meta_data: string;
  last_sign_in_at: string | null;
  banned_until: string | null;
  created_at: string;
}

export async function migrateUsers(): Promise<void> {
  log.step("Etapa 2b/5 — Contas de login (com as senhas atuais)");

  const legacy = requireLegacy();
  if (!legacy.databaseUrl) {
    log.warn("LEGACY_DATABASE_URL ausente: pulando a migração de contas.");
    return;
  }

  // Lemos como JSON para não depender de parsing de CSV com metadados aninhados.
  const raw = await runOrThrow("psql", [
    "-t", "-A", "-d", legacy.databaseUrl,
    "-c", `
      SELECT COALESCE(json_agg(u), '[]'::json)::text FROM (
        SELECT id::text,
               email,
               COALESCE(encrypted_password, '') AS encrypted_password,
               email_confirmed_at,
               COALESCE(raw_user_meta_data, '{}'::jsonb)::text AS raw_user_meta_data,
               last_sign_in_at,
               banned_until,
               created_at
          FROM auth.users
         WHERE deleted_at IS NULL AND email IS NOT NULL
      ) u
    `,
  ]).catch((error: Error) => {
    log.warn(`Não foi possível ler auth.users: ${error.message.split("\n")[0]}`);
    return "[]";
  });

  let users: LegacyUser[];
  try {
    users = JSON.parse(raw.trim() || "[]") as LegacyUser[];
  } catch {
    log.error("Resposta inesperada ao ler as contas; etapa ignorada.");
    return;
  }

  if (users.length === 0) {
    log.warn("Nenhuma conta encontrada em auth.users (o projeto usa login próprio nas tabelas de negócio).");
    return;
  }

  let imported = 0;
  let socialOnly = 0;

  for (const user of users) {
    // Prefixamos o hash bcrypt para o verificador saber qual algoritmo usar.
    // Contas exclusivamente sociais também precisam existir localmente porque
    // tabelas de negócio podem referenciar seus UUIDs por foreign key. O valor
    // sentinela nunca autentica por senha.
    const storedHash = user.encrypted_password
      ? user.encrypted_password.startsWith("$2")
        ? `bcrypt:${user.encrypted_password}`
        : user.encrypted_password
      : "disabled:social-login";
    if (!user.encrypted_password) socialOnly += 1;

    const result = await pool.query(
      `INSERT INTO public.auth_users
         (id, email, password_hash, email_confirmed_at, user_metadata,
          last_sign_in_at, banned_until, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             -- A VPS passa a ser a origem da senha após a primeira migração.
             -- Não restaure o hash antigo em cada deploy/cutover, pois isso
             -- desfaria redefinições feitas pelo administrador no /IG/admin.
             user_metadata = EXCLUDED.user_metadata,
             updated_at = now()`,
      [
        user.id,
        user.email,
        storedHash,
        user.email_confirmed_at,
        user.raw_user_meta_data,
        user.last_sign_in_at,
        user.banned_until,
        user.created_at,
      ],
    );
    imported += result.rowCount ?? 0;
  }

  log.ok(`${imported} contas importadas; ${socialOnly} contas sociais preservadas sem habilitar login por senha.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateUsers()
    .then(() => pool.end())
    .catch((error: Error) => {
      log.error(error.message);
      process.exit(1);
    });
}
