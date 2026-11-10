import type { InstagramProfile, ProfileAnalysis, ProfileSession } from '@/types/instagram';

export interface AccountMetrics {
  instagram_username: string;
  initial_followers: number | null;
  current_followers: number | null;
  initial_captured_at: string | null;
  last_seen_at: string | null;
  welcome_total: number;
  online: boolean;
  metrics: { day: string; followers_end: number | null; welcome_sent: number }[];
}

export function accountFollowerSummary(session: ProfileSession, metrics?: AccountMetrics) {
  const initial = metrics?.initial_followers ?? (session.profile.dataSource === 'screenshot' ? session.initialSnapshot?.followers ?? session.profile.followers : null);
  const current = metrics?.current_followers ?? null;
  return { initial, current, growth: initial !== null && current !== null ? current - initial : null };
}

export function createAccountProfile(username: string, fullName: string): InstagramProfile {
  return { username, fullName, bio: '', followers: 0, following: 0, posts: 0, profilePicUrl: '', isBusinessAccount: false, category: '', externalUrl: '', recentPosts: [], engagement: 0, avgLikes: 0, avgComments: 0, needsScreenshotAnalysis: false, dataSource: 'placeholder' };
}

export function businessAnalysis(description: string, previous?: ProfileAnalysis): ProfileAnalysis {
  return { strengths: previous?.strengths ?? [], weaknesses: previous?.weaknesses ?? [], opportunities: previous?.opportunities ?? [], niche: description.trim(), audienceType: previous?.audienceType ?? '', contentScore: previous?.contentScore ?? 0, engagementScore: previous?.engagementScore ?? 0, profileScore: previous?.profileScore ?? 0, recommendations: [description.trim()] };
}