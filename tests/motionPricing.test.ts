import { describe, it, expect } from "vitest";
import { costFor, summarizeUsage } from "@/lib/motion/pricing";
describe("motion cost calculator", () => {
  it("prices tokens per million", () => {
    expect(costFor("claude-sonnet-4-5", 1_000_000, 1_000_000)).toBeCloseTo(18);
  });
  it("adds images", () => {
    expect(costFor("gpt-4.1", 0, 0, 2)).toBeCloseTo(0.14);
  });
  it("sums entries", () => {
    const s = summarizeUsage([{ costUsd: 1, inputTokens: 10, outputTokens: 5, images: 1 } as any, { costUsd: 2, inputTokens: 1, outputTokens: 1, images: 0 } as any]);
    expect(s.costUsd).toBe(3); expect(s.inputTokens).toBe(11); expect(s.calls).toBe(2);
  });
});
