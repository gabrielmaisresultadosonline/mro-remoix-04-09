import { supabase } from "@/integrations/supabase/client";

export interface Teste002Test {
  username: string;
  instagram: string | null;
  instagram_registered: boolean;
  started: boolean;
  created_at: string;
  expires_at: string | null;
  expired: boolean;
  remaining_hours: number;
}

export interface Teste002AdminUser {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  instagram_username: string | null;
  username: string;
  expires_at: string | null;
  last_access: string | null;
  last_extension_access: string | null;
  last_browser_access: string | null;
  last_browser_url: string | null;
  extension_version: string | null;
  email_sent: boolean;
  created_at: string;
}

/** Chama a função do teste grátis e devolve a mensagem real do servidor em caso de erro. */
export async function teste002Call<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("teste002-api", { body });
  if (error) {
    let msg = "Não foi possível concluir. Tente novamente.";
    const ctx = (error as { context?: Response }).context;
    try {
      if (ctx && typeof ctx.json === "function") msg = (await ctx.json())?.error || msg;
    } catch {
      /* mantém a mensagem padrão */
    }
    throw new Error(msg);
  }
  if (!data?.success) throw new Error(data?.error || "Não foi possível concluir.");
  return data as T;
}

/** Carrega as fontes da identidade MRO (Archivo Black + Hind) uma única vez. */
export function loadTeste002Fonts(): void {
  if (document.getElementById("t2-fonts")) return;
  const link = document.createElement("link");
  link.id = "t2-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@400;600;700&display=swap";
  document.head.appendChild(link);
}

export const MRO_LOGO = "https://maisresultadosonline.com.br/assets/logo-mro-Cqe3By7y.png";

export const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

export interface NoticeButton { label: string; url: string }
export interface Teste002Notice {
  id?: string;
  title: string;
  message: string;
  image_url: string;
  youtube_url: string;
  buttons: NoticeButton[];
  lock_seconds: number;
  schedule_times: string[];
  repeat_daily: boolean;
  target: "all" | "active" | "expired" | "not_started";
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at?: string;
}
export interface Teste002Report {
  by_notice: Record<string, { seen: number; not_seen: number; shown: number; closed: number; clicks: number; seen_users: string[] }>;
  by_user: Record<string, { read_notices: number; closed_total: number; clicks: number; last_closed_at: string | null }>;
  extension_active: number;
  extension_inactive: number;
  active_window_hours: number;
}
