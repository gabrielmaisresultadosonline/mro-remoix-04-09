import { describe, expect, it } from "bun:test";
import { pickFallbackModel } from "../src/lib/motion/ai";

describe("pickFallbackModel", () => {
  const account = ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-1", "claude-opus-4-6", "gpt-5"];
  it("keeps the same family and picks the newest version", () => {
    expect(pickFallbackModel("claude-opus-5-5", account)).toBe("claude-opus-4-6");
  });
  it("prefers Sonnet when the family is missing", () => {
    expect(pickFallbackModel("claude-fable-5-1", account)).toBe("claude-sonnet-4-5");
  });
  it("never returns the refused model or an OpenAI model", () => {
    expect(pickFallbackModel("claude-opus-4-1", ["claude-opus-4-1", "gpt-5"])).toBeNull();
  });
});
