import type { OutfitVideoDeliverableSnapshot } from "@/lib/ecom/ecom-outfit-video-snapshot";
import type { OutfitVideoProjectDto } from "@/lib/ecom/ecom-outfit-video-types";

/** 与 deliverableSnapshot 入库字段对齐，用于判断「保存后是否有新改动」 */
export function outfitVideoDeliverableFingerprint(
  payload: Pick<
    OutfitVideoDeliverableSnapshot,
    "templateId" | "phase" | "references" | "sceneList" | "structured" | "composeResult"
  >,
): string {
  return JSON.stringify({
    templateId: payload.templateId,
    phase: payload.phase,
    references: payload.references,
    sceneList: payload.sceneList,
    structured: payload.structured,
    composeResult: payload.composeResult,
  });
}

export function readOutfitVideoDeliverableSnapshot(
  meta: Record<string, unknown> | null | undefined,
): OutfitVideoDeliverableSnapshot | null {
  const raw = meta?.deliverableSnapshot;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const snap = raw as OutfitVideoDeliverableSnapshot;
  return typeof snap.savedAt === "string" && snap.savedAt.trim() ? snap : null;
}

/** 相对最近一次「保存到我的资产」是否有未保存改动 */
export function isOutfitVideoDirtySinceDeliverableSave(
  project: Pick<
    OutfitVideoProjectDto,
    "templateId" | "phase" | "references" | "sceneList" | "structured" | "composeResult" | "meta"
  >,
): boolean {
  const snap = readOutfitVideoDeliverableSnapshot(project.meta);
  if (!snap) return true;
  return (
    outfitVideoDeliverableFingerprint(project) !==
    outfitVideoDeliverableFingerprint({
      templateId: snap.templateId,
      phase: snap.phase,
      references: snap.references,
      sceneList: snap.sceneList,
      structured: snap.structured,
      composeResult: snap.composeResult,
    })
  );
}

export function outfitVideoHasSaveableWork(
  project: Pick<OutfitVideoProjectDto, "references" | "sceneList" | "composeResult">,
): boolean {
  return (
    Boolean(project.references?.model?.ossUrl?.trim()) ||
    Boolean(project.references?.modelGallery?.length) ||
    Boolean(project.references?.dressedImage?.ossUrl?.trim()) ||
    project.sceneList.some((s) => Boolean(s.previewImageUrl?.trim() || s.videoUrl?.trim())) ||
    Boolean(project.composeResult?.videoUrl?.trim())
  );
}
