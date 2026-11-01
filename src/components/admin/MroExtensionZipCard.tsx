import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Archive, BookOpen, Copy, Download, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import {
  fetchMroExtensionFile, formatBytes, formatDateTime, removeCurrentMroExtensionZip, uploadMroExtensionZip,
  MRO_EXTENSION_DOWNLOAD_URL, MRO_EXTENSION_LATEST_URL, type MroExtensionFileInfo,
} from '@/lib/mroExtensionFile';

const EXTENSION_CODE = `// Na extensão (background/service worker). Adicione em host_permissions:
//   "https://api.maisresultadosonline.com.br/*"
const LATEST = "${MRO_EXTENSION_LATEST_URL}";

async function checkMroUpdate() {
  const info = await (await fetch(LATEST, { cache: "no-store" })).json();
  if (!info.available) return null;
  const { lastSha } = await chrome.storage.local.get("lastSha");
  if (info.sha256 === lastSha) return null;        // já está na versão mais nova
  // Há arquivo novo: baixe e guarde o sha256 para não repetir
  await chrome.downloads.download({ url: info.download_url, filename: info.file_name });
  await chrome.storage.local.set({ lastSha: info.sha256, lastUpdatedAt: info.updated_at });
  return info;
}

// Ex.: checar a cada 6 horas
chrome.alarms.create("mro-update", { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener((a) => a.name === "mro-update" && checkMroUpdate());`;

const SAMPLE_RESPONSE = `{
  "available": true,
  "file_name": "mro-ferramenta.zip",
  "size_bytes": 1843200,
  "sha256": "9f2c...e81a",
  "version": "2.4.1",
  "updated_at": "2026-11-01T13:51:00.000Z",
  "download_url": "${MRO_EXTENSION_DOWNLOAD_URL}",
  "latest_url": "${MRO_EXTENSION_LATEST_URL}"
}`;

/** Arquivo ZIP da extensão: envio no /admin, baixado no /mro-ferramenta e pela extensão. */
const MroExtensionZipCard = () => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState<MroExtensionFileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try { setInfo(await fetchMroExtensionFile()); }
    catch (e) { setLoadError(e instanceof Error ? e.message : 'Servidor indisponível'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      toast({ title: 'Arquivo inválido', description: 'Selecione um arquivo .zip', variant: 'destructive' });
      return;
    }
    setProgress(0);
    try {
      const next = await uploadMroExtensionZip(file, version, setProgress);
      setInfo(next);
      setVersion('');
      toast({ title: 'ZIP enviado!', description: `${next.file_name} já está disponível para download.` });
    } catch (e) {
      toast({ title: 'Erro ao enviar', description: e instanceof Error ? e.message : 'Tente novamente', variant: 'destructive' });
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onRemove = async () => {
    if (!confirm('Parar de oferecer o ZIP atual para download?')) return;
    try { await removeCurrentMroExtensionZip(); setInfo({ available: false }); toast({ title: 'ZIP removido do download' }); }
    catch (e) { toast({ title: 'Erro', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <Archive className="w-4 h-4" />
          Arquivo ZIP da extensão (download direto)
        </Label>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading} aria-label="Atualizar">
            <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setDocsOpen(true)}>
            <BookOpen className="w-4 h-4 mr-2" />
            Documentação
          </Button>
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">Não foi possível consultar o servidor: {loadError}</p>}

      {info?.available ? (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm space-y-1">
          <p className="font-medium break-all">{info.file_name}{info.version ? ` · v${info.version}` : ''}</p>
          <p className="text-muted-foreground">
            {formatBytes(info.size_bytes)} · Atualizado em {formatDateTime(info.updated_at)}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm" variant="outline">
              <a href={MRO_EXTENSION_DOWNLOAD_URL}><Download className="w-4 h-4 mr-2" />Baixar</a>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onRemove}>
              <Trash2 className="w-4 h-4 mr-2" />Remover
            </Button>
          </div>
        </div>
      ) : !loading && !loadError ? (
        <p className="text-sm text-muted-foreground">Nenhum ZIP enviado ainda. O botão de download no /mro-ferramenta aparece depois do envio.</p>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Versão (opcional, ex.: 2.4.1)"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          className="bg-secondary/50 sm:max-w-xs"
          disabled={progress !== null}
        />
        <input ref={inputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
          {progress !== null ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {progress !== null ? `Enviando ${progress}%` : info?.available ? 'Enviar novo ZIP' : 'Enviar ZIP'}
        </Button>
      </div>
      {progress !== null && <Progress value={progress} />}
      <p className="text-xs text-muted-foreground">Até 95 MB. O novo arquivo substitui o anterior na hora.</p>

      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documentação — ZIP da extensão</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <section className="space-y-2">
              <h4 className="font-semibold">Arquivo atual</h4>
              {info?.available ? (
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p><span className="text-muted-foreground">Nome:</span> {info.file_name}</p>
                  {info.version && <p><span className="text-muted-foreground">Versão:</span> {info.version}</p>}
                  <p><span className="text-muted-foreground">Data e horário da atualização:</span> {formatDateTime(info.updated_at)}</p>
                  <p><span className="text-muted-foreground">Tamanho:</span> {formatBytes(info.size_bytes)}</p>
                  <p className="break-all"><span className="text-muted-foreground">SHA-256:</span> {info.sha256}</p>
                </div>
              ) : <p className="text-muted-foreground">Nenhum arquivo enviado ainda.</p>}
            </section>

            {[
              { label: 'Link de download (sempre o arquivo mais novo)', url: MRO_EXTENSION_DOWNLOAD_URL },
              { label: 'Link de informações (JSON com data/horário)', url: MRO_EXTENSION_LATEST_URL },
            ].map((l) => (
              <section key={l.url} className="space-y-2">
                <h4 className="font-semibold">{l.label}</h4>
                <div className="flex gap-2">
                  <Input readOnly value={l.url} className="font-mono text-xs" />
                  <Button type="button" size="icon" variant="outline" onClick={() => copy(l.url)} aria-label="Copiar"><Copy className="w-4 h-4" /></Button>
                </div>
              </section>
            ))}

            <section className="space-y-2">
              <h4 className="font-semibold">Como funciona</h4>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>O link de download nunca muda: ao enviar um ZIP novo, ele passa a entregar o novo arquivo.</li>
                <li>Use o <b>sha256</b> (ou o <b>updated_at</b>) do link de informações para saber se há atualização.</li>
                <li>O download responde com <code>ETag</code> = sha256; enviando <code>If-None-Match</code> com o mesmo valor, a resposta é 304 (nada a baixar).</li>
                <li>Sem arquivo disponível, o link de informações retorna <code>{'{ "available": false }'}</code> e o download retorna 404.</li>
                <li>Os dois links são públicos (sem login) e aceitam chamadas da extensão.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Resposta do link de informações</h4>
                <Button type="button" size="sm" variant="ghost" onClick={() => copy(SAMPLE_RESPONSE)}><Copy className="w-4 h-4" /></Button>
              </div>
              <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">{SAMPLE_RESPONSE}</pre>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Código para a extensão (atualização automática)</h4>
                <Button type="button" size="sm" variant="ghost" onClick={() => copy(EXTENSION_CODE)}><Copy className="w-4 h-4" /></Button>
              </div>
              <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto">{EXTENSION_CODE}</pre>
              <p className="text-xs text-muted-foreground">Permissões no manifest: <code>downloads</code>, <code>storage</code>, <code>alarms</code>.</p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MroExtensionZipCard;
