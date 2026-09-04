/**
 * MRO INSTAGRAM (/IG) — cliente do painel administrativo global.
 * O token de sessão do admin fica apenas em sessionStorage e é enviado
 * exclusivamente no header x-ig-admin-token.
 */
import { supabase } from "@/integrations/supabase/client";
import { IgApiError } from "./api";

const TOKEN_KEY = "ig_admin_token";

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage indisponível */
  }
}

async function invoke<T>(payload: Record<string, unknown>): Promise<T> {
  const token = getAdminToken();
  const { data, error } = await supabase.functions.invoke("ig-admin", {
    body: payload,
    headers: token ? { "x-ig-admin-token": token } : undefined,
  });

  if (error) {
    const fallback = (data as { error?: string } | null)?.error;
    throw new IgApiError(fallback ?? "Não foi possível concluir a operação.");
  }
  const result = data as { success?: boolean; error?: string; code?: string } & T;
  if (result?.success === false) throw new IgApiError(result.error ?? "Operação não permitida.", result.code);
  return result as T;
}

export interface IgAdminStats {
  users: number;
  tenants: number;
  instagram_accounts: number;
  webhook_events: number;
  failed_jobs: number;
  messages: number;
  comments: number;
  automations: number;
  ai_calls: number;
}

export const igAdminApi = {
  login: (email: string, password: string) =>
    invoke<{ token: string; must_change_password: boolean }>({ action: "login", email, password }),

  changePassword: (newPassword: string) => invoke<{ success: true }>({ action: "change-password", new_password: newPassword }),

  appConfig: () =>
    invoke<{
      config: {
        app_id: string | null;
        scopes: string | null;
        redirect_uri: string | null;
        webhook_verify_token: string | null;
        has_app_secret: boolean;
        source: "database" | "secrets" | "none";
        updated_at: string | null;
        updated_by: string | null;
      };
    }>({ action: "app-config" }),

  saveAppConfig: (input: {
    app_id: string;
    app_secret?: string;
    scopes?: string;
    redirect_uri?: string;
    webhook_verify_token?: string;
  }) => invoke<{ success: true }>({ action: "save-app-config", ...input }),

  dashboard: () => invoke<{ stats: IgAdminStats }>({ action: "dashboard" }),

  users: (search?: string) =>
    invoke<{
      users: Array<{
        user_id: string;
        full_name: string | null;
        company: string | null;
        email: string | null;
        is_blocked: boolean;
        last_login_at: string | null;
        created_at: string;
      }>;
      memberships: Array<{ user_id: string; tenant_id: string; role: string }>;
      tenants: Array<{ id: string; name: string; plan_id: string; is_blocked: boolean }>;
    }>({ action: "users", search }),

  userDetail: (userId: string) => invoke<Record<string, unknown>>({ action: "user-detail", user_id: userId }),

  setUserBlocked: (userId: string, blocked: boolean) =>
    invoke<{ success: true }>({ action: "set-user-blocked", user_id: userId, blocked }),

  resetUserPassword: (userId: string, newPassword: string) =>
    invoke<{ success: true }>({ action: "reset-user-password", user_id: userId, new_password: newPassword }),

  instagram: () =>
    invoke<{
      accounts: Array<{
        id: string;
        tenant_id: string;
        instagram_account_id: string;
        username: string | null;
        connection_state: string;
        webhook_subscribed: boolean;
        last_synced_at: string | null;
        last_error: string | null;
      }>;
      tenants: Array<{ id: string; name: string }>;
    }>({ action: "instagram" }),

  logs: () =>
    invoke<{
      logs: Array<{
        id: string;
        action: string;
        actor_type: string;
        actor_user_id: string | null;
        target: string | null;
        result: string;
        ip: string | null;
        created_at: string;
      }>;
    }>({ action: "logs" }),
};
