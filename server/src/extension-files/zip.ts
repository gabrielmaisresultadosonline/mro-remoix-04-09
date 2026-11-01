/** Regras puras do arquivo ZIP da extensão (testáveis sem banco). */

/** Cloudflare recusa corpos acima de 100 MB; ficamos abaixo disso. */
export const MAX_ZIP_BYTES = 95 * 1024 * 1024;

/** Quantos arquivos antigos manter no disco além do atual. */
export const KEEP_PREVIOUS = 4;

/** Um ZIP começa com "PK\x03\x04" (ou "PK\x05\x06" quando vazio). */
export function isZipBuffer(buf: Buffer): boolean {
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return false;
  return (buf[2] === 0x03 && buf[3] === 0x04) || (buf[2] === 0x05 && buf[3] === 0x06);
}

/** Nome seguro para o cabeçalho de download; sempre termina em .zip. */
export function safeZipName(name: string | undefined | null): string {
  const base = String(name ?? "")
    .split(/[\\/]/).pop()!
    .normalize("NFKD").replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-").replace(/^\.+/, "")
    .slice(0, 120);
  const cleaned = base.replace(/\.zip$/i, "");
  return `${cleaned || "mro-ferramenta"}.zip`;
}

/** Versão opcional informada pelo admin (ex.: 2.4.1). */
export function cleanVersion(value: unknown): string | null {
  const v = String(value ?? "").trim().slice(0, 40);
  return v ? v.replace(/[^\w.\-+ ]/g, "") || null : null;
}
