import type { SceneShot, WorkflowRefs } from "@/lib/video-workflow/shot-spine";

export type OutfitVideoDeliverableSnapshot = {
  savedAt: string;
  title: string;
  templateId: string;
  phase: string;
  references: WorkflowRefs;
  sceneList: SceneShot[];
  structured: Record<string, unknown> | null;
  composeResult: {
    videoUrl: string;
    coverUrl?: string;
    videoInfo?: {
      durationSec: number;
      resolution: string;
      fps: number;
      aspectRatio: string;
    };
  } | null;
};

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

export function isOutfitVideoDirtySinceDeliverableSave(project: {
  templateId: string;
  phase: string;
  references: WorkflowRefs;
  sceneList: SceneShot[];
  structured: Record<string, unknown> | null;
  composeResult: OutfitVideoDeliverableSnapshot["composeResult"];
  meta: Record<string, unknown> | null | undefined;
}): boolean {
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

export function mergeOutfitDeliverableSnapshotIntoMeta<T extends { meta: Record<string, unknown> | null | undefined }>(
  project: T,
  snapshot: OutfitVideoDeliverableSnapshot,
): T {
  return {
    ...project,
    meta: {
      ...(project.meta ?? {}),
      deliverableSnapshot: snapshot,
    },
  };
}

export function outfitVideoHasSaveableWork(project: {
  references: WorkflowRefs;
  sceneList: SceneShot[];
  composeResult: OutfitVideoDeliverableSnapshot["composeResult"];
}): boolean {
  return (
    Boolean(project.references?.model?.ossUrl?.trim()) ||
    Boolean(project.references?.modelGallery?.length) ||
    Boolean(project.references?.dressedImage?.ossUrl?.trim()) ||
    project.sceneList.some((s) => Boolean(s.previewImageUrl?.trim() || s.videoUrl?.trim())) ||
    Boolean(project.composeResult?.videoUrl?.trim())
  );
}
