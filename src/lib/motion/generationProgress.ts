export type GenerationStageId = "ideas" | "script" | "scenes" | "image" | "animation";
export type GenerationStepStatus = "pending" | "active" | "done";

export interface GenerationStep {
  id: GenerationStageId;
  label: string;
  status: GenerationStepStatus;
}

const STAGES: Array<Pick<GenerationStep, "id" | "label">> = [
  { id: "ideas", label: "Criando ideias e direção criativa" },
  { id: "script", label: "Escrevendo o roteiro" },
  { id: "scenes", label: "Criando as cenas" },
  { id: "image", label: "Gerando a imagem de fundo" },
  { id: "animation", label: "Animando cenas, câmera, efeitos e sons" },
];

export function createGenerationSteps(withImage: boolean): GenerationStep[] {
  return STAGES
    .filter((stage) => withImage || stage.id !== "image")
    .map((stage, index) => ({ ...stage, status: index === 0 ? "active" : "pending" }));
}

/** Completes only the active stage and activates the next one. No timers or simulated progress. */
export function completeGenerationStep(steps: GenerationStep[], id: GenerationStageId): GenerationStep[] {
  const activeIndex = steps.findIndex((step) => step.status === "active");
  if (activeIndex < 0 || steps[activeIndex].id !== id) return steps;
  return steps.map((step, index) => ({
    ...step,
    status: index === activeIndex ? "done" : index === activeIndex + 1 ? "active" : step.status,
  }));
}

export function generationPercent(steps: GenerationStep[]): number {
  if (!steps.length) return 0;
  return Math.round((steps.filter((step) => step.status === "done").length / steps.length) * 100);
}
