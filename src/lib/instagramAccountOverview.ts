import type { InstagramProfile, ProfileAnalysis, ProfileSession } from '@/types/instagram';

export interface AccountMetrics {
  instagram_username: string;
  initial_followers: number | null;
  current_followers: number | null;
  initial_captured_at: string | null;
  last_seen_at: string | null;
  metrics_updated_at?: string | null;
  welcome_total: number;
  online: boolean;
  metrics: { day: string; followers_end: number | null; welcome_sent: number }[];
}

export function accountFollowerSummary(session: ProfileSession, metrics?: AccountMetrics) {
  const initial = metrics?.initial_followers ?? (session.profile.dataSource === 'screenshot' ? session.initialSnapshot?.followers ?? session.profile.followers : null);
  const current = metrics?.current_followers ?? null;
  return { initial, current, growth: initial !== null && current !== null ? current - initial : null };
}

export function accountUsageSummary(session: ProfileSession, metrics?: AccountMetrics, now = new Date()) {
  const candidates = [metrics?.initial_captured_at, session.initialSnapshot?.date, session.startedAt];
  const startedAt = candidates.find(value => value && Number.isFinite(Date.parse(value))) ?? null;
  if (!startedAt) return null;
  // Compare calendar dates in Brazil, so daylight-saving/time-of-day cannot add or remove a day.
  const calendar = (value: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(value);
    const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
    return { year: part('year'), month: part('month'), day: part('day') };
  };
  const start = calendar(new Date(startedAt)), end = calendar(now);
  const totalDays = Math.max(0, Math.floor((Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)) / 86_400_000));
  let months = Math.max(0, (end.year - start.year) * 12 + end.month - start.month);
  const anniversary = (count: number) => {
    const first = new Date(Date.UTC(start.year, start.month - 1 + count, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(start.day, lastDay));
  };
  const endDay = Date.UTC(end.year, end.month - 1, end.day);
  if (months > 0 && anniversary(months) > endDay) months--;
  const days = Math.max(0, Math.floor((endDay - anniversary(months)) / 86_400_000));
  const duration = months > 0 ? `${months} ${months === 1 ? 'mês' : 'meses'} e ${days} ${days === 1 ? 'dia' : 'dias'} (${totalDays} dias no total)` : `${totalDays} ${totalDays === 1 ? 'dia' : 'dias'}`;
  return { startedAt, totalDays, months, days, duration, date: new Date(startedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) };
}

export function createAccountProfile(username: string, fullName: string): InstagramProfile {
  return { username, fullName, bio: '', followers: 0, following: 0, posts: 0, profilePicUrl: '', isBusinessAccount: false, category: '', externalUrl: '', recentPosts: [], engagement: 0, avgLikes: 0, avgComments: 0, needsScreenshotAnalysis: false, dataSource: 'placeholder' };
}

export function businessAnalysis(description: string, previous?: ProfileAnalysis): ProfileAnalysis {
  return { strengths: previous?.strengths ?? [], weaknesses: previous?.weaknesses ?? [], opportunities: previous?.opportunities ?? [], niche: description.trim(), audienceType: previous?.audienceType ?? '', contentScore: previous?.contentScore ?? 0, engagementScore: previous?.engagementScore ?? 0, profileScore: previous?.profileScore ?? 0, recommendations: [description.trim()] };
}

export function filterInstagramAccounts(accounts: ProfileSession[], query: string) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^@/, '').trim();
  const term = normalize(query);
  return accounts.filter(a => normalize(a.profile.username).includes(term) || normalize(a.profile.fullName ?? '').includes(term));
}

export function summarizeAccountGrowth(accounts: ProfileSession[], metrics: Record<string, AccountMetrics>) {
  const rows = accounts.map(a => ({ username: a.profile.username, ...accountFollowerSummary(a, metrics[a.profile.username]) }));
  const complete = rows.filter(r => r.initial !== null && r.current !== null);
  return {
    rows,
    initial: complete.reduce((total, r) => total + (r.initial ?? 0), 0),
    current: complete.reduce((total, r) => total + (r.current ?? 0), 0),
    growth: complete.reduce((total, r) => total + (r.growth ?? 0), 0),
    measured: complete.length,
    pending: rows.length - complete.length,
    welcome: accounts.reduce((total, a) => total + (metrics[a.profile.username]?.welcome_total ?? 0), 0),
    latest: accounts.map(a => metrics[a.profile.username]?.metrics_updated_at).filter((v): v is string => Boolean(v)).sort().pop() ?? null,
    images: accounts.flatMap(a => (a.creatives ?? []).filter(c => c.imageUrl).map(c => ({ ...c, username: a.profile.username }))),
  };
}