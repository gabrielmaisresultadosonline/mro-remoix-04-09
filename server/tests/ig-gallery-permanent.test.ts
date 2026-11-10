import { describe, expect, it, mock } from 'bun:test';

const queries: { sql: string; params: unknown[] }[] = [];
const rows = [{ id: 'a', instagram_username: 'loja', publication_id: 'p', image_index: 0 }, { id: 'b', instagram_username: 'outro', publication_id: 'p', image_index: 1 }];
mock.module('../src/db.js', () => ({ adminQuery: async (sql: string, params: unknown[] = []) => { queries.push({ sql, params }); return rows; } }));
mock.module('../src/env.js', () => ({ env: { storage: { root: '/tmp/ig-gallery-permanent-test' } } }));
const { cleanupExpired, ownedGalleryImages, adminGallery, handleGalleryGet, GALLERY_RETENTION_DAYS } = await import('../src/functions/ig-online-gallery');

describe('permanência e isolamento da galeria', () => {
  it('não apaga arquivos automaticamente mesmo com limpeza forçada', async () => {
    queries.length = 0;
    expect(GALLERY_RETENTION_DAYS).toBeNull();
    expect(await cleanupExpired(true)).toBe(0);
    expect(queries).toHaveLength(0);
  });
  it('consulta só perfis autorizados e não devolve imagens de outro cliente', async () => {
    expect((await ownedGalleryImages(['loja'], '/api')).map(i => i.id)).toEqual(['a']);
    expect(queries.at(-1)?.params).toEqual([['loja']]);
    expect(queries.at(-1)?.sql).toContain('ANY($1::text[])');
  });
  it('galeria admin continua listando imagens antigas sem filtro de expiração', async () => {
    queries.length = 0;
    await adminGallery({}, '/api');
    expect(queries[0].sql).not.toContain('expires_at > now()');
  });
  it('galeria pública preserva arquivos antigos e não expõe o Instagram', async () => {
    let result: { images: Record<string, unknown>[] } | undefined;
    const res = { setHeader: () => {}, json: (value: typeof result) => { result = value; } };
    await handleGalleryGet({ query: { public_gallery: '1' } } as never, res as never, '/api');
    expect(queries.at(-1)?.sql).not.toContain('expires_at > now()');
    expect(result?.images[0]).not.toHaveProperty('instagram_username');
    expect(result?.images).toHaveLength(2);
  });
});