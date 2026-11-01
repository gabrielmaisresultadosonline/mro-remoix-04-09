import { getAdminSessionToken } from '@/lib/adminConfig';

/** O ZIP da extensão fica no servidor próprio (VPS), não na nuvem. */
export const MRO_EXTENSION_FILE_BASE = 'https://api.maisresultadosonline.com.br/functions/v1/mro-extension-file';
export const MRO_EXTENSION_LATEST_URL = `${MRO_EXTENSION_FILE_BASE}/latest`;
export const MRO_EXTENSION_DOWNLOAD_URL = `${MRO_EXTENSION_FILE_BASE}/download`;

export interface MroExtensionFileInfo {
  available: boolean;
  id?: string;
  file_name?: string;
  size_bytes?: number;
  sha256?: string;
  version?: string | null;
  notes?: string | null;
  updated_at?: string;
  download_url?: string;
  latest_url?: string;
}

export async function fetchMroExtensionFile(): Promise<MroExtensionFileInfo> {
  const res = await fetch(MRO_EXTENSION_LATEST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
  return res.json();
}

export function formatBytes(bytes = 0): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

/** Envia o ZIP com barra de progresso (XHR informa o andamento do envio). */
export function uploadMroExtensionZip(
  file: File,
  version: string,
  onProgress: (percent: number) => void,
): Promise<MroExtensionFileInfo> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    if (version.trim()) form.append('version', version.trim());
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${MRO_EXTENSION_FILE_BASE}/upload`);
    const token = getAdminSessionToken();
    if (token) xhr.setRequestHeader('x-admin-token', token);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new Error('Falha de conexão com o servidor.'));
    xhr.onload = () => {
      let data: { error?: string } & MroExtensionFileInfo = { available: false };
      try { data = JSON.parse(xhr.responseText); } catch { /* resposta não-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Erro ${xhr.status} ao enviar.`));
    };
    xhr.send(form);
  });
}

export async function removeCurrentMroExtensionZip(): Promise<void> {
  const token = getAdminSessionToken();
  const res = await fetch(`${MRO_EXTENSION_FILE_BASE}/current`, {
    method: 'DELETE',
    headers: token ? { 'x-admin-token': token } : {},
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
}
