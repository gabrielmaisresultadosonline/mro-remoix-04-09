import { useState, type ClipboardEvent } from "react";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { teste002Call, type Teste002Notice } from "@/lib/teste002";

export const EMPTY_NOTICE: Teste002Notice = {
  title: "", message: "", image_url: "", youtube_url: "", buttons: [], lock_seconds: 0,
  schedule_times: ["09:00"], repeat_daily: true, target: "all", start_date: null, end_date: null, is_active: true,
};

interface Props { token: string; initial: Teste002Notice; onSaved: () => void; onCancel: () => void }

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    r.readAsDataURL(file);
  });

/** Formulário do aviso: texto, imagem (colar/arquivo/link), YouTube, até 3 botões, trava e horários diários. */
export const Teste002NoticeEditor = ({ token, initial, onSaved, onCancel }: Props) => {
  const [n, setN] = useState<Teste002Notice>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Teste002Notice>(k: K, v: Teste002Notice[K]) => setN((c) => ({ ...c, [k]: v }));

  const upload = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Envie um arquivo de imagem.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem maior que 5 MB.");
    setUploading(true);
    try {
      const r = await teste002Call<{ url: string }>({ action: "upload_image", token, data_url: await readAsDataUrl(file) });
      set("image_url", r.url);
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar a imagem");
    } finally {
      setUploading(false);
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); void upload(item.getAsFile()); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await teste002Call({ action: "notice_save", token, notice: n });
      toast.success("Aviso salvo");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-primary/40 bg-card p-5" onPaste={onPaste}>
      <h2 className="t2-title text-lg">{n.id ? "Editar aviso" : "Novo aviso"}</h2>
      <div className="space-y-1.5"><Label htmlFor="n-t">Título</Label><Input id="n-t" value={n.title} onChange={(e) => set("title", e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="n-m">Mensagem</Label><Textarea id="n-m" rows={4} value={n.message} onChange={(e) => set("message", e.target.value)} /></div>

      <div className="space-y-1.5">
        <Label htmlFor="n-i">Imagem (cole aqui com Ctrl+V, envie um arquivo ou use um link)</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="n-i" className="min-w-0 flex-1" placeholder="https://..." value={n.image_url} onChange={(e) => set("image_url", e.target.value)} />
          <Button type="button" variant="outline" asChild disabled={uploading}>
            <label className="cursor-pointer gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}Arquivo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
            </label>
          </Button>
        </div>
        {n.image_url ? <img src={n.image_url} alt="Prévia do aviso" className="mt-2 max-h-40 rounded-lg border border-border" /> : null}
      </div>
      <div className="space-y-1.5"><Label htmlFor="n-y">Vídeo do YouTube (opcional)</Label>
        <Input id="n-y" placeholder="https://youtube.com/watch?v=..." value={n.youtube_url} onChange={(e) => set("youtube_url", e.target.value)} /></div>

      <div className="space-y-2">
        <Label>Botões com link (até 3)</Label>
        {n.buttons.map((b, i) => (
          <div key={`btn-${i}`} className="flex flex-wrap gap-2">
            <Input className="w-40" placeholder="Texto" value={b.label} aria-label={`Texto do botão ${i + 1}`}
              onChange={(e) => set("buttons", n.buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input className="min-w-0 flex-1" placeholder="https://..." value={b.url} aria-label={`Link do botão ${i + 1}`}
              onChange={(e) => set("buttons", n.buttons.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
            <Button type="button" size="icon" variant="outline" aria-label="Remover botão" onClick={() => set("buttons", n.buttons.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {n.buttons.length < 3 ? (
          <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => set("buttons", [...n.buttons, { label: "", url: "" }])}><Plus className="h-4 w-4" />Adicionar botão</Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="n-h">Horários diários (São Paulo, separados por vírgula)</Label>
          <Input id="n-h" placeholder="09:00, 14:00, 20:00" value={n.schedule_times.join(", ")}
            onChange={(e) => set("schedule_times", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} /></div>
        <div className="space-y-1.5"><Label htmlFor="n-l">Trava antes de poder fechar (segundos, 0 = sem trava)</Label>
          <Input id="n-l" type="number" min={0} max={120} value={n.lock_seconds} onChange={(e) => set("lock_seconds", Number(e.target.value) || 0)} /></div>
        <div className="space-y-1.5"><Label htmlFor="n-g">Para quem</Label>
          <select id="n-g" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={n.target}
            onChange={(e) => set("target", e.target.value as Teste002Notice["target"])}>
            <option value="all">Todos os testes</option><option value="active">Em teste</option>
            <option value="expired">Teste encerrado</option><option value="not_started">Ainda não cadastrou o Instagram</option>
          </select></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label htmlFor="n-s">Início</Label><Input id="n-s" type="date" value={n.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} /></div>
          <div className="space-y-1.5"><Label htmlFor="n-e">Fim</Label><Input id="n-e" type="date" value={n.end_date ?? ""} onChange={(e) => set("end_date", e.target.value || null)} /></div>
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm"><Switch checked={n.repeat_daily} onCheckedChange={(v) => set("repeat_daily", v)} />Repetir todos os dias em cada horário</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={n.is_active} onCheckedChange={(v) => set("is_active", v)} />Ativo</label>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving} className="font-bold">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar aviso"}</Button>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </section>
  );
};
