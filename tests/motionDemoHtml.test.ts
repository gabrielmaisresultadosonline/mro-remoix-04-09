import { describe, expect, it } from "bun:test";
import { stripCloudflareRum } from "../src/lib/motion/demoHtml";

describe("demonstrações do Motion MRO sem Cloudflare RUM", () => {
  it("remove o beacon injetado e preserva o JavaScript do motion", () => {
    const source = `<!doctype html><html><head><script defer src='https://static.cloudflareinsights.com/beacon.min.js/v123' data-cf-beacon='{"token":"demo"}'></script><script>window.MOTION={duration:8};</script></head><body>Motion</body></html>`;
    const clean = stripCloudflareRum(source);
    expect(clean).not.toContain("cloudflareinsights");
    expect(clean).not.toContain("data-cf-beacon");
    expect(clean).toContain("window.MOTION={duration:8};");
    expect(clean).toContain("<body>Motion</body>");
  });

  it("mantém intacto um HTML que não possui o rastreador", () => {
    const source = "<!doctype html><html><body><script>window.MOTION={restart(){}};</script></body></html>";
    expect(stripCloudflareRum(source)).toBe(source);
  });
});
