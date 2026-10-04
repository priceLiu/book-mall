import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";

export type SimpleFusionPreviewSlot = {
  key: string;
  garmentId?: string;
  caption: string;
  fusedImageUrl?: string;
  clipVideoUrl?: string;
  status?: string;
  failReason?: string;
};

/** 结果区占位：优先后端 looks，否则按服装数，无服装时 1 格（跳舞默认 2 格） */
export function buildSimpleFusionPreviewSlots(
  project: SimpleFusionProject | null,
  opts: { garmentMulti: boolean },
): SimpleFusionPreviewSlot[] {
  if (!project) {
    return [{ key: "placeholder-0", caption: "本套" }];
  }

  const looks = project.meta?.looks ?? [];
  const garments = (project.references.garments ?? []).filter((g) => g.ossUrl?.trim());

  if (looks.length > 0) {
    return looks.map((look, i) => {
      const g = garments.find((x) => x.id === look.garmentId);
      return {
        key: look.lookId,
        garmentId: look.garmentId,
        caption: g?.label?.trim() || `套装 ${i + 1}`,
        fusedImageUrl: look.fusedImageUrl,
        clipVideoUrl: look.clipVideoUrl,
        status: look.status,
        failReason: look.failReason,
      };
    });
  }

  if (garments.length > 0) {
    return garments.map((g, i) => ({
      key: g.id,
      garmentId: g.id,
      caption: g.label?.trim() || `套装 ${i + 1}`,
    }));
  }

  const count = opts.garmentMulti ? 2 : 1;
  return Array.from({ length: count }, (_, i) => ({
    key: `placeholder-${i}`,
    caption: opts.garmentMulti ? `套装 ${i + 1}` : "融合 + 片段",
  }));
}

/** 可用于图生视频 @ 引用与 API 输入的融合成片 */
export function simpleFusionSlotFusionSuccess(slot: SimpleFusionPreviewSlot): boolean {
  if (!slot.fusedImageUrl?.trim()) return false;
  if (slot.status === "failed" || slot.status === "fusion_failed") return false;
  return true;
}

export function simpleFusionSlotFusionGenerating(
  slot: SimpleFusionPreviewSlot,
  pipelineBusy: boolean,
  slotBusy = false,
): boolean {
  if (slot.status === "fusing") return true;
  // 已有融合图：图生视频也会置 slotBusy，不应在融合格上显示「融合中」
  if (slot.fusedImageUrl?.trim()) return false;
  if (slotBusy) return true;
  if (!pipelineBusy) return false;
  return slot.status === "pending" || slot.status === "generating" || !slot.status;
}

export function simpleFusionSlotVideoGenerating(
  slot: SimpleFusionPreviewSlot,
  pipelineBusy: boolean,
  slotBusy = false,
): boolean {
  if (slot.clipVideoUrl?.trim() && !slotBusy) return false;
  if (slot.status === "failed" || slot.status === "fusion_failed") return false;
  if (slotBusy) return true;
  if (slot.status === "generating") return pipelineBusy;
  if (!pipelineBusy) return false;
  return Boolean(slot.fusedImageUrl?.trim());
}
