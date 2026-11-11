import { costFor, MODEL_PRICES, type ModelInfo, type Provider, type UsageEntry } from "./pricing";

export type MotionFormat = "stories" | "youtube" | "square";
export const FORMATS: Record<MotionFormat, { label: string; w: number; h: number; ratio: string }> = {
  stories: { label: "Stories / Reels 9:16", w: 1080, h: 1920, ratio: "9 / 16" },
  youtube: { label: "YouTube 16:9", w: 1920, h: 1080, ratio: "16 / 9" },
  square: { label: "Feed 1:1", w: 1080, h: 1080, ratio: "1 / 1" },
};

export interface MotionScene { title: string; start: number; duration: number; text: string; camera: string; vfx: string; sfx: string; }
export interface MotionPlan { title: string; concept: string; ideas: string[]; palette: string[]; style: string; script: string; scenes: MotionScene[]; imagePrompt: string; }

export interface AiSettings { provider: Provider; model: string; openaiKey: string; claudeKey: string; customModels?: ModelInfo[]; }

type OnUsage = (e: UsageEntry) => void;

export const MOTION_RULES = `Você é a MRO CREATIVE ENGINE: diretora criativa, motion designer sênior, especialista em cinematic motion graphics, kinetic typography, VFX e sound design.
Nunca crie animações genéricas ou textos simplesmente aparecendo. Cada criação tem: conceito próprio, direção de arte, roteiro, câmera virtual (push in, pull out, dolly zoom, shake, orbit, parallax, whip), tipografia cinética variada (slam, scramble, glitch, mask reveal, split, letter scatter/assembly, 3D flip, blur reveal, chromatic aberration), VFX (glow, bloom, light rays, aurora, partículas, sparks, grid em perspectiva, shockwave, RGB split, film grain, scanlines, vignette, light leaks, HUD), transições elaboradas (flash, blades diagonais, zoom, mask, particle) e sound design sintetizado com Web Audio API (whoosh, impact, boom, riser, glitch, pop, ping, drone, final chord) sincronizado aos impactos.
Escolha cores coerentes com o tema (não use sempre neon azul/roxo). Cada formato tem composição própria; nenhum texto cortado, tudo dentro da área segura (Stories: evitar 12% topo e 18% base).`;

function extractJson(text: string) {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  return JSON.parse(m ? m[1] : text);
}
export function extractHtml(text: string) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  let html = fenced ? fenced[1] : text;
  const start = html.search(/<!doctype html|<html/i);
  if (start > 0) html = html.slice(start);
  const end = html.toLowerCase().lastIndexOf("</html>");
  if (end > 0) html = html.slice(0, end + 7);
  return html.trim();
}

async function callModel(s: AiSettings, system: string, user: string, opts: { maxTokens: number; webSearch?: boolean; kind: string }, onUsage: OnUsage) {
  const provider = MODEL_PRICES[s.model]?.provider ?? s.customModels?.find((m) => m.id === s.model)?.provider ?? s.provider;
  if (provider === "openai") {
    if (!s.openaiKey) throw new Error("Configure o token da OpenAI (ChatGPT).");
    const body: any = { model: s.model, instructions: system, input: user, max_output_tokens: opts.maxTokens };
    if (opts.webSearch) body.tools = [{ type: "web_search" }];
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.openaiKey}` }, body: JSON.stringify(body),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || `OpenAI ${r.status}`);
    const text = (d.output || []).filter((o: any) => o.type === "message").flatMap((o: any) => o.content || []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("\n");
    const searches = (d.output || []).filter((o: any) => o.type === "web_search_call").length;
    const it = d.usage?.input_tokens ?? 0, ot = d.usage?.output_tokens ?? 0;
    onUsage({ id: crypto.randomUUID(), at: Date.now(), provider, model: s.model, kind: opts.kind, inputTokens: it, outputTokens: ot, images: 0, searches, costUsd: costFor(s.model, it, ot, 0, searches) });
    return text;
  }
  if (!s.claudeKey) throw new Error("Configure o token da Claude (Anthropic).");
  const body: any = { model: s.model, max_tokens: opts.maxTokens, system, messages: [{ role: "user", content: user }] };
  if (opts.webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": s.claudeKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(r.status === 404 ? `Modelo "${s.model}" não existe na sua conta Anthropic. Clique em "Buscar modelos da minha conta" em Tokens e escolha um da lista.` : d?.error?.message || `Claude ${r.status}`);
  const text = (d.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  const searches = d.usage?.server_tool_use?.web_search_requests ?? 0;
  const it = d.usage?.input_tokens ?? 0, ot = d.usage?.output_tokens ?? 0;
  onUsage({ id: crypto.randomUUID(), at: Date.now(), provider, model: s.model, kind: opts.kind, inputTokens: it, outputTokens: ot, images: 0, searches, costUsd: costFor(s.model, it, ot, 0, searches) });
  return text;
}

export type MotionPlanStage = "ideas" | "script" | "scenes";
export type MotionPlanProgress = (stage: MotionPlanStage, status: "start" | "done") => void;

export async function generatePlan(
  s: AiSettings,
  prompt: string,
  format: MotionFormat,
  seconds: number,
  webSearch: boolean,
  onUsage: OnUsage,
  onProgress: MotionPlanProgress = () => {},
): Promise<MotionPlan> {
  const f = FORMATS[format];
  const request = `Pedido do cliente: """${prompt}"""
Formato: ${f.label} (${f.w}x${f.h}). Duração total EXATA: ${seconds} segundos.`;

  onProgress("ideas", "start");
  const ideasText = await callModel(s, MOTION_RULES, `${request}
${webSearch ? "Pesquise na internet referências, dados e tendências atuais sobre o tema antes de criar." : ""}
Primeira etapa: crie SOMENTE as ideias e a direção criativa. Ainda não escreva roteiro nem cenas.
Responda SOMENTE com JSON:
{"title":"","concept":"","ideas":["3 a 5 ideias criativas"],"palette":["#hex"...4-6],"style":"linguagem visual (ex: Quantum Molten + Glitch)","imagePrompt":"prompt em inglês para imagem de fundo cinematográfica, sem textos"}`, { maxTokens: 3500, webSearch, kind: "Ideias" }, onUsage);
  const direction = extractJson(ideasText);
  onProgress("ideas", "done");

  onProgress("script", "start");
  const scriptText = await callModel(s, MOTION_RULES, `${request}

Direção criativa aprovada:
${JSON.stringify(direction, null, 2)}

Segunda etapa: escreva o roteiro/narração completo, mantendo exatamente essa direção criativa. Ainda não detalhe as cenas.
Responda SOMENTE com JSON: {"script":"roteiro/narração completo"}`, { maxTokens: 5000, kind: "Roteiro" }, onUsage);
  const { script } = extractJson(scriptText);
  onProgress("script", "done");

  onProgress("scenes", "start");
  const scenesText = await callModel(s, MOTION_RULES, `${request}

Direção criativa e roteiro aprovados:
${JSON.stringify({ ...direction, script }, null, 2)}

Terceira etapa: transforme o roteiro em cenas cinematográficas detalhadas, preservando ideias, estilo e narração.
Responda SOMENTE com JSON:
{"scenes":[{"title":"","start":0,"duration":0,"text":"texto em tela","camera":"","vfx":"","sfx":""}]}
As durações das cenas devem somar EXATAMENTE ${seconds}s, sem lacunas na timeline.`, { maxTokens: 7000, kind: "Cenas" }, onUsage);
  const { scenes } = extractJson(scenesText);
  onProgress("scenes", "done");

  return { ...direction, script, scenes };
}

async function referenceExcerpt(format: MotionFormat) {
  const file = format === "stories" ? "/motion-demos/quantum-stories.html" : "/motion-demos/quantum-molten.html";
  try { return (await (await fetch(file)).text()).slice(0, 14000); } catch { return ""; }
}

const HTML_CONTRACT = (format: MotionFormat, seconds: number, hasBg: boolean) => {
  const f = FORMATS[format];
  return `Regras técnicas obrigatórias do arquivo:
- Um único arquivo HTML completo (HTML+CSS+JS inline), sem bibliotecas externas (fontes do Google permitidas).
- Palco fixo de ${f.w}x${f.h} escalado com transform para caber em qualquer viewport (letterbox preto), sem barras de rolagem.
- Timeline de EXATAMENTE ${seconds}s, iniciada automaticamente ao carregar, controlada por requestAnimationFrame com tempo real (performance.now) e ao final reinicia em loop.
- Exponha window.MOTION = { duration: ${seconds}, restart(), seek(t) }.
- Sons sintetizados via Web Audio API sincronizados às cenas; tente iniciar o AudioContext automaticamente e também no primeiro clique. Pequeno botão de som no canto (ocultável com ?clean=1).
- Canvas para partículas, camadas de luz, grain, vignette; mínimo de 6 técnicas de VFX e 4 movimentos de câmera diferentes.
${hasBg ? `- Use a imagem de fundo pela URL literal "{{BG_IMAGE}}" (ela será substituída) com parallax/Ken Burns e overlays.` : ""}
Responda SOMENTE com o código dentro de \`\`\`html.`;
};

export async function generateHtml(s: AiSettings, plan: MotionPlan, format: MotionFormat, seconds: number, hasBg: boolean, onUsage: OnUsage) {
  const ref = await referenceExcerpt(format);
  const user = `Direção criativa aprovada:\n${JSON.stringify(plan, null, 2)}\n\n${HTML_CONTRACT(format, seconds, hasBg)}\n\nTrecho de referência do padrão MRO (aprenda o nível de acabamento, não copie o texto):\n${ref}`;
  return extractHtml(await callModel(s, MOTION_RULES, user, { maxTokens: 20000, kind: "Motion HTML" }, onUsage));
}

export async function editHtml(s: AiSettings, html: string, instruction: string, format: MotionFormat, seconds: number, onUsage: OnUsage) {
  const user = `Edite este motion conforme o pedido: """${instruction}"""\nMantenha tudo que não foi pedido para mudar.\n${HTML_CONTRACT(format, seconds, html.includes("{{BG_IMAGE}}"))}\n\nCódigo atual:\n\`\`\`html\n${html}\n\`\`\``;
  return extractHtml(await callModel(s, MOTION_RULES, user, { maxTokens: 20000, kind: "Edição" }, onUsage));
}

async function dataUrlToBlob(u: string) { return (await fetch(u)).blob(); }

const IMAGE_MODELS = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini", "dall-e-3"];
let workingImageModel: string | null = null;

export async function generateBackground(s: AiSettings, prompt: string, format: MotionFormat, facePhoto: string | null, onUsage: OnUsage) {
  if (!s.openaiKey) throw new Error("Imagens são geradas pela OpenAI: configure o token do ChatGPT (a Claude não gera imagens).");
  const full = `${prompt}. Cinematic, high detail, dramatic lighting, no text, no letters, no logos.`;
  const order = workingImageModel ? [workingImageModel, ...IMAGE_MODELS.filter((m) => m !== workingImageModel)] : IMAGE_MODELS;
  let lastErr = "";
  for (const model of order) {
    const dalle = model === "dall-e-3";
    if (dalle && facePhoto) continue; // dall-e-3 cannot use a reference photo
    const size = dalle ? (format === "stories" ? "1024x1792" : format === "youtube" ? "1792x1024" : "1024x1024")
      : (format === "stories" ? "1024x1536" : format === "youtube" ? "1536x1024" : "1024x1024");
    let r: Response;
    if (facePhoto) {
      const fd = new FormData();
      fd.append("model", model);
      fd.append("prompt", `${full} Feature the person from the reference photo, keeping their face identity, as the protagonist.`);
      fd.append("size", size);
      fd.append("image", await dataUrlToBlob(facePhoto), "face.png");
      r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${s.openaiKey}` }, body: fd });
    } else {
      const body: any = dalle ? { model, prompt: full, size, response_format: "b64_json", n: 1 } : { model, prompt: full, size, quality: "medium" };
      r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.openaiKey}` }, body: JSON.stringify(body),
      });
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      lastErr = d?.error?.message || `Imagem ${r.status}`;
      // model missing / not allowed for this account / org not verified → try the next one
      if ([400, 403, 404].includes(r.status) && /model|exist|access|verif|support|permission/i.test(lastErr)) continue;
      throw new Error(lastErr);
    }
    const b64 = d?.data?.[0]?.b64_json;
    const url = d?.data?.[0]?.url;
    if (!b64 && !url) { lastErr = "A OpenAI não retornou imagem."; continue; }
    workingImageModel = model;
    const it = d.usage?.input_tokens ?? 0, ot = d.usage?.output_tokens ?? 0;
    onUsage({ id: crypto.randomUUID(), at: Date.now(), provider: "openai", model, kind: facePhoto ? "Imagem com rosto" : "Imagem de fundo", inputTokens: it, outputTokens: ot, images: 1, searches: 0, costUsd: costFor(model, 0, 0, 1) });
    return b64 ? `data:image/png;base64,${b64}` : url;
  }
  throw new Error(`Sua conta OpenAI não liberou nenhum modelo de imagem${facePhoto ? " com foto de referência" : ""}. Último erro: ${lastErr}`);
}

export function renderHtml(html: string, bg?: string | null) {
  return bg ? html.split("{{BG_IMAGE}}").join(bg) : html;
}

/** Lists the models actually available to the user's keys (e.g. newest Opus versions). */
export async function fetchAccountModels(s: AiSettings): Promise<ModelInfo[]> {
  const out: ModelInfo[] = [];
  const errors: string[] = [];
  if (s.claudeKey) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": s.claudeKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `Claude ${r.status}`);
      for (const m of d.data || []) out.push({ id: m.id, provider: "claude", label: m.display_name || m.id });
    } catch (e: any) { errors.push(`Claude: ${e.message}`); }
  }
  if (s.openaiKey) {
    try {
      const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${s.openaiKey}` } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error?.message || `OpenAI ${r.status}`);
      for (const m of d.data || []) if (/^(gpt|o\d|chatgpt)/i.test(m.id) && !/(audio|realtime|tts|transcribe|image|embedding|search)/i.test(m.id)) out.push({ id: m.id, provider: "openai", label: m.id });
    } catch (e: any) { errors.push(`OpenAI: ${e.message}`); }
  }
  if (!out.length) throw new Error(errors.join(" · ") || "Configure pelo menos um token.");
  return out;
}
