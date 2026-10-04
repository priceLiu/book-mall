import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";

import {
  simpleFusionSlotFusionSuccess,
  type SimpleFusionPreviewSlot,
} from "@/lib/simple-fusion-preview-slots";

export type SimpleFusionWorkflowStepId = "fusion" | "clips" | "compose";

export const SIMPLE_FUSION_WORKFLOW_STEPS: Array<{
  id: SimpleFusionWorkflowStepId;
  label: string;
  short: string;
}> = [
  { id: "fusion", label: "静态融合", short: "1" },
  { id: "clips", label: "图生视频", short: "2" },
  { id: "compose", label: "卡点成片", short: "3" },
];

export function simpleFusionAllFusionsReady(slots: SimpleFusionPreviewSlot[]): boolean {
  if (slots.length === 0) return false;
  return slots.every(simpleFusionSlotFusionSuccess);
}

export function simpleFusionAllClipsReady(slots: SimpleFusionPreviewSlot[]): boolean {
  if (slots.length === 0) return false;
  return slots.every((s) => Boolean(s.fusedImageUrl?.trim()) && Boolean(s.clipVideoUrl?.trim()));
}

/** 推断当前应高亮的步骤（compose 仅多套装卡点模式） */
export function inferSimpleFusionWorkflowStep(
  project: SimpleFusionProject | null,
  slots: SimpleFusionPreviewSlot[],
  opts: { garmentMulti: boolean },
): SimpleFusionWorkflowStepId {
  const finalUrl = project?.composeResult?.videoUrl?.trim();
  if (opts.garmentMulti) {
    if (finalUrl) return "compose";
    if (project?.phase === "rendering") return "compose";
    if (simpleFusionAllClipsReady(slots)) return "compose";
    if (simpleFusionAllFusionsReady(slots)) return "clips";
    return "fusion";
  }
  if (simpleFusionAllClipsReady(slots) || finalUrl) return "clips";
  if (simpleFusionAllFusionsReady(slots)) return "clips";
  return "fusion";
}
