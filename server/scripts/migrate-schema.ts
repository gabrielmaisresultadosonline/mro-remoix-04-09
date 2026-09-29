/**
 * Etapa 1 — Estrutura.
 *
 * Copia o schema `public` inteiro (219 tabelas, funções, triggers, enums,
 * policies, índices) do banco atual para o PostgreSQL da VPS via pg_dump.
 *
 * Por que pg_dump e não SQL escrito à mão: o schema atual tem funções
 * SECURITY DEFINER, enums e policies acumuladas em meses de migrações.
 * Reescrever isso manualmente perderia detalhes silenciosamente.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env, requireLegacy } from "../src/env.js";
import { runOrThrow, run } from "./lib/shell.js";
import { log } from "./lib/log.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../migrations");
const dumpPath = path.join(migrationsDir, "001_schema_legacy.sql");
const versionedMigrationPattern = /^\d{3}_.+\.sql$/;


/**
 * O banco de origem roda PostgreSQL 17; um pg_dump 14 (padrão do Ubuntu 22.04)
 * aborta com "server version mismatch". Preferimos, então, o binário mais novo
 * instalado em /usr/lib/postgresql/<versão>/bin, ou o indicado em PG_DUMP_BIN.
 */
function resolvePgDump(): string {
  const override = process.env.PG_DUMP_BIN;
  if (override && fs.existsSync(override)) return override;

  const root = "/usr/lib/postgresql";
  if (fs.existsSync(root)) {
    const candidates = fs
      .readdirSync(root)
      .map((version) => ({ version: Number.parseInt(version, 10), bin: path.join(root, version, "bin/pg_dump") }))
      .filter((candidate) => Number.isFinite(candidate.version) && fs.existsSync(candidate.bin))
      .sort((a, b) => b.version - a.version);

    if (candidates.length > 0) {
      if (candidates[0].version < 17) {
        log.warn(
          `pg_dump ${candidates[0].version} é mais antigo que o banco de origem (17). ` +
            "Instale o cliente novo: sudo apt install -y postgresql-client-17",
        );
      }
      return candidates[0].bin;
    }
  }

  return "pg_dump";
}


/** Objetos gerenciados pelo bootstrap — não devem vir do dump. */
const SKIP_PATTERNS = [
  /^CREATE SCHEMA public;/im,
  /CREATE EXTENSION/i,
];

function sanitizeDump(sql: string): string {
  const lines = sql.split("\n");
  const output: string[] = [];
  let skippingBlock = false;

  for (const line of lines) {
    // pg_dump emite comandos de configuração de sessão que não se aplicam aqui.
    // `transaction_timeout` só existe no PostgreSQL 17 (origem); o cliente 14 aborta.
    if (/^SET (default_table_access_method|idle_in_transaction|lock_timeout|row_security|transaction_timeout)/i.test(line)) continue;
    if (/^SELECT pg_catalog\.set_config\('search_path'/i.test(line)) continue;
    if (/^(GRANT|REVOKE) .* ON SCHEMA public/i.test(line)) continue;
    if (/^COMMENT ON (SCHEMA|EXTENSION)/i.test(line)) continue;
    if (/^CREATE SCHEMA public/i.test(line)) continue;
    if (/^ALTER SCHEMA public OWNER/i.test(line)) continue;

    // Extensões vêm do bootstrap, com IF NOT EXISTS.
    if (/^CREATE EXTENSION/i.test(line)) {
      skippingBlock = true;
      continue;
    }
    if (skippingBlock) {
      if (line.trim().endsWith(";")) skippingBlock = false;
      continue;
    }

    output.push(line);
  }

  let result = output.join("\n");

  // O dump referencia auth.users como FK; localmente auth.users é uma view
  // sobre public.auth_users, então a FK é redirecionada.
  result = result.replace(/REFERENCES auth\.users\(id\)/gi, "REFERENCES public.auth_users(id)");
  result = result.replace(/REFERENCES auth\.users\b/gi, "REFERENCES public.auth_users");

  // Tabelas/funções vêm com dono do serviço antigo, que não existe na VPS.
  result = result.replace(/^ALTER (TABLE|FUNCTION|VIEW|SEQUENCE|TYPE) .* OWNER TO .*;$/gim, "");

  // O dump usa CREATE TABLE puro; tornamos reexecutável.
  result = result.replace(/^CREATE TABLE /gim, "CREATE TABLE IF NOT EXISTS ");
  result = result.replace(/^CREATE SEQUENCE /gim, "CREATE SEQUENCE IF NOT EXISTS ");
  result = result.replace(/^CREATE INDEX /gim, "CREATE INDEX IF NOT EXISTS ");
  result = result.replace(/^CREATE UNIQUE INDEX /gim, "CREATE UNIQUE INDEX IF NOT EXISTS ");
  result = result.replace(/^CREATE (OR REPLACE )?VIEW /gim, "CREATE OR REPLACE VIEW ");
  result = result.replace(/^CREATE FUNCTION /gim, "CREATE OR REPLACE FUNCTION ");

  // O Supabase instala pgcrypto/uuid-ossp no schema `extensions`; aqui elas
  // ficam em `public`, então as chamadas qualificadas são reapontadas.
  result = result.replace(/\bextensions\./gi, "public.");

  // `security_invoker` em views só existe no PostgreSQL 15+; no 14 é erro.
  result = result.replace(/\s+WITH \(security_invoker[^)]*\)/gi, "");

  return result;
}

async function applySql(sqlPath: string, label: string, tolerant: boolean): Promise<void> {
  const args = ["-v", "ON_ERROR_STOP=1", "-d", env.database.url, "-f", sqlPath];
  if (tolerant) args[1] = "ON_ERROR_STOP=0";

  const result = await run("psql", args);
  const problems = result.stderr
    .split("\n")
    .filter((line) => /^psql:.*ERROR/i.test(line))
    // Reexecuções normalmente reclamam de objetos que já existem — isso é esperado.
    .filter((line) => !/already exists|does not exist, skipping|duplicate object/i.test(line));

  if (result.code !== 0 && !tolerant) {
    throw new Error(`Falha ao aplicar ${label}:\n${result.stderr}`);
  }
  if (problems.length > 0) {
    log.warn(`${label}: ${problems.length} avisos ignorados (objetos já existentes ou dependências).`);
    for (const problem of problems.slice(0, 10)) log.warn(problem.trim());
  }
  log.ok(`${label} aplicado.`);
}

/**
 * Aplica migrations aditivas mantidas no repositório. Elas corrigem instalações
 * já existentes, onde o dump inicial não recebe colunas criadas posteriormente.
 */
export async function applyVersionedMigrations(): Promise<void> {
  const migrations = fs
    .readdirSync(migrationsDir)
    .filter((file) => versionedMigrationPattern.test(file) && file !== "000_bootstrap.sql" && file !== "001_schema_legacy.sql")
    .sort();

  for (const migration of migrations) {
    await applySql(path.join(migrationsDir, migration), migration, true);
  }
}

/** Lista as tabelas base do schema `public` de uma conexão. */
async function listTables(connection: string): Promise<Set<string>> {
  const output = await runOrThrow("psql", [
    "-t", "-A", "-d", connection,
    "-c", `SELECT c.relname FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'`,
  ]);
  return new Set(output.split("\n").map((line) => line.trim()).filter(Boolean));
}

/**
 * Recria, uma a uma, as tabelas que existem na origem mas não localmente.
 * Um único ERROR no meio do dump grande (por exemplo dependência ainda
 * inexistente) descarta o restante daquele comando; isolando por tabela o
 * problema deixa de ser silencioso.
 */
async function createMissingTables(legacyUrl: string): Promise<void> {
  const [legacyTables, localTables] = await Promise.all([
    listTables(legacyUrl),
    listTables(env.database.url),
  ]);

  const missing = [...legacyTables].filter((table) => !localTables.has(table)).sort();
  if (missing.length === 0) {
    log.ok("Nenhuma tabela ausente: estrutura completa.");
    return;
  }

  log.warn(`${missing.length} tabelas não foram criadas pelo dump: ${missing.join(", ")}`);
  const tempPath = path.join(migrationsDir, "_missing_tables.sql");
  const stillMissing: string[] = [];

  for (const table of missing) {
    try {
      const raw = await runOrThrow(resolvePgDump(), [
        "--schema-only", "--no-owner", "--no-privileges", "--no-tablespaces", "--no-comments",
        "-t", `public.${table}`, legacyUrl,
      ]);
      fs.writeFileSync(tempPath, sanitizeDump(raw), "utf8");
      await run("psql", ["-v", "ON_ERROR_STOP=0", "-d", env.database.url, "-f", tempPath]);
    } catch (error) {
      log.warn(`${table}: ${(error as Error).message}`);
    }
  }

  fs.rmSync(tempPath, { force: true });

  const afterwards = await listTables(env.database.url);
  for (const table of missing) if (!afterwards.has(table)) stillMissing.push(table);

  if (stillMissing.length > 0) {
    throw new Error(
      `Não foi possível criar as tabelas: ${stillMissing.join(", ")}. ` +
        "Sem elas os dados dessas tabelas não podem ser migrados.",
    );
  }
  log.ok(`${missing.length} tabelas recriadas individualmente.`);
}

export async function migrateSchema(options: { dumpOnly?: boolean } = {}): Promise<void> {
  fs.mkdirSync(migrationsDir, { recursive: true });

  log.step("Etapa 1/5 — Estrutura do banco");

  // 1) Bootstrap: extensões, roles, auth.uid(), storage, realtime.
  await applySql(path.join(migrationsDir, "000_bootstrap.sql"), "bootstrap", false);

  // 2) Dump do schema atual.
  const legacy = requireLegacy();
  if (!legacy.databaseUrl) {
    log.warn("LEGACY_DATABASE_URL ausente: pulando a cópia do schema antigo.");
    await applyVersionedMigrations();
    return;
  }

  log.info("Extraindo schema do banco atual (pg_dump --schema-only)...");
  const raw = await runOrThrow(resolvePgDump(), [
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--no-tablespaces",
    "--no-comments",
    "--schema=public",
    legacy.databaseUrl,
  ]);

  const cleaned = sanitizeDump(raw);
  fs.writeFileSync(dumpPath, cleaned, "utf8");
  log.ok(`Schema salvo em ${path.relative(process.cwd(), dumpPath)} (${(cleaned.length / 1024).toFixed(0)} KB).`);

  if (options.dumpOnly) return;

  // 3) Aplica de forma tolerante: objetos já criados pelo bootstrap repetem.
  log.info("Aplicando schema no PostgreSQL local...");
  await applySql(dumpPath, "schema", true);

  // 3b) Rede de segurança: um erro em cascata no dump grande pode deixar
  // tabelas de fora. Recriamos individualmente as que faltarem.
  await createMissingTables(legacy.databaseUrl);

  // 3c) Evoluções locais posteriores ao snapshot do schema legado.
  await applyVersionedMigrations();

  // 4) Restaura os GRANTs, que o dump não trouxe (--no-privileges).
  log.info("Reaplicando GRANTs para anon/authenticated/service_role...");
  await runOrThrow("psql", [
    "-v", "ON_ERROR_STOP=1",
    "-d", env.database.url,
    "-c", `
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT c.relname FROM pg_class c
                   JOIN pg_namespace n ON n.oid = c.relnamespace
                  WHERE n.nspname = 'public' AND c.relkind IN ('r','v','m')
        LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.relname);
          EXECUTE format('GRANT ALL ON public.%I TO service_role', r.relname);
        END LOOP;
        -- anon lê apenas onde já existe policy permitindo leitura anônima.
        FOR r IN SELECT DISTINCT tablename FROM pg_policies
                  WHERE schemaname = 'public' AND 'anon' = ANY(roles)
        LOOP
          EXECUTE format('GRANT SELECT ON public.%I TO anon', r.tablename);
        END LOOP;
        EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role';
      END $$;
    `,
  ]);
  log.ok("GRANTs aplicados.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateSchema({ dumpOnly: process.argv.includes("--dump-only") }).catch((error: Error) => {
    log.error(error.message);
    process.exit(1);
  });
}
