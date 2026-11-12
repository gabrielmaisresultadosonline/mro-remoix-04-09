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

function repairJson(src: string): string {
  // Escape raw control chars inside strings, drop trailing commas, close truncated structures.
  let out = "", inStr = false, esc = false;
  const stack: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { out += c; esc = false; continue; }
      if (c === "\\") { out += c; esc = true; continue; }
      if (c === '"') {
        // A quote is a real terminator only if followed by a JSON delimiter.
        const rest = src.slice(i + 1).match(/^\s*(.)/);
        const nx = rest ? rest[1] : "";
        if (!nx || ",:}]".includes(nx)) { inStr = false; out += c; } else out += '\\"';
        continue;
      }
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
      out += c; continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") stack.pop();
    out += c;
  }
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "");
  while (stack.length) out += stack.pop();
  return out.replace(/,(\s*[}\]])/g, "$1");
}
function extractJson(text: string) {
  const m = text.match(/```json\s*([\s\S]*?)(```|$)/) || text.match(/(\{[\s\S]*\}?)/);
  const raw = (m ? m[1] : text).trim();
  try { return JSON.parse(raw); } catch {
    try { return JSON.parse(repairJson(raw)); } catch {
      throw new Error("A IA devolveu um roteiro com formato inválido. Clique em gerar novamente.");
    }
  }
}
export function extractHtml(text: string) {
  const fenced = text.match(/```html\s*([\s\S]*?)```/i);
  let html = fenced ? fenced[1] : text;
  const start = html.search(/<!doctype html|<html/i);
  if (start > 0) html = html.slice(start);
  html = html.replace(/^```html\s*/i, "").replace(/```\s*$/, "");
  const end = html.toLowerCase().lastIndexOf("</html>");
  if (end > 0) html = html.slice(0, end + 7);
  return html.trim();
}

export type MotionLogEvent = { at: number; kind: string; message: string; chars?: number; tokens?: number };
let motionLogger: ((e: MotionLogEvent) => void) | null = null;
let motionAbort: AbortController | null = null;
export function setMotionLogger(fn: ((e: MotionLogEvent) => void) | null) { motionLogger = fn; }
export function cancelMotionGeneration() { motionAbort?.abort(new DOMException("Cancelado por você.", "AbortError")); }
const log = (kind: string, message: string, extra: Partial<MotionLogEvent> = {}) => motionLogger?.({ at: Date.now(), kind, message, ...extra });
const IDLE_MS = 120000;

async function* sse(r: Response, signal: AbortSignal, onIdle: () => void) {
  const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = "";
  let timer = setTimeout(onIdle, IDLE_MS);
  try {
    while (true) {
      const { value, done } = await reader.read();
      clearTimeout(timer); if (done) break; if (signal.aborted) break;
      timer = setTimeout(onIdle, IDLE_MS);
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
        if (!data || data === "[DONE]") continue;
        try { yield JSON.parse(data); } catch { /* ignore */ }
      }
    }
  } finally { clearTimeout(timer); }
}

async function callModel(s: AiSettings, system: string, user: string, opts: { maxTokens: number; webSearch?: boolean; kind: string; prefill?: string }, onUsage: OnUsage) {
  const provider = MODEL_PRICES[s.model]?.provider ?? s.customModels?.find((m) => m.id === s.model)?.provider ?? s.provider;
  const ctrl = new AbortController(); motionAbort = ctrl;
  let idle = false;
  const onIdle = () => { idle = true; log(opts.kind, "Sem resposta da IA há 2 minutos — cancelando para não travar."); ctrl.abort(); };
  const t0 = Date.now(); let text = ""; let lastLog = 0;
  const progress = () => { const now = Date.now(); if (now - lastLog > 1500) { lastLog = now; log(opts.kind, `Recebendo… ${text.length.toLocaleString("pt-BR")} caracteres (${Math.round((now - t0) / 1000)}s)`, { chars: text.length, tokens: Math.round(text.length / 3.5) }); } };
  log(opts.kind, `Enviando pedido para ${s.model}${opts.prefill ? " (continuação)" : ""}…`);
  try {
    if (provider === "openai") {
      if (!s.openaiKey) throw new Error("Configure o token da OpenAI (ChatGPT).");
      const body: any = { model: s.model, instructions: system, stream: true, input: opts.prefill ? [{ role: "user", content: user }, { role: "assistant", content: opts.prefill }, { role: "user", content: "Continue EXATAMENTE de onde parou, sem repetir nada e sem explicações, até fechar </html>." }] : user, max_output_tokens: opts.maxTokens };
      if (opts.webSearch) body.tools = [{ type: "web_search" }];
      const r = await fetch("https://api.openai.com/v1/responses", { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.openaiKey}` }, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d?.error?.message || `OpenAI ${r.status}`); }
      log(opts.kind, "Conectado. A IA está pensando…");
      let it = 0, ot = 0, searches = 0;
      for await (const ev of sse(r, ctrl.signal, onIdle)) {
        if (ev.type === "response.output_text.delta") { text += ev.delta || ""; progress(); }
        else if (ev.type === "response.web_search_call.searching") log(opts.kind, "Pesquisando na internet…");
        else if (ev.type === "response.reasoning_summary_text.delta" || ev.type === "response.in_progress") progress();
        else if (ev.type === "response.completed" || ev.type === "response.incomplete") { it = ev.response?.usage?.input_tokens ?? 0; ot = ev.response?.usage?.output_tokens ?? 0; searches = (ev.response?.output || []).filter((o: any) => o.type === "web_search_call").length; }
        else if (ev.type === "error" || ev.type === "response.failed") throw new Error(ev.error?.message || ev.response?.error?.message || "Falha na OpenAI");
      }
      onUsage({ id: crypto.randomUUID(), at: Date.now(), provider, model: s.model, kind: opts.kind, inputTokens: it, outputTokens: ot, images: 0, searches, costUsd: costFor(s.model, it, ot, 0, searches) });
    } else {
      if (!s.claudeKey) throw new Error("Configure o token da Claude (Anthropic).");
      const body: any = { model: s.model, max_tokens: opts.maxTokens, stream: true, system, messages: opts.prefill ? [{ role: "user", content: user }, { role: "assistant", content: opts.prefill.trimEnd() }, { role: "user", content: "Continue EXATAMENTE de onde parou, sem repetir nada e sem explicações, até fechar </html>." }] : [{ role: "user", content: user }] };
      if (opts.webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json", "x-api-key": s.claudeKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify(body) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(r.status === 404 ? `Modelo "${s.model}" não existe na sua conta Anthropic. Clique em "Buscar modelos da minha conta" em Tokens e escolha um da lista.` : d?.error?.message || `Claude ${r.status}`); }
      log(opts.kind, "Conectado. A IA está pensando…");
      let it = 0, ot = 0, searches = 0;
      for await (const ev of sse(r, ctrl.signal, onIdle)) {
        if (ev.type === "message_start") it = ev.message?.usage?.input_tokens ?? 0;
        else if (ev.type === "content_block_start" && ev.content_block?.type === "server_tool_use") log(opts.kind, "Pesquisando na internet…");
        else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") { text += ev.delta.text || ""; progress(); }
        else if (ev.type === "message_delta") { ot = ev.usage?.output_tokens ?? ot; searches = ev.usage?.server_tool_use?.web_search_requests ?? searches; if (ev.delta?.stop_reason === "max_tokens") log(opts.kind, "Resposta atingiu o limite de tamanho; vou pedir a continuação."); }
        else if (ev.type === "error") throw new Error(ev.error?.message || "Falha na Claude");
      }
      onUsage({ id: crypto.randomUUID(), at: Date.now(), provider, model: s.model, kind: opts.kind, inputTokens: it, outputTokens: ot, images: 0, searches, costUsd: costFor(s.model, it, ot, 0, searches) });
    }
  } catch (e: any) {
    if (ctrl.signal.aborted) throw new Error(idle ? "A IA ficou 2 minutos sem responder e a geração foi interrompida. Tente de novo ou troque de modelo." : "Geração cancelada.");
    log(opts.kind, `Erro: ${e?.message || e}`); throw e;
  } finally { if (motionAbort === ctrl) motionAbort = null; }
  log(opts.kind, `Concluído em ${Math.round((Date.now() - t0) / 1000)}s · ${text.length.toLocaleString("pt-BR")} caracteres.`, { chars: text.length });
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
As durações das cenas devem somar EXATAMENTE ${seconds}s, sem lacunas na timeline.`, { maxTokens: 12000, kind: "Cenas" }, onUsage);
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

async function completeHtml(s: AiSettings, user: string, kind: string, onUsage: OnUsage) {
  let raw = await callModel(s, MOTION_RULES, user, { maxTokens: 16000, kind }, onUsage);
  for (let i = 0; i < 2 && !/<\/html>/i.test(raw); i++) {
    log(kind, `Motion veio incompleto; pedindo continuação ${i + 1} de 2…`);
    if (!raw.trim()) raw = await callModel(s, MOTION_RULES, user, { maxTokens: 16000, kind }, onUsage);
    else {
      const more = await callModel(s, MOTION_RULES, user, { maxTokens: 16000, kind: kind + " (continuação)", prefill: raw }, onUsage);
      if (!more.trim()) break;
      raw = raw.trimEnd() + more.replace(/^```html\s*/i, "");
    }
  }
  const html = extractHtml(raw);
  if (!/<html|<body|<canvas|<div/i.test(html) || !/<\/html>/i.test(html) || html.length < 500)
    throw new Error("A IA não devolveu o motion completo (resposta vazia ou cortada). Clique em gerar novamente ou escolha outro modelo.");
  return html;
}

export async function generateHtml(s: AiSettings, plan: MotionPlan, format: MotionFormat, seconds: number, hasBg: boolean, onUsage: OnUsage) {
  const ref = await referenceExcerpt(format);
  const user = `Direção criativa aprovada:\n${JSON.stringify(plan, null, 2)}\n\n${HTML_CONTRACT(format, seconds, hasBg)}\n\nTrecho de referência do padrão MRO (aprenda o nível de acabamento, não copie o texto):\n${ref}`;
  return completeHtml(s, user, "Motion HTML", onUsage);
}

export async function editHtml(s: AiSettings, html: string, instruction: string, format: MotionFormat, seconds: number, onUsage: OnUsage) {
  const user = `Edite este motion conforme o pedido: """${instruction}"""\nMantenha tudo que não foi pedido para mudar.\n${HTML_CONTRACT(format, seconds, html.includes("{{BG_IMAGE}}"))}\n\nCódigo atual:\n\`\`\`html\n${html}\n\`\`\``;
  return completeHtml(s, user, "Edição", onUsage);
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
