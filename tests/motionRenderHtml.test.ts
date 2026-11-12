import { describe, expect, it } from "bun:test";
import { renderHtml } from "../src/lib/motion/ai";

describe("renderHtml", () => {
  it("uses the generated background when it exists", () => {
    expect(renderHtml('<img src="{{BG_IMAGE}}">', "data:x")).toBe('<img src="data:x">');
  });
  it("never leaves the placeholder when the background failed", () => {
    expect(renderHtml('<img src="{{BG_IMAGE}}">', null)).not.toContain("{{BG_IMAGE}}");
  });
});
