export interface Affiliate {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  active: boolean;
  createdAt: string;
  commissionNotified?: string[];
  isLifetime?: boolean;
  source?: string;
  squarecloudUsername?: string;
  showPromoBanner?: boolean;
}

export function findAffiliateByEmail(affiliates: Affiliate[], email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return affiliates.find((affiliate) => affiliate.email.trim().toLowerCase() === normalizedEmail);
}

export function replaceAffiliateByEmail(
  affiliates: Affiliate[],
  email: string,
  replacement: Affiliate,
) {
  const existing = findAffiliateByEmail(affiliates, email);
  if (!existing) return { affiliates, affiliate: null };

  // Keep the public ID and sales history attached to the original affiliate.
  const affiliate: Affiliate = {
    ...replacement,
    id: existing.id,
    createdAt: existing.createdAt,
    commissionNotified: existing.commissionNotified || [],
  };

  return {
    affiliate,
    affiliates: affiliates.map((item) => item.id === existing.id ? affiliate : item),
  };
}
