import { describe, expect, it } from "bun:test";
import { completeGenerationStep, createGenerationSteps, generationPercent, type GenerationStep } from "../src/lib/motion/generationProgress";

function complete(steps: GenerationStep[], id: GenerationStep["id"]) {
  return completeGenerationStep(steps, id);
}

describe("progresso real da geração do Motion MRO", () => {
  it("separa ideias, roteiro, cenas e animação quando não há imagem", () => {
    const steps = createGenerationSteps(false);
    expect(steps.map((step) => step.id)).toEqual(["ideas", "script", "scenes", "animation"]);
    expect(steps[0].status).toBe("active");
    expect(generationPercent(steps)).toBe(0);
  });

  it("avança para o roteiro somente depois que as ideias terminam", () => {
    const steps = complete(createGenerationSteps(false), "ideas");
    expect(steps.map((step) => step.status)).toEqual(["done", "active", "pending", "pending"]);
    expect(generationPercent(steps)).toBe(25);
  });

  it("não permite simular uma etapa futura como concluída", () => {
    const initial = createGenerationSteps(false);
    expect(complete(initial, "scenes")).toEqual(initial);
    expect(generationPercent(complete(initial, "animation"))).toBe(0);
  });

  it("inclui a imagem antes da animação e chega a 100% só ao concluir tudo", () => {
    let steps = createGenerationSteps(true);
    expect(steps.map((step) => step.id)).toEqual(["ideas", "script", "scenes", "image", "animation"]);
    for (const id of ["ideas", "script", "scenes", "image"] as const) steps = complete(steps, id);
    expect(generationPercent(steps)).toBe(80);
    expect(steps[4].status).toBe("active");
    steps = complete(steps, "animation");
    expect(generationPercent(steps)).toBe(100);
    expect(steps.every((step) => step.status === "done")).toBe(true);
  });
});
