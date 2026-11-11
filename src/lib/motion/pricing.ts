export type Provider = "openai" | "claude";
// USD per 1M tokens (input, output). Editable estimates.
export const MODEL_PRICES: Record<string, { provider: Provider; label: string; input: number; output: number }> = {
  "gpt-5": { provider: "openai", label: "GPT-5", input: 1.25, output: 10 },
  "gpt-5-mini": { provider: "openai", label: "GPT-5 mini", input: 0.25, output: 2 },
  "gpt-4.1": { provider: "openai", label: "GPT-4.1", input: 2, output: 8 },
  "gpt-4o": { provider: "openai", label: "GPT-4o", input: 2.5, output: 10 },
  "claude-sonnet-4-5": { provider: "claude", label: "Claude Sonnet 4.5", input: 3, output: 15 },
  "claude-opus-4-1": { provider: "claude", label: "Claude Opus 4.1", input: 15, output: 75 },
  "claude-haiku-4-5": { provider: "claude", label: "Claude Haiku 4.5", input: 1, output: 5 },
};
export const IMAGE_PRICE_USD = 0.07; // gpt-image-1, medium quality (approx.)
export const WEB_SEARCH_PRICE_USD = 0.01; // per search call (approx.)

export interface UsageEntry {
  id: string; at: number; provider: Provider; model: string; kind: string;
  inputTokens: number; outputTokens: number; images: number; searches: number; costUsd: number;
}
export function costFor(model: string, inputTokens: number, outputTokens: number, images = 0, searches = 0) {
  const p = MODEL_PRICES[model];
  const tokens = p ? (inputTokens * p.input + outputTokens * p.output) / 1_000_000 : 0;
  return tokens + images * IMAGE_PRICE_USD + searches * WEB_SEARCH_PRICE_USD;
}
export function summarizeUsage(entries: UsageEntry[]) {
  return entries.reduce((a, e) => ({
    inputTokens: a.inputTokens + e.inputTokens, outputTokens: a.outputTokens + e.outputTokens,
    images: a.images + e.images, costUsd: a.costUsd + e.costUsd, calls: a.calls + 1,
  }), { inputTokens: 0, outputTokens: 0, images: 0, costUsd: 0, calls: 0 });
}
