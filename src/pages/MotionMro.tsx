import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Clapperboard, Download, Film, KeyRound, Loader2, Pencil, RefreshCw, Sparkles, Trash2, Upload, Calculator, Image as ImageIcon, Globe, Play, Maximize2 } from "lucide-react";
import { kvGet, kvSet, kvClear } from "@/lib/motion/store";
import { MODEL_PRICES, summarizeUsage, type UsageEntry } from "@/lib/motion/pricing";
import { FORMATS, generatePlan, generateHtml, editHtml, generateBackground, fetchAccountModels, renderHtml, type AiSettings, type MotionFormat, type MotionPlan } from "@/lib/motion/ai";
import { completeGenerationStep, createGenerationSteps, generationPercent, type GenerationStageId, type GenerationStep } from "@/lib/motion/generationProgress";
import { recordElement, download } from "@/lib/motion/recorder";

interface SavedMotion { id: string; createdAt: number; prompt: string; format: MotionFormat; seconds: number; plan: MotionPlan; html: string; bg: string | null; history: string[]; }

const DEMOS = [
  { file: "quantum-stories.html", title: "Quantum Stories 7.1", format: "stories" as MotionFormat },
  { file: "neon-kinetic.html", title: "Neon Kinetic 6.1", format: "stories" as MotionFormat },
  { file: "quantum-molten.html", title: "Quantum Molten 7.0", format: "youtube" as MotionFormat },
  { file: "cinematic-42.html", title: "Cinematic Motion 4.2", format: "youtube" as MotionFormat },
  { file: "cinematic-44.html", title: "Cinematic Motion 4.4 SFX", format: "youtube" as MotionFormat },
  { file: "aurora-cut.html", title: "Aurora Cut 5.1", format: "youtube" as MotionFormat },
];

const DEFAULT_SETTINGS: AiSettings = { provider: "claude", model: "claude-sonnet-4-5", openaiKey: "", claudeKey: "" };

export default function MotionMro() {
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
  const [motions, setMotions] = useState<SavedMotion[]>([]);
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [usdBrl, setUsdBrl] = useState(5.4);
  const [loaded, setLoaded] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<MotionFormat>("stories");
  const [seconds, setSeconds] = useState(20);
  const [webSearch, setWebSearch] = useState(true);
  const [withImage, setWithImage] = useState(false);
  const [useFace, setUseFace] = useState(false);
  const [face, setFace] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [demo, setDemo] = useState<(typeof DEMOS)[number] | null>(DEMOS[0]);
  const [editText, setEditText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [recording, setRecording] = useState<{ left: number } | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setSettings(await kvGet("settings", DEFAULT_SETTINGS));
      setMotions(await kvGet("motions", []));
      setUsage(await kvGet("usage", []));
      setUsdBrl(await kvGet("usdBrl", 5.4));
      setFace(await kvGet("face", null));
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) kvSet("settings", settings); }, [settings, loaded]);
  useEffect(() => { if (loaded) kvSet("motions", motions).catch(() => toast.error("Armazenamento do navegador cheio: apague alguns motions.")); }, [motions, loaded]);
  useEffect(() => { if (loaded) kvSet("usage", usage); }, [usage, loaded]);
  useEffect(() => { if (loaded) kvSet("usdBrl", usdBrl); }, [usdBrl, loaded]);
  useEffect(() => { if (loaded) kvSet("face", face); }, [face, loaded]);

  const onUsage = (e: UsageEntry) => setUsage((u) => [e, ...u]);
  const current = motions.find((m) => m.id === currentId) || null;
  const totals = useMemo(() => summarizeUsage(usage), [usage]);
  const previewFormat = current ? current.format : demo?.format ?? format;
  const srcDoc = current ? renderHtml(current.html, current.bg) : undefined;
  const src = !current && demo ? `/motion-demos/${demo.file}` : undefined;

  const allModels = useMemo(() => {
    const map = new Map<string, { provider: "openai" | "claude"; label: string }>();
    Object.entries(MODEL_PRICES).forEach(([id, p]) => map.set(id, { provider: p.provider, label: p.label }));
    (settings.customModels || []).forEach((m) => map.set(m.id, { provider: m.provider, label: m.label }));
    if (settings.model && !map.has(settings.model)) map.set(settings.model, { provider: settings.provider, label: settings.model });
    return Array.from(map.entries());
  }, [settings.customModels, settings.model, settings.provider]);
  const providerModels = allModels.filter(([, p]) => p.provider === settings.provider);
  const [customId, setCustomId] = useState("");
  const loadModels = () => run("Buscando modelos da sua conta…", async () => {
    const list = await fetchAccountModels(settings);
    setSettings((s) => ({ ...s, customModels: list }));
    toast.success(`${list.length} modelos encontrados.`);
  });

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try { await fn(); } catch (e: any) { toast.error(e?.message || "Falha na geração"); } finally { setBusy(null); }
  }

  const generate = (basePrompt = prompt) => run("Criando ideias e direção criativa…", async () => {
    setGenerationSteps(createGenerationSteps(withImage));
    const finishStage = (id: GenerationStageId) => setGenerationSteps((steps) => steps ? completeGenerationStep(steps, id) : steps);
    try {
      if (!basePrompt.trim()) throw new Error("Descreva a ideia do motion.");
      const plan = await generatePlan(settings, basePrompt, format, seconds, webSearch, onUsage, (stage, status) => {
        if (status === "done") finishStage(stage);
        else setBusy(stage === "ideas" ? "Criando ideias e direção criativa…" : stage === "script" ? "Escrevendo o roteiro…" : "Criando as cenas…");
      });
      let bg: string | null = null;
      if (withImage) {
        setBusy("Gerando a imagem de fundo…");
        try { bg = await generateBackground(settings, plan.imagePrompt || basePrompt, format, useFace ? face : null, onUsage); }
        catch (e: any) { toast.warning(`Imagem de fundo não gerada (o motion continua sem ela): ${e?.message || e}`); }
        finally { finishStage("image"); }
      }
      setBusy("Animando cenas, câmera, efeitos e sons…");
      const html = await generateHtml(settings, plan, format, seconds, !!bg, onUsage);
      finishStage("animation");
      const m: SavedMotion = { id: crypto.randomUUID(), createdAt: Date.now(), prompt: basePrompt, format, seconds, plan, html, bg, history: [] };
      setMotions((list) => [m, ...list]);
      setCurrentId(m.id); setDemo(null); setFrameKey((k) => k + 1);
      toast.success("Motion gerado! Confira a prévia.");
    } finally {
      setGenerationSteps(null);
    }
  });

  const applyEdit = () => current && run("Aplicando sua edição…", async () => {
    if (!editText.trim()) throw new Error("Escreva o que deseja mudar.");
    const html = await editHtml(settings, current.html, editText, current.format, current.seconds, onUsage);
    setMotions((list) => list.map((m) => m.id === current.id ? { ...m, html, history: [m.html, ...m.history].slice(0, 5) } : m));
    setEditOpen(false); setEditText(""); setFrameKey((k) => k + 1);
  });

  const regenerateImage = () => current && run("Gerando nova imagem de fundo…", async () => {
    const bg = await generateBackground(settings, current.plan.imagePrompt || current.prompt, current.format, useFace ? face : null, onUsage);
    let html = current.html;
    if (!html.includes("{{BG_IMAGE}}")) html = await editHtml(settings, html, "Adicione a imagem de fundo {{BG_IMAGE}} em tela cheia com parallax e overlays escuros para legibilidade.", current.format, current.seconds, onUsage);
    setMotions((list) => list.map((m) => m.id === current.id ? { ...m, bg, html } : m));
    setFrameKey((k) => k + 1);
  });

  const undo = () => current?.history.length && setMotions((l) => l.map((m) => m.id === current.id ? { ...m, html: m.history[0], history: m.history.slice(1) } : m));

  async function exportMp4() {
    const el = stageRef.current; if (!el) return;
    const secs = current?.seconds ?? seconds;
    try {
      toast.info("Escolha 'Esta aba' e permita compartilhar áudio para gravar o som.");
      const { blob, ext } = await recordElement(el, secs, () => { setFrameKey((k) => k + 1); }, (i) => setRecording({ left: secs - i }));
      setRecording(null);
      download(blob, `${slug(current?.plan.title || demo?.title || "motion")}-${secs}s.${ext}`);
      if (ext !== "mp4") toast.message("Seu navegador gravou em WebM. Use o Chrome atualizado para MP4.");
    } catch (e: any) { setRecording(null); toast.error(e?.message || "Gravação cancelada"); }
  }

  async function exportHtml() {
    if (current) return download(renderHtml(current.html, current.bg), `${slug(current.plan.title)}.html`);
    if (demo) download(await (await fetch(`/motion-demos/${demo.file}`)).text(), demo.file);
  }

  function onFace(file?: File) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { setFace(r.result as string); setUseFace(true); };
    r.readAsDataURL(file);
  }

  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const money = (usd: number) => `US$ ${usd.toFixed(4)} · R$ ${(usd * usdBrl).toFixed(2)}`;

  return (
    <div className="motionmro min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-black tracking-tight">MOTION <span className="text-primary">MRO</span></h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">Motions cinematográficos com IA</span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" /> {fmt(totals.inputTokens + totals.outputTokens)} tokens · <b className="text-primary">R$ {(totals.costUsd * usdBrl).toFixed(2)}</b> investidos
        </div>
      </header>

      <main className="grid lg:grid-cols-[420px_1fr] gap-4 p-4">
        <section className="space-y-4 min-w-0">
          <Tabs defaultValue="create">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="create"><Sparkles className="h-4 w-4 mr-1" />Criar</TabsTrigger>
              <TabsTrigger value="keys"><KeyRound className="h-4 w-4 mr-1" />APIs</TabsTrigger>
              <TabsTrigger value="costs"><Calculator className="h-4 w-4 mr-1" />Custos</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="space-y-2">
                <Label>Sua ideia / prompt</Label>
                <Textarea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex.: Motion de lançamento da MRO Inteligente, mostrando automação de Instagram, gráficos de crescimento e CTA final 'Teste agora'." />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FORMATS) as MotionFormat[]).map((f) => (
                  <button key={f} onClick={() => setFormat(f)} className={`rounded-lg border p-2 text-xs font-semibold transition ${format === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{FORMATS[f].label}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Duração (segundos)</Label>
                  <Input type="number" min={5} max={180} value={seconds} onChange={(e) => setSeconds(Math.max(5, Math.min(180, Number(e.target.value) || 5)))} />
                </div>
                <div className="space-y-1">
                  <Label>IA</Label>
                  <Select value={settings.model} onValueChange={(model) => setSettings((s) => ({ ...s, model, provider: allModels.find(([id]) => id === model)?.[1].provider ?? s.provider }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{allModels.map(([id, p]) => <SelectItem key={id} value={id}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Toggle icon={<Globe className="h-4 w-4" />} label="Pesquisar na internet" checked={webSearch} onChange={setWebSearch} />
              <Toggle icon={<ImageIcon className="h-4 w-4" />} label="Gerar imagem de fundo (OpenAI)" checked={withImage} onChange={setWithImage} />
              {withImage && (
                <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                  <Toggle label="Usar minha foto (rosto)" checked={useFace && !!face} onChange={(v) => setUseFace(v)} />
                  <div className="flex items-center gap-3">
                    {face && <img src={face} alt="Sua foto" className="h-14 w-14 rounded-full object-cover border border-primary" />}
                    <label className="text-xs cursor-pointer inline-flex items-center gap-1 text-primary"><Upload className="h-4 w-4" />{face ? "Trocar foto" : "Enviar foto"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => onFace(e.target.files?.[0])} /></label>
                    {face && <button className="text-xs text-muted-foreground" onClick={() => { setFace(null); setUseFace(false); }}>remover</button>}
                  </div>
                </div>
              )}
              <Button className="w-full font-bold" size="lg" disabled={!!busy} onClick={() => generate()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}{busy || "Gerar motion"}
              </Button>
            </TabsContent>

            <TabsContent value="keys" className="space-y-4 rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Os tokens ficam salvos somente neste navegador. Nada é enviado para nosso servidor.</p>
              <div className="space-y-1"><Label>Token OpenAI (ChatGPT + imagens)</Label><Input type="password" value={settings.openaiKey} onChange={(e) => setSettings((s) => ({ ...s, openaiKey: e.target.value.trim() }))} placeholder="sk-..." /></div>
              <div className="space-y-1"><Label>Token Claude (Anthropic)</Label><Input type="password" value={settings.claudeKey} onChange={(e) => setSettings((s) => ({ ...s, claudeKey: e.target.value.trim() }))} placeholder="sk-ant-..." /></div>
              <div className="space-y-1">
                <Label>IA padrão</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["openai", "claude"] as const).map((p) => (
                    <Button key={p} variant={settings.provider === p ? "default" : "outline"} onClick={() => setSettings((s) => ({ ...s, provider: p, model: p === "openai" ? "gpt-5" : "claude-sonnet-4-5" }))}>{p === "openai" ? "ChatGPT" : "Claude"}</Button>
                  ))}
                </div>
                <Select value={settings.model} onValueChange={(model) => setSettings((s) => ({ ...s, model }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{providerModels.map(([id, p]) => <SelectItem key={id} value={id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="secondary" className="w-full" disabled={!!busy} onClick={loadModels}>Buscar modelos da minha conta (Opus, Sonnet, GPT…)</Button>
                <div className="flex gap-2">
                  <Input value={customId} onChange={(e) => setCustomId(e.target.value.trim())} placeholder="ou digite o ID exato do modelo" />
                  <Button variant="outline" disabled={!customId} onClick={() => { const provider = customId.toLowerCase().startsWith("claude") ? "claude" as const : "openai" as const; setSettings((s) => ({ ...s, provider, model: customId, customModels: [...(s.customModels || []).filter((m) => m.id !== customId), { id: customId, provider, label: customId }] })); setCustomId(""); }}>Usar</Button>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={async () => { if (confirm("Apagar tokens, motions e custos deste navegador?")) { await kvClear(); location.reload(); } }}><Trash2 className="h-4 w-4 mr-2" />Apagar tudo do navegador</Button>
            </TabsContent>

            <TabsContent value="costs" className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Tokens entrada" value={fmt(totals.inputTokens)} />
                <Stat label="Tokens saída" value={fmt(totals.outputTokens)} />
                <Stat label="Imagens" value={fmt(totals.images)} />
                <Stat label="Chamadas" value={fmt(totals.calls)} />
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/40 p-3">
                <div className="text-xs text-muted-foreground">Total investido em IA (estimado)</div>
                <div className="text-2xl font-black text-primary">R$ {(totals.costUsd * usdBrl).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">US$ {totals.costUsd.toFixed(4)}</div>
              </div>
              <div className="flex items-center gap-2"><Label className="whitespace-nowrap">Dólar (R$)</Label><Input type="number" step="0.01" value={usdBrl} onChange={(e) => setUsdBrl(Number(e.target.value) || 0)} /></div>
              <div className="max-h-72 overflow-auto space-y-1 text-xs">
                {usage.map((u) => (
                  <div key={u.id} className="flex justify-between gap-2 border-b border-border py-1">
                    <span className="truncate">{new Date(u.at).toLocaleString("pt-BR")} · {u.kind} · {allModels.find(([id]) => id === u.model)?.[1].label || u.model}</span>
                    <span className="whitespace-nowrap text-muted-foreground">{fmt(u.inputTokens + u.outputTokens)} tk · {money(u.costUsd)}</span>
                  </div>
                ))}
                {!usage.length && <p className="text-muted-foreground">Nenhum uso ainda.</p>}
              </div>
              {usage.length > 0 && <Button variant="outline" size="sm" onClick={() => confirm("Zerar histórico de custos?") && setUsage([])}>Zerar custos</Button>}
              <p className="text-[11px] text-muted-foreground">Valores estimados com base nas tabelas públicas por milhão de tokens; confira a fatura oficial do provedor.</p>
            </TabsContent>
          </Tabs>

          {current && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
              <h3 className="font-bold text-primary">{current.plan.title}</h3>
              <p className="text-muted-foreground">{current.plan.concept}</p>
              <div className="flex gap-1">{current.plan.palette?.map((c) => <span key={c} className="h-5 w-5 rounded" style={{ background: c }} title={c} />)}</div>
              <p className="text-xs"><b>Estilo:</b> {current.plan.style}</p>
              {current.plan.ideas?.length > 0 && <ul className="list-disc pl-4 text-xs text-muted-foreground">{current.plan.ideas.map((i) => <li key={i}>{i}</li>)}</ul>}
              <details><summary className="cursor-pointer text-xs font-semibold">Roteiro</summary><p className="text-xs whitespace-pre-wrap mt-1 text-muted-foreground">{current.plan.script}</p></details>
              <details open><summary className="cursor-pointer text-xs font-semibold">Cenas ({current.plan.scenes?.length})</summary>
                <div className="space-y-1 mt-1">{current.plan.scenes?.map((s, i) => (
                  <div key={i} className="rounded border border-border p-2 text-xs"><b>{s.start}s · {s.title}</b> ({s.duration}s)<div>“{s.text}”</div><div className="text-muted-foreground">🎥 {s.camera} · ✨ {s.vfx} · 🔊 {s.sfx}</div></div>
                ))}</div>
              </details>
            </div>
          )}
        </section>

        <section className="space-y-4 min-w-0">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm font-bold mr-auto flex items-center gap-2"><Play className="h-4 w-4 text-primary" />Prévia {current ? `· ${current.seconds}s` : demo ? `· demonstração ${demo.title}` : ""}</span>
              <Button size="sm" variant="outline" onClick={() => setFrameKey((k) => k + 1)}><RefreshCw className="h-4 w-4 mr-1" />Reiniciar</Button>
              {current && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>}
              {current && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => { setFormat(current.format); setSeconds(current.seconds); generate(current.prompt); }}><Sparkles className="h-4 w-4 mr-1" />Gerar outro</Button>}
              {current && <Button size="sm" variant="outline" disabled={!!busy} onClick={regenerateImage}><ImageIcon className="h-4 w-4 mr-1" />Nova imagem</Button>}
              {current && current.history.length > 0 && <Button size="sm" variant="ghost" onClick={undo}>Desfazer</Button>}
              <Button size="sm" variant="outline" onClick={exportHtml}><Download className="h-4 w-4 mr-1" />HTML</Button>
              <Button size="sm" disabled={!!busy || !!recording} onClick={exportMp4}><Film className="h-4 w-4 mr-1" />{recording ? `Gravando ${recording.left}s` : "Gerar MP4"}</Button>
            </div>
            <div className="flex justify-center bg-background rounded-lg p-2">
              <div ref={stageRef} className="relative overflow-hidden rounded-md bg-background" style={{ aspectRatio: FORMATS[previewFormat].ratio, width: `min(100%, calc(78vh * ${FORMATS[previewFormat].w} / ${FORMATS[previewFormat].h}))` }}>
                {busy && !recording && <div className="absolute inset-0 z-10 grid place-items-center bg-background/80 text-sm"><div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />{busy}<div className="text-xs text-muted-foreground mt-1">Pode levar de 1 a 3 minutos</div></div></div>}
                {(srcDoc || src) && <iframe key={`${currentId || demo?.file}-${frameKey}`} title="Prévia do motion" className="absolute inset-0 h-full w-full border-0" srcDoc={srcDoc} src={src} sandbox="allow-scripts" allow="autoplay" />}
              </div>
            </div>
            {recording && <p className="text-xs text-center text-primary mt-2">Gravando… não mude de aba nem role a página.</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-bold mb-3">Meus motions ({motions.length}) <span className="text-xs font-normal text-muted-foreground">salvos só neste navegador</span></h2>
            {!motions.length && <p className="text-sm text-muted-foreground">Seus motions gerados aparecem aqui.</p>}
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {motions.map((m) => (
                <div key={m.id} className={`rounded-lg border p-3 text-sm ${m.id === currentId ? "border-primary" : "border-border"}`}>
                  <button className="text-left w-full" onClick={() => { setCurrentId(m.id); setDemo(null); }}>
                    <div className="font-semibold truncate">{m.plan.title}</div>
                    <div className="text-xs text-muted-foreground">{FORMATS[m.format].label} · {m.seconds}s · {new Date(m.createdAt).toLocaleDateString("pt-BR")}</div>
                  </button>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="ghost" onClick={() => download(renderHtml(m.html, m.bg), `${slug(m.plan.title)}.html`)}><Download className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Apagar este motion?")) { setMotions((l) => l.filter((x) => x.id !== m.id)); if (currentId === m.id) setCurrentId(null); } }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-bold mb-3">Demonstrações MRO <span className="text-xs font-normal text-muted-foreground">referências de aprendizado da IA</span></h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEMOS.map((d) => (
                <button key={d.file} onClick={() => { setDemo(d); setCurrentId(null); setFrameKey((k) => k + 1); }} className={`rounded-lg border p-3 text-left text-sm transition ${!current && demo?.file === d.file ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"}`}>
                  <div className="font-semibold flex items-center gap-1"><Maximize2 className="h-3 w-3 text-primary" />{d.title}</div>
                  <div className="text-xs text-muted-foreground">{FORMATS[d.format].label}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Dialog open={editOpen} onOpenChange={(o) => !busy && setEditOpen(o)}>
        <DialogContent className="motionmro max-w-lg">
          <DialogHeader><DialogTitle>Editar motion</DialogTitle></DialogHeader>
          <Textarea rows={5} value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="Ex.: troque as cores para dourado, deixe o título maior e adicione uma explosão de partículas no CTA final." />
          <Button disabled={!!busy} onClick={applyEdit}>{busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}{busy || "Aplicar edição"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Toggle({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return <label className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2">{icon}{label}</span><Switch checked={checked} onCheckedChange={onChange} /></label>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border p-2"><div className="text-[11px] text-muted-foreground">{label}</div><div className="font-bold">{value}</div></div>;
}
function slug(s: string) { return (s || "motion").normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 50) || "motion"; }
