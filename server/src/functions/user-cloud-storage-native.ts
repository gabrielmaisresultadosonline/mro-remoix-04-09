import type { Request, Response } from "express";
import { hasValidAdminSession } from "../admin-session.js";
import { adminQuery } from "../db.js";
import { RestError } from "../rest/identifiers.js";

interface UserSessionRow {
  id: string;
  squarecloud_username: string;
  email: string | null;
  updated_at: string;
  days_remaining: number | null;
  profile_sessions: unknown;
  archived_profiles: unknown;
  lifetime_creative_used_at: string | null;
}

interface NativeRequestBody {
  action?: unknown;
  username?: unknown;
  email?: unknown;
  auth_token?: unknown;
  daysRemaining?: unknown;
  profileSessions?: unknown;
  archivedProfiles?: unknown;
  lifetimeCreativeUsedAt?: unknown;
  activate?: unknown;
}

function parseBody(req: Request): NativeRequestBody {
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString("utf8")) as NativeRequestBody;
    } catch {
      throw new RestError(400, "Corpo JSON inválido.");
    }
  }
  return (req.body ?? {}) as NativeRequestBody;
}

function sessionsFrom(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
    );
  }
  if (typeof value === "string") {
    try {
      return sessionsFrom(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function textFrom(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function instagramUsernameFrom(session: Record<string, unknown>): string {
  const profile = session.profile;
  if (typeof profile !== "object" || profile === null) return "";
  const username = (profile as Record<string, unknown>).username;
  return typeof username === "string" ? username.trim().toLowerCase().replace(/^@/, "") : "";
}

function hydrateScreenshots(
  sessions: Array<Record<string, unknown>>,
  screenshots: Map<string, string>,
): Array<Record<string, unknown>> {
  return sessions.map((session) => {
    const screenshotUrl = screenshots.get(instagramUsernameFrom(session));
    if (!screenshotUrl) return session;
    const history = Array.isArray(session.screenshotHistory)
      ? session.screenshotHistory.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : [];
    return {
      ...session,
      screenshotUrl,
      screenshotHistory: history.some((item) => item.url === screenshotUrl)
        ? history
        : [...history, { url: screenshotUrl, uploadedAt: new Date().toISOString() }],
    };
  });
}

function isProtectedUserAction(action: string): boolean {
  return action === "load" || action === "save";
}

function validateUserToken(body: NativeRequestBody, username: string): void {
  const token = textFrom(body.auth_token);
  if (!token) throw new RestError(401, "Authentication required");
  if (!token.startsWith(`${username}_`)) {
    throw new RestError(403, "Invalid authentication token");
  }
}

/**
 * Executa localmente todas as ações de sessão. Além de remover o cold start do
 * runner Deno, a leitura une o print administrativo à sessão entregue ao painel.
 */
export async function handleNativeUserCloudStorage(
  req: Request,
  res: Response,
): Promise<boolean> {
  if (req.method !== "POST") return false;

  const body = parseBody(req);
  const action = typeof body.action === "string" ? body.action : "";
  const supportedActions = new Set(["load", "save", "get_email", "get_creatives_pro_users", "set_creatives_pro"]);
  if (!supportedActions.has(action)) {
    return false;
  }

  if ((action === "get_creatives_pro_users" || action === "set_creatives_pro") && !hasValidAdminSession(req)) {
    res.status(401).json({ success: false, error: "Sessão administrativa inválida ou expirada" });
    return true;
  }

  if (action === "get_creatives_pro_users") {
    const rows = await adminQuery<UserSessionRow>(
      `SELECT id, squarecloud_username, updated_at, days_remaining, profile_sessions
         FROM user_sessions
        ORDER BY updated_at DESC`,
    );
    const users = rows
      .filter((row) => sessionsFrom(row.profile_sessions).some((session) => session.creativesUnlocked === true))
      .map((row) => ({
        squarecloud_username: row.squarecloud_username,
        activated_at: row.updated_at,
        days_remaining: row.days_remaining,
      }));
    res.json({ success: true, users });
    return true;
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!username || username.length > 255) {
    throw new RestError(400, "Username inválido.");
  }
  if (isProtectedUserAction(action)) validateUserToken(body, username);

  const existing = await adminQuery<UserSessionRow>(
    `SELECT id, squarecloud_username, email, updated_at, days_remaining,
            profile_sessions, archived_profiles, lifetime_creative_used_at
       FROM public.user_sessions
      WHERE lower(squarecloud_username) = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [username],
  );
  const current = existing[0];

  if (action === "get_email") {
    res.json({ success: true, email: current?.email ?? null, isLocked: Boolean(current?.email) });
    return true;
  }

  if (action === "load") {
    if (!current) {
      res.json({ success: true, exists: false, data: null });
      return true;
    }
    const providedEmail = textFrom(body.email)?.toLowerCase();
    if (current.email && providedEmail && current.email.toLowerCase() !== providedEmail) {
      throw new RestError(403, "Unauthorized: email mismatch");
    }
    const screenshotRows = await adminQuery<{ instagram_username: string; profile_screenshot_url: string }>(
      `SELECT instagram_username, profile_screenshot_url
         FROM public.squarecloud_user_profiles
        WHERE lower(squarecloud_username) = $1
          AND profile_screenshot_url IS NOT NULL
          AND btrim(profile_screenshot_url) <> ''`,
      [username],
    );
    const screenshots = new Map(
      screenshotRows.map((row) => [row.instagram_username.toLowerCase().replace(/^@/, ""), row.profile_screenshot_url]),
    );
    const profileSessions = hydrateScreenshots(sessionsFrom(current.profile_sessions), screenshots);
    const archivedProfiles = hydrateScreenshots(sessionsFrom(current.archived_profiles), screenshots);
    await adminQuery(`UPDATE public.user_sessions SET last_access = now() WHERE id = $1`, [current.id]);
    console.log(`[USER-CLOUD-STORAGE-NATIVE] load user=${username} profiles=${profileSessions.length} screenshots=${screenshots.size}`);
    res.json({
      success: true,
      exists: true,
      data: {
        email: current.email,
        daysRemaining: current.days_remaining,
        profileSessions,
        archivedProfiles,
        lifetimeCreativeUsedAt: current.lifetime_creative_used_at,
      },
    });
    return true;
  }

  if (action === "save") {
    const incomingProfiles = sessionsFrom(body.profileSessions);
    const incomingArchived = sessionsFrom(body.archivedProfiles);
    const existingProfiles = sessionsFrom(current?.profile_sessions);
    const unlockedById = new Map(
      existingProfiles
        .filter((session) => typeof session.id === "string" && typeof session.creativesUnlocked === "boolean")
        .map((session) => [session.id as string, session.creativesUnlocked as boolean]),
    );
    const finalProfiles = incomingProfiles.map((session) => {
      const id = typeof session.id === "string" ? session.id : "";
      return unlockedById.has(id) ? { ...session, creativesUnlocked: unlockedById.get(id) } : session;
    });
    const activeProfiles = finalProfiles.filter((profile) => profile.isHistorical !== true);
    const archivedByUsername = new Map<string, Record<string, unknown>>();
    [...sessionsFrom(current?.archived_profiles), ...incomingArchived, ...finalProfiles.filter((profile) => profile.isHistorical === true)]
      .forEach((profile) => {
        const key = instagramUsernameFrom(profile);
        if (key) archivedByUsername.set(key, profile);
      });
    activeProfiles.forEach((profile) => archivedByUsername.delete(instagramUsernameFrom(profile)));

    const providedEmail = textFrom(body.email);
    if (current?.email && providedEmail && current.email.toLowerCase() !== providedEmail.toLowerCase()) {
      throw new RestError(403, "Unauthorized: email mismatch");
    }
    const daysRemaining = typeof body.daysRemaining === "number" && Number.isFinite(body.daysRemaining)
      ? Math.trunc(body.daysRemaining)
      : current?.days_remaining ?? 365;
    const lifetimeValue = body.lifetimeCreativeUsedAt === undefined
      ? current?.lifetime_creative_used_at ?? null
      : textFrom(body.lifetimeCreativeUsedAt);

    if (current) {
      await adminQuery(
        `UPDATE public.user_sessions
            SET email = COALESCE(email, $1), days_remaining = $2,
                profile_sessions = $3::jsonb, archived_profiles = $4::jsonb,
                lifetime_creative_used_at = $5, updated_at = now()
          WHERE id = $6`,
        [providedEmail, daysRemaining, JSON.stringify(activeProfiles), JSON.stringify([...archivedByUsername.values()]), lifetimeValue, current.id],
      );
    } else {
      await adminQuery(
        `INSERT INTO public.user_sessions
           (squarecloud_username, email, days_remaining, profile_sessions, archived_profiles, lifetime_creative_used_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [username, providedEmail, daysRemaining, JSON.stringify(activeProfiles), JSON.stringify([...archivedByUsername.values()]), lifetimeValue],
      );
    }
    console.log(`[USER-CLOUD-STORAGE-NATIVE] save user=${username} profiles=${activeProfiles.length}`);
    res.json({ success: true, data: { email: current?.email ?? providedEmail, daysRemaining } });
    return true;
  }

  const activate = body.activate !== false;

  if (existing.length === 0) {
    await adminQuery(
      `INSERT INTO user_sessions
         (squarecloud_username, profile_sessions, days_remaining)
       VALUES ($1, $2::jsonb, $3)`,
      [
        username,
        JSON.stringify([{ creativesUnlocked: activate, creativesRemaining: 6, activatedAt: new Date().toISOString() }]),
        9999,
      ],
    );
  } else {
    const current = existing[0];
    const sessions = sessionsFrom(current.profile_sessions);
    const updatedSessions = (sessions.length > 0 ? sessions : [{}]).map((session) => ({
      ...session,
      creativesUnlocked: activate,
      creativesRemaining: activate ? 6 : session.creativesRemaining,
      ...(sessions.length === 0 ? { activatedAt: new Date().toISOString() } : {}),
    }));
    await adminQuery(
      `UPDATE user_sessions
          SET profile_sessions = $1::jsonb,
              lifetime_creative_used_at = CASE WHEN $2 THEN NULL ELSE lifetime_creative_used_at END,
              updated_at = now()
        WHERE id = $3`,
      [JSON.stringify(updatedSessions), activate, current.id],
    );
  }

  res.json({ success: true, activated: activate });
  return true;
}