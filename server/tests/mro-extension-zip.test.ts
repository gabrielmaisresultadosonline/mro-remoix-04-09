/**
 * Regras do ZIP da extensão MRO Ferramenta.
 * Uso: npx tsx tests/mro-extension-zip.test.ts
 */
import assert from "node:assert/strict";
import { cleanVersion, isZipBuffer, MAX_ZIP_BYTES, safeZipName } from "../src/extension-files/zip.js";

// Só aceita arquivos que realmente são ZIP.
assert.equal(isZipBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14])), true);
assert.equal(isZipBuffer(Buffer.from([0x50, 0x4b, 0x05, 0x06])), true);
assert.equal(isZipBuffer(Buffer.from("not a zip")), false);
assert.equal(isZipBuffer(Buffer.from([0x89, 0x50, 0x4e, 0x47])), false);

// Limite abaixo dos 100 MB que o Cloudflare aceita.
assert.equal(MAX_ZIP_BYTES, 95 * 1024 * 1024);

// Nome de download sempre seguro e terminando em .zip.
assert.equal(safeZipName("../../etc/MRO Ferramenta v2.zip"), "MRO-Ferramenta-v2.zip");
assert.equal(safeZipName('a"b.ZIP'), "ab.zip");
assert.equal(safeZipName(""), "mro-ferramenta.zip");

assert.equal(cleanVersion(" 2.4.1 "), "2.4.1");
assert.equal(cleanVersion(""), null);

console.log("mro-extension-zip: ok");
