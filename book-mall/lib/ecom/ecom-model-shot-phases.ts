import type {
  ModelShotBrief,
  ModelShotMeta,
  ModelShotPhase,
  ModelShotProject,
  ModelShotReference,
} from "@/lib/ecom/ecom-model-shot-types";
import {
  hasGarmentReference,
  isModelShotOptionalRefDone,
  refByRole,
} from "@/lib/ecom/ecom-model-shot-types";

export function isMetaBriefComplete(brief: ModelShotBrief | null | undefined): boolean {
  return Boolean(brief?.styles?.length && brief?.platform && brief?.poseCount);
}

export function isModelShotMetaPhaseComplete(project: ModelShotProject): boolean {
  return (
    isMetaBriefComplete(project.brief) &&
    Boolean(project.meta?.wizard?.summaryAcknowledged)
  );
}

const MODEL_SHOT_PHASE_ORDER: ModelShotPhase[] = [
  "garment",
  "model",
  "scene",
  "prop",
  "meta",
  "poses",
  "confirm",
  "generate",
];

function modelShotPhaseRank(phase: ModelShotPhase): number {
  const idx = MODEL_SHOT_PHASE_ORDER.indexOf(phase);
  return idx >= 0 ? idx : 0;
}

export function deriveModelShotPhaseFromState(project: ModelShotProject): ModelShotPhase {
  if (project.plan.status === "confirmed") return "generate";
  if (project.plan.items.length > 0) return "confirm";
  if (!hasGarmentReference(project.references)) return "garment";
  if (!refByRole(project.references, "model")) return "model";
  if (!isModelShotOptionalRefDone(project.references, "scene")) return "scene";
  if (!isModelShotOptionalRefDone(project.references, "prop")) return "prop";
  if (!isModelShotMetaPhaseComplete(project)) return "meta";
  return "poses";
}

export function inferModelShotPhase(project: ModelShotProject): ModelShotPhase {
  const derived = deriveModelShotPhaseFromState(project);
  const metaPhase = project.meta?.phase;
  if (!metaPhase) return derived;
  return modelShotPhaseRank(metaPhase) > modelShotPhaseRank(derived)
    ? metaPhase
    : derived;
}

export function mergeModelShotPatch(
  project: ModelShotProject,
  patch: Record<string, unknown>,
): Partial<{
  brief: ModelShotBrief;
  meta: ModelShotMeta;
  references: ModelShotReference[];
}> {
  const out: Partial<{
    brief: ModelShotBrief;
    meta: ModelShotMeta;
    references: ModelShotReference[];
  }> = {};

  if (patch.brief && typeof patch.brief === "object") {
    out.brief = { ...(project.brief ?? {}), ...(patch.brief as ModelShotBrief) };
  }
  if (patch.meta && typeof patch.meta === "object") {
    out.meta = { ...(project.meta ?? {}), ...(patch.meta as ModelShotMeta) };
  }
  return out;
}

export function extractModelShotJson(text: string): Record<string, unknown> | null {
  const fence = /```model-shot\s*([\s\S]*?)```/i.exec(text);
  if (!fence?.[1]) return null;
  try {
    return JSON.parse(fence[1].trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
