/** Cliente do módulo Ao Vivo MRO (rotas nativas da VPS em /functions/v1/aovivo-api). */
const BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  ""
).replace(/\/+$/, "") + "/functions/v1/aovivo-api";

const TOKEN_KEY = "aovivo_token";

export interface AoVivoVideo { id: string; file_name: string; size_bytes: number; order_index: number }
export interface AoVivoStream {
  id: string; owner_type: "admin" | "user"; user_id: string | null; owner_label: string; title: string;
  rtmp_url: string; stream_key: string; status: "stopped" | "running" | "error"; started_at: string | null;
  online: boolean; total_seconds: number; last_error: string | null; created_at: string; videos: AoVivoVideo[];
}
export interface AoVivoMe {
  kind: "admin" | "user"; label: string; max_streams: number; max_playlist_bytes: number; streams: AoVivoStream[];
}
export interface AoVivoUser { id: string; username: string; email: string | null; max_streams: number; streams: number }

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("x-aovivo-token", token);
  if (init.body && typeof init.body === "string") headers.set("content-type", "application/json");
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers });
  } catch {
    throw new Error("Servidor do Ao Vivo indisponível. Atualize a VPS e tente novamente.");
  }
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string } & T;
  if (res.status === 401) clearToken();
  if (!res.ok || data.success === false) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

export const aovivo = {
  async login(identifier: string, password: string) {
    const data = await call<{ token: string }>("/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
    localStorage.setItem(TOKEN_KEY, data.token);
  },
  me: () => call<AoVivoMe>("/me"),
  create: (title: string) => call("/streams", { method: "POST", body: JSON.stringify({ title }) }),
  update: (id: string, body: Partial<Pick<AoVivoStream, "title" | "rtmp_url" | "stream_key">>) =>
    call(`/streams/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: string) => call(`/streams/${id}`, { method: "DELETE" }),
  start: (id: string) => call(`/streams/${id}/start`, { method: "POST" }),
  stop: (id: string) => call(`/streams/${id}/stop`, { method: "POST" }),
  removeVideo: (id: string, videoId: string) => call(`/streams/${id}/videos/${videoId}`, { method: "DELETE" }),
  order: (id: string, ids: string[]) => call(`/streams/${id}/order`, { method: "POST", body: JSON.stringify({ ids }) }),
  users: (q: string) => call<{ users: AoVivoUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`),
  setLimit: (user_id: string, max_streams: number) =>
    call("/admin/limits", { method: "POST", body: JSON.stringify({ user_id, max_streams }) }),

  /** Envio com progresso real (XHR). */
  upload(id: string, file: File, onProgress: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/streams/${id}/videos`);
      const token = getToken();
      if (token) xhr.setRequestHeader("x-aovivo-token", token);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let data: { success?: boolean; error?: string } = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* resposta não-JSON */ }
        if (xhr.status >= 200 && xhr.status < 300 && data.success !== false) resolve();
        else reject(new Error(data.error || `Falha no envio (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error("Conexão interrompida durante o envio."));
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
  },
};

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}
export const formatMB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
