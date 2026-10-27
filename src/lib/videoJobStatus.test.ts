import { describe, it, expect } from "vitest";
import { describeJobState } from "./videoJobStatus";

describe("describeJobState", () => {
  it("usa a porcentagem real do servidor", () => {
    expect(describeJobState({ status: "processing", progress: 50, idle_seconds: 5, stalled: false })).toEqual({ kind: "processing", label: "Processando", percent: 50 });
  });
  it("não inventa porcentagem antes do ffmpeg reportar", () => {
    expect(describeJobState({ status: "processing", progress: 1, stalled: false }).percent).toBeNull();
    expect(describeJobState({ status: "queued", progress: 0, stalled: false }).kind).toBe("waiting");
  });
  it("erro não fica preso em processando", () => {
    expect(describeJobState({ status: "error", progress: 40 }).kind).toBe("error");
  });
  it("sem atualização por mais de 3 min é travamento (servidor antigo)", () => {
    const now = Date.parse("2026-01-01T00:10:00Z");
    expect(describeJobState({ status: "processing", progress: 30, updated_at: "2026-01-01T00:06:00Z" }, true, now).kind).toBe("stalled");
    expect(describeJobState({ status: "processing", progress: 30, updated_at: "2026-01-01T00:08:00Z" }, true, now).kind).toBe("processing");
  });
  it("concluído é 100%", () => {
    expect(describeJobState({ status: "completed", progress: 100 }).percent).toBe(100);
  });
});
