import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Loader2, Play, Radio, Square, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { aovivo, formatDuration, formatMB, type AoVivoStream } from "@/lib/aovivoApi";

export interface StreamCardProps { stream: AoVivoStream; maxBytes: number; showOwner: boolean; onChange: () => void }

export const StreamCard = ({ stream, maxBytes, showOwner, onChange }: StreamCardProps) => {
  const { toast } = useToast();
  const [rtmp, setRtmp] = useState(stream.rtmp_url);
  const [key, setKey] = useState(stream.stream_key);
  const [title, setTitle] = useState(stream.title);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const used = stream.videos.reduce((sum, v) => sum + v.size_bytes, 0);
  const live = stream.status === "running";

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try { await fn(); if (ok) toast({ title: ok }); onChange(); }
    catch (e) { toast({ title: "Ops", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const save = () => run(() => aovivo.update(stream.id, { title, rtmp_url: rtmp, stream_key: key }), "Dados salvos");

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let total = used;
    for (const file of Array.from(files)) {
      if (total + file.size > maxBytes) {
        toast({ title: "Limite de 100MB", description: `"${file.name}" não cabe: a lista inteira precisa ter no máximo 100MB.`, variant: "destructive" });
        break;
      }
      try { setProgress(0); await aovivo.upload(stream.id, file, setProgress); total += file.size; }
      catch (e) { toast({ title: "Falha no envio", description: (e as Error).message, variant: "destructive" }); break; }
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    onChange();
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = stream.videos.map((v) => v.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => aovivo.order(stream.id, ids));
  };

  const copy = (value: string) => { void navigator.clipboard.writeText(value); toast({ title: "Copiado" }); };

  return (
    <article className={cn("av-card rounded-2xl border border-border bg-card p-5 space-y-5", live && "av-card-live")}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {live ? <span className="av-live-badge">● AO VIVO</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{stream.status === "error" ? "Erro" : "Parado"}</span>}
            {showOwner && <span className="text-xs text-muted-foreground">@{stream.owner_label}</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Tempo no ar: <b className="text-foreground">{formatDuration(stream.total_seconds)}</b></p>
        </div>
        <div className="flex gap-2">
          {live ? (
            <Button variant="secondary" disabled={busy} onClick={() => run(() => aovivo.stop(stream.id), "Live pausada")}><Square className="mr-1 h-4 w-4" />Pausar</Button>
          ) : (
            <Button className="av-ig-button" disabled={busy || !stream.videos.length} onClick={() => run(() => aovivo.start(stream.id), "Transmissão iniciada! Agora clique em Go live no Instagram.")}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}Iniciar ao vivo
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="Excluir live" disabled={busy}
            onClick={() => window.confirm("Excluir esta live e todos os vídeos?") && run(() => aovivo.remove(stream.id), "Live excluída")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {stream.last_error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{stream.last_error}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1"><Label>Nome da live</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>URL do stream</Label>
          <div className="flex gap-1"><Input value={rtmp} placeholder="rtmps://edgetee-upload-...:443/rtmp/" onChange={(e) => setRtmp(e.target.value)} />
            <Button variant="ghost" size="icon" aria-label="Copiar URL" onClick={() => copy(rtmp)}><Copy className="h-4 w-4" /></Button></div>
        </div>
        <div className="space-y-1"><Label>Chave de stream</Label>
          <div className="flex gap-1"><Input type="password" value={key} placeholder="Cole a chave do Instagram" onChange={(e) => setKey(e.target.value)} />
            <Button variant="ghost" size="icon" aria-label="Copiar chave" onClick={() => copy(key)}><Copy className="h-4 w-4" /></Button></div>
        </div>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={save}>Salvar dados</Button>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><Radio className="h-4 w-4 text-primary" />Playlist em loop ({stream.videos.length}/20)</h3>
          <span className="text-xs text-muted-foreground">{formatMB(used)} de {formatMB(maxBytes)}</span>
        </div>
        <Progress value={(used / maxBytes) * 100} className="h-1.5" />
        <ul className="space-y-1.5">
          {stream.videos.map((v, i) => (
            <li key={v.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="w-5 text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate">{v.file_name}</span>
              <span className="text-xs text-muted-foreground">{formatMB(v.size_bytes)}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Subir" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Descer" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remover vídeo" onClick={() => run(() => aovivo.removeVideo(stream.id, v.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </li>
          ))}
        </ul>
        {progress !== null ? (
          <div className="space-y-1"><Progress value={progress} /><p className="text-xs text-muted-foreground">Enviando… {progress}%</p></div>
        ) : (
          <>
            <input ref={fileRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            <Button variant="secondary" disabled={stream.videos.length >= 20} onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Adicionar vídeos</Button>
          </>
        )}
        {live && <p className="text-xs text-muted-foreground">Mudou a playlist? Pause e inicie de novo para aplicar.</p>}
      </section>
    </article>
  );
};
