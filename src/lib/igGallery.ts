/** API IG Online no servidor MRO (VPS Express + PostgreSQL). */
export const IG_ONLINE_ENDPOINT = 'https://api.maisresultadosonline.com.br/functions/v1/ig-online-api';
export const IG_GALLERY_PUBLIC_PATH = '/galeria-ig';

export interface PublicGalleryImage {
  id: string;
  url: string;
  caption: string | null;
  created_at: string;
}

export async function fetchPublicGallery(before?: string | null) {
  const qs = new URLSearchParams({ public_gallery: '1', limit: '60' });
  if (before) qs.set('before', before);
  const res = await fetch(`${IG_ONLINE_ENDPOINT}?${qs}`);
  if (!res.ok) throw new Error(`Falha ao carregar (${res.status})`);
  return (await res.json()) as { images: PublicGalleryImage[]; next_before: string | null };
}
