/**
 * Entrypoint do backend próprio na VPS.
 *
 * Expõe a mesma superfície que o app consome hoje:
 *   /rest/v1/*       → PostgreSQL local, sob RLS
 *   /auth/v1/*       → JWT próprio
 *   /storage/v1/*    → arquivos no disco da hospedagem
 *   /functions/v1/*  → funções (runtime Deno local)
 *   /realtime/v1     → WebSocket sobre LISTEN/NOTIFY
 */

// Encaminha rejeições de handlers async ao middleware de erro do Express 4.
// Sem este patch, um timeout de função encerra a conexão e vira 502 sem CORS.
import "express-async-errors";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import http from "node:http";
import { env } from "./env.js";
import { healthCheck } from "./db.js";
import { restRouter } from "./rest/router.js";
import { authRouter } from "./auth/router.js";
import { ensureStorageWritable, storageRouter } from "./storage/router.js";
import { functionsRouter, functionsRuntime, functionsStatus, listAvailableFunctions, shutdownFunctions } from "./functions/host.js";
import { attachRealtime, realtimeStatus } from "./realtime.js";
import { RestError } from "./rest/identifiers.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true);

/**
 * CORS público (wildcard) para leitura de objetos públicos do Storage.
 *
 * As extensões (MRO Ferramenta e ZAP MRO) leem `user-data/admin/*.json` de
 * origens externas — inclusive `chrome-extension://` e requisições com
 * `Origin: null`. O CORS geral usa `credentials: true`, o que impede o
 * navegador de aceitar `Access-Control-Allow-Origin: *`. Portanto, para GET,
 * HEAD e preflight de objetos públicos respondemos wildcard SEM credenciais,
 * antes do middleware padrão. O restante da API segue igual.
 */
const PUBLIC_READ_PREFIXES = ["/storage/v1/object/public/", "/storage/v1/object/info/public/"];
const MRO_TOOL_API_PATH = "/functions/v1/mro-tool-api";

function isPublicStorageRead(req: Request): boolean {
  return (
    PUBLIC_READ_PREFIXES.some((prefix) => req.path.startsWith(prefix)) &&
    (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS")
  );
}

function isMroToolApiRequest(req: Request): boolean {
  return req.path === MRO_TOOL_API_PATH || req.path === `${MRO_TOOL_API_PATH}/`;
}

/**
 * CORS dedicado ao login da extensão.
 *
 * O preflight termina no Express, antes de iniciar o processo Deno. Isso evita
 * que cold start, timeout ou falha da função sejam interpretados pelo navegador
 * como ausência de CORS. A rota não usa cookies, portanto wildcard é seguro.
 */
app.use((req, res, next) => {
  if (!isMroToolApiRequest(req)) return next();

  const origin = req.header("origin") ?? "sem-origin";
  const requestedHeaders = req.header("access-control-request-headers");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    requestedHeaders ??
      "authorization, x-client-info, apikey, content-type, x-requested-with, accept, accept-profile, content-profile, prefer, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin, Access-Control-Request-Headers");

  if (req.method === "OPTIONS") {
    console.info(
      `[MRO-CORS] OPTIONS liberado origin=${origin} headers=${requestedHeaders ?? "padrão"}`,
    );
    res.status(204).end();
    return;
  }

  next();
});

app.use((req, res, next) => {
  if (!isPublicStorageRead(req)) return next();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.header("access-control-request-headers") ??
      "authorization, apikey, content-type, range, x-client-info",
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Content-Type, ETag");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// CORS padrão (com credenciais) para o restante da API. Não roda nas leituras
// públicas acima, senão sobrescreveria o `*` pela origem refletida.
//
// Os cabeçalhos permitidos são refletidos a partir do preflight
// (`Access-Control-Request-Headers`) somados a uma base fixa. Sem isso, cada
// função nova com header próprio (ex.: `x-ig-admin-token` no /IG/admin) era
// bloqueada no preflight mesmo com a função respondendo corretamente.
const BASE_ALLOWED_HEADERS = [
  "authorization",
  "apikey",
  "content-type",
  "prefer",
  "range",
  "x-client-info",
  "x-upsert",
  "x-internal-call",
  "x-admin-token",
  "x-ig-admin-token",
  "x-bot-token",
  "x-requested-with",
  "accept",
  "accept-profile",
  "content-profile",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
];

function allowedHeadersFor(req: Request): string[] {
  const requested = (req.header("access-control-request-headers") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...BASE_ALLOWED_HEADERS, ...requested]));
}

const credentialedCors = cors((req, callback) => {
  callback(null, {
    origin: env.corsOrigins.includes("*") ? true : env.corsOrigins,
    credentials: true,
    exposedHeaders: ["Content-Range", "X-Total-Count"],
    allowedHeaders: allowedHeadersFor(req as Request),
    maxAge: 86400,
  });
});


app.use((req, res, next) => {
  if (isPublicStorageRead(req) || isMroToolApiRequest(req)) return next();
  credentialedCors(req, res, next);
});



// Webhooks precisam do corpo bruto para validar assinatura (Meta/Stripe/InfiniPay).
app.use("/functions/v1", express.raw({ type: "*/*", limit: "50mb" }));
// Storage define parsers por rota: uploads usam corpo binário/multipart, enquanto
// listagem, assinatura e remoção usam JSON. Um parser global consumia o stream
// antes do Multer e causava HTTP 500 em thumbnails enviadas pelo painel.
app.use("/storage/v1", asyncRouter(storageRouter));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/health", async (_req, res) => {
  const db = await healthCheck().catch((error: Error) => ({ ok: false, error: error.message }));
  res.status(db.ok ? 200 : 503).json({
    ok: db.ok,
    database: db,
    functions: {
      available: listAvailableFunctions().length,
      running: functionsStatus(),
      runtime: functionsRuntime(),
    },
    realtime: realtimeStatus(),
    uptimeSeconds: Math.round(process.uptime()),
    version: process.env.APP_VERSION ?? "dev",
  });
});

app.use("/rest/v1", asyncRouter(restRouter));
app.use("/auth/v1", asyncRouter(authRouter));
app.use("/functions/v1", asyncRouter(functionsRouter));

app.use((_req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
});

// Handler de erro no formato que o SDK entende (message/code/details/hint).
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof RestError) {
    res.status(error.status).json({
      message: error.message,
      details: error.details ?? null,
      hint: null,
      code: error.code ?? String(error.status),
    });
    return;
  }

  const bodyError = error as { type?: string; status?: number; message?: string };
  if (bodyError?.type === "entity.too.large" || bodyError?.status === 413) {
    res.status(413).json({
      message: "Arquivo maior que o limite permitido.",
      details: bodyError.message ?? null,
      hint: null,
      code: "PAYLOAD_TOO_LARGE",
    });
    return;
  }

  const pgError = error as { message?: string; code?: string; detail?: string; hint?: string };
  const isPgError = typeof pgError?.code === "string" && /^[0-9A-Z]{5}$/.test(pgError.code);

  if (isPgError) {
    // Erros de permissão de RLS devem virar 403, não 500.
    const status = pgError.code === "42501" ? 403 : 400;
    console.error("[api] erro do Postgres:", pgError.code, pgError.message);
    res.status(status).json({
      message: pgError.message ?? "Erro no banco de dados.",
      details: pgError.detail ?? null,
      hint: pgError.hint ?? null,
      code: pgError.code,
    });
    return;
  }

  console.error("[api] erro não tratado:", error);
  res.status(500).json({
    message: "Erro interno do servidor.",
    details: null,
    hint: null,
    code: "500",
  });
});

/** Encaminha rejeições de handlers async para o middleware de erro. */
function asyncRouter(router: express.Router): express.Router {
  const wrapper = express.Router();
  wrapper.use((req, res, next) => {
    Promise.resolve(router(req, res, next)).catch(next);
  });
  return wrapper;
}

const server = http.createServer(app);
attachRealtime(server);

async function startServer(): Promise<void> {
  await ensureStorageWritable();
  server.listen(env.port, () => {
    console.log(`[api] backend no ar em http://127.0.0.1:${env.port}`);
    console.log(`[api] funções disponíveis: ${listAvailableFunctions().length}`);
    console.log(`[api] storage gravável em ${env.storage.root}`);
  });
}

startServer().catch((error) => {
  console.error(`[api] inicialização bloqueada: storage sem permissão em ${env.storage.root}`, error);
  process.exit(1);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[api] recebido ${signal}, encerrando com graça...`);
    shutdownFunctions();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000);
  });
}
