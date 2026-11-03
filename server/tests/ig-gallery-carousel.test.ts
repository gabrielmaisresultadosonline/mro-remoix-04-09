/**
 * Galeria IG Online: carrossel precisa ficar agrupado (mesmo publication_id, slides 0..n).
 * Uso: IG_TEST_DATABASE_URL=postgres://... STORAGE_ROOT=/tmp/x npx tsx tests/ig-gallery-carousel.test.ts
 * (o banco precisa da migração 023_ig_online_gallery.sql).
 */
import assert from "node:assert/strict";
process.env.DATABASE_URL = process.env.IG_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret";
const { galleryUpload } = await import("../src/functions/ig-online-gallery.js");
const { pool } = await import("../src/db.js");

// PNG 1x1 válido
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const rows = async (pub: string) =>
  (await pool.query("SELECT image_index FROM ig_online_gallery WHERE publication_id=$1 ORDER BY image_index", [pub])).rows.map((r) => r.image_index);

try {
  await pool.query("DELETE FROM ig_online_gallery WHERE instagram_username='perfilgaleria'");

  // Formato A: uma requisição por slide, mesmo publication_id → 3 slides no mesmo carrossel
  for (const i of [0, 1, 2]) {
    const [s, b] = await galleryUpload("perfilgaleria", { publication_id: "pubA", image_index: i, image_base64: PNG, caption: "Leg" });
    assert.equal(s, 200); assert.equal(b.duplicate, false);
  }
  assert.deepEqual(await rows("pubA"), [0, 1, 2]);
  // Reenvio do mesmo slide não duplica
  const [, again] = await galleryUpload("perfilgaleria", { publication_id: "pubA", image_index: 1, image_base64: PNG });
  assert.equal(again.duplicate, true);

  // Formato B: carrossel inteiro numa requisição, sem publication_id → servidor agrupa
  const [sb, bb] = await galleryUpload("perfilgaleria", { images: [PNG, PNG, PNG, PNG], caption: "Carrossel" });
  assert.equal(sb, 200); assert.equal(bb.saved, 4);
  assert.deepEqual(await rows(String(bb.publication_id)), [0, 1, 2, 3]);

  // Formato B com objetos e índice explícito
  const [, bc] = await galleryUpload("perfilgaleria", { publication_id: "pubC", images: [{ image_base64: PNG, image_index: 1 }, { image_base64: PNG, image_index: 0 }] });
  assert.equal(bc.saved, 2);
  assert.deepEqual(await rows("pubC"), [0, 1]);

  // Índice "0" não vira problema e slide inválido não derruba os outros
  const [, bd] = await galleryUpload("perfilgaleria", { publication_id: "pubD", images: [PNG, "nao-e-imagem", PNG] });
  assert.equal(bd.saved, 2);
  assert.deepEqual(await rows("pubD"), [0, 2]);

  console.log("ig-gallery-carousel: OK");
} finally {
  await pool.query("DELETE FROM ig_online_gallery WHERE instagram_username='perfilgaleria'");
  await pool.end();
}
