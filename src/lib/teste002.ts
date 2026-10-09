import { supabase } from "@/integrations/supabase/client";

export interface Teste002Test {
  username: string;
  instagram: string;
  created_at: string;
  expires_at: string;
  expired: boolean;
  remaining_hours: number;
}

export interface Teste002AdminUser {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  instagram_username: string;
  username: string;
  expires_at: string;
  last_access: string | null;
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
