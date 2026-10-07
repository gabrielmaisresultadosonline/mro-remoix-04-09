import { supabase } from '@/integrations/supabase/client';
import { adminSupabase } from '@/lib/adminSupabase';

export type WlPlan = 'annual' | 'lifetime';
export const WL_TOKEN_KEY = 'whitelabel_token';

export interface WlReseller {
  id: string; name: string; username: string; email: string | null; password_plain?: string | null;
  status: 'active' | 'blocked'; active_until: string | null; pix_type: string | null; pix_key: string | null;
  brand_file_path: string | null; brand_file_name: string | null; link_code: string; notes: string | null;
  created_at: string; can_sell?: boolean; brand_logo_path?: string | null; brand_logo_url?: string | null;
}
export interface WlClient { id: string; reseller_id: string; mro_user_id: string | null; username: string; email: string | null; plan: WlPlan; extras_added: number; origin: 'manual' | 'link'; created_at: string }
export interface WlUser { id: string; is_active: boolean; extra_accounts: number | null; plan_accounts: number; trials_used: number; expires_at: string | null; password_plain?: string | null }
export interface WlFee { id: string; reseller_id: string; client_id: string | null; sale_id: string | null; kind: string; quantity: number; amount: number; description: string | null; status: 'pending' | 'paid'; paid_via: string | null; created_at: string; paid_at: string | null }
export interface WlSale { id: string; reseller_id?: string; link_type: 'renda_extra' | 'cliente_final'; plan: WlPlan; buyer_name: string | null; buyer_email: string; buyer_phone: string | null; buyer_username: string; amount: number; fee_amount: number; net_amount: number; status: 'pending' | 'paid' | 'expired'; payout_status: 'pending' | 'paid'; created_at: string; paid_at: string | null }
export interface WlTutorial { id: string; title: string; content: string | null; video_url: string | null; order_index: number; is_active: boolean }

export const brl = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
export const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
export const planLabel = (p: WlPlan) => (p === 'lifetime' ? 'Vitalício' : 'Anual');

export function summarize(fees: WlFee[], sales: WlSale[]) {
  const paidSales = sales.filter((s) => s.status === 'paid');
  const manualPending = fees.filter((f) => f.status === 'pending' && !f.sale_id).reduce((a, f) => a + Number(f.amount), 0);
  const feesPaid = fees.filter((f) => f.status === 'paid').reduce((a, f) => a + Number(f.amount), 0);
  const payoutPending = paidSales.filter((s) => s.payout_status === 'pending').reduce((a, s) => a + Number(s.net_amount), 0);
  const soldTotal = paidSales.reduce((a, s) => a + Number(s.amount), 0);
  const feesTotal = fees.reduce((a, f) => a + Number(f.amount), 0);
  return { manualPending, feesPaid, payoutPending, soldTotal, feesTotal };
}

async function unwrap<T>(p: Promise<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  const d = (data ?? {}) as { success?: boolean; error?: string };
  if (d.success === false) throw new Error(d.error || 'Erro');
  if (error && !data) {
    const ctx = (error as { context?: Response }).context;
    const parsed = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(parsed?.error || (error as Error).message || 'Erro');
  }
  return data as T;
}

export const wlCall = <T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}) =>
  unwrap<T>(supabase.functions.invoke('whitelabel-api', { body: { action, token: localStorage.getItem(WL_TOKEN_KEY), ...body } }));

export const wlAdmin = <T = Record<string, unknown>>(action: string, body: Record<string, unknown> = {}) =>
  unwrap<T>(adminSupabase.functions.invoke('whitelabel-api', { body: { action, ...body } }));

export interface WlSalesContext { code: string; name: string; logoUrl?: string | null; prices: Record<string, number>; linkType: "renda_extra" | "cliente_final" }
