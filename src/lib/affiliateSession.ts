export interface AffiliateCredentials { squarecloud_username: string; password: string }

export function resolveAffiliateCredentials(username: string | undefined, temporaryPassword: string | null, dashboard: string | null): AffiliateCredentials | null {
  try {
    const saved = dashboard ? JSON.parse(dashboard) : null;
    if (saved?.username && typeof saved.password === "string" && saved.password && (!username || saved.username.toLowerCase() === username.toLowerCase())) {
      return { squarecloud_username: saved.username.toLowerCase(), password: saved.password };
    }
  } catch { /* Ignore invalid legacy session. */ }
  return username && temporaryPassword ? { squarecloud_username: username.toLowerCase(), password: temporaryPassword } : null;
}

export function getAffiliateCredentials(username?: string) {
  return resolveAffiliateCredentials(username, sessionStorage.getItem("mro_temp_pwd"), localStorage.getItem("mro_dashboard_session"));
}