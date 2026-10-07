import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { wlAdmin, wlCall } from '@/lib/whitelabel';
import { toast } from 'sonner';

export interface WlLogoUploadProps { resellerId?: string; logoUrl?: string | null; onChanged: () => void }

export function WlLogoUpload({ resellerId, logoUrl, onChanged }: WlLogoUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error('Envie uma logo PNG, JPG ou WebP de até 5 MB.'); return;
    }
    setBusy(true);
    try {
      const body = { id: resellerId, content_type: file.type };
      const signed = resellerId
        ? await wlAdmin<{ path: string; token: string }>('admin_logo_upload_url', body)
        : await wlCall<{ path: string; token: string }>('logo_upload_url', body);
      const { error } = await supabase.storage.from('whitelabel-files').uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (error) throw error;
      if (resellerId) await wlAdmin('admin_set_logo', { id: resellerId, path: signed.path });
      else await wlCall('set_logo', { path: signed.path });
      toast.success('Logo salva'); onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a logo.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {logoUrl && <img src={logoUrl} alt="Logo do revendedor" className="w-16 h-12 object-contain" />}
      <input ref={input} aria-label="Logo do revendedor" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
        {busy ? 'Enviando...' : 'Enviar logo'}
      </Button>
    </div>
  );
}