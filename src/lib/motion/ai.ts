import { costFor, MODEL_PRICES, type Provider, type UsageEntry } from "./pricing";

export type MotionFormat = "stories" | "youtube" | "square";
export const FORMATS: Record<MotionFormat, { label: string; w: number; h: number; ratio: string }> = {
  stories: { label: "Stories / Reels 9:16", w: 1080, h: 1920, ratio: "9 / 16" },
  youtube: { label: "YouTube 16:9", w: 1920, h: 1080, ratio: "16 / 9" },
  square: { label: "Feed 1:1", w: 1080, h: 1080, ratio: "1 / 1" },
};

export interface MotionScene { title: string; start: number; duration: number; text: string; camera: string; vfx: string; sfx: string; }
export interface MotionPlan { title: string; concept: string; ideas: string[]; palette: string[]; style: string; script: string; scenes: MotionScene[]; imagePrompt: string; }

export interface AiSettings { provider: Provider; model: string; openaiKey: string; claudeKey: string; }

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
  const provider = MODEL_PRICES[s.model]?.provider ?? s.provider;
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
  if (!r.ok) throw new Error(d?.error?.message || `Claude ${r.status}`);
  const text = (d.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  const searches = d.usage?.server_tool_use?.web_search_requests ?? 0;
  const it = d.usage?.input_tokens ?? 0, ot = d.usage?.output_tokens ?? 0;
  onUsage({ id: crypto.randomUUID(), at: Date.now(), provider, model: s.model, kind: opts.kind, inputTokens: it, outputTokens: ot, images: 0, searches, costUsd: costFor(s.model, it, ot, 0, searches) });
  return text;
}

export async function generatePlan(s: AiSettings, prompt: string, format: MotionFormat, seconds: number, webSearch: boolean, onUsage: OnUsage): Promise<MotionPlan> {
  const f = FORMATS[format];
  const user = `Pedido do cliente: """${prompt}"""
Formato: ${f.label} (${f.w}x${f.h}). Duração total EXATA: ${seconds} segundos.
${webSearch ? "Pesquise na internet referências, dados e tendências atuais sobre o tema antes de criar." : ""}
Crie a direção criativa. Responda SOMENTE com JSON:
{"title":"","concept":"","ideas":["3 a 5 ideias criativas"],"palette":["#hex"...4-6],"style":"linguagem visual (ex: Quantum Molten + Glitch)","script":"roteiro/narração completo","scenes":[{"title":"","start":0,"duration":0,"text":"texto em tela","camera":"","vfx":"","sfx":""}],"imagePrompt":"prompt em inglês para imagem de fundo cinematográfica, sem textos"}
As durações das cenas devem somar ${seconds}s.`;
  const text = await callModel(s, MOTION_RULES, user, { maxTokens: 6000, webSearch, kind: "Roteiro e cenas" }, onUsage);
  return extractJson(text);
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

export async function generateBackground(s: AiSettings, prompt: string, format: MotionFormat, facePhoto: string | null, onUsage: OnUsage) {
  if (!s.openaiKey) throw new Error("Imagens são geradas pela OpenAI: configure o token do ChatGPT (a Claude não gera imagens).");
  const size = format === "stories" ? "1024x1536" : format === "youtube" ? "1536x1024" : "1024x1024";
  const full = `${prompt}. Cinematic, high detail, dramatic lighting, no text, no letters, no logos.`;
  let r: Response;
  if (facePhoto) {
    const fd = new FormData();
    fd.append("model", "gpt-image-1");
    fd.append("prompt", `${full} Feature the person from the reference photo, keeping their face identity, as the protagonist.`);
    fd.append("size", size);
    fd.append("image", await dataUrlToBlob(facePhoto), "face.png");
    r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${s.openaiKey}` }, body: fd });
  } else {
    r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.openaiKey}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt: full, size, quality: "medium" }),
    });
  }
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `Imagem ${r.status}`);
  const it = d.usage?.input_tokens ?? 0, ot = d.usage?.output_tokens ?? 0;
  onUsage({ id: crypto.randomUUID(), at: Date.now(), provider: "openai", model: "gpt-image-1", kind: facePhoto ? "Imagem com rosto" : "Imagem de fundo", inputTokens: it, outputTokens: ot, images: 1, searches: 0, costUsd: costFor("gpt-image-1", 0, 0, 1) });
  return `data:image/png;base64,${d.data[0].b64_json}`;
}

export function renderHtml(html: string, bg?: string | null) {
  return bg ? html.split("{{BG_IMAGE}}").join(bg) : html;
}
