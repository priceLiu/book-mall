export type OutfitUiColumnConfig = {
  showVoiceover: boolean;
  showTts: boolean;
  showEditablePrompt: boolean;
  showPreviewImage: boolean;
  showMotionLabels: boolean;
  showRefColumn: boolean;
  showRefsGallery: boolean;
};

export const OUTFIT_V1_UI_CONFIG: OutfitUiColumnConfig = {
  showVoiceover: false,
  showTts: false,
  showEditablePrompt: false,
  showPreviewImage: true,
  showMotionLabels: true,
  showRefColumn: false,
  showRefsGallery: true,
};

export type OutfitWorkflowPhase =
  | "upload"
  | "split"
  | "edit_scenes"
  | "bind_refs"
  | "generate_shots"
  | "compose"
  | "done";

export const OUTFIT_V1_PROGRESS_STEPS: Array<{ id: OutfitWorkflowPhase; label: string }> = [
  { id: "upload", label: "参考视频" },
  { id: "split", label: "拆镜分镜" },
  { id: "edit_scenes", label: "编辑分镜" },
  { id: "bind_refs", label: "穿搭参考" },
  { id: "generate_shots", label: "逐镜生成" },
  { id: "compose", label: "合成成片" },
];

export type OutfitRefMode = "already_dressed" | "need_tryon" | "text_to_tryon";
export type OutfitGarmentMode = "two_piece" | "one_piece";

export type OutfitRefSettings = {
  outfitRefMode?: OutfitRefMode;
  garmentMode?: OutfitGarmentMode;
};

export function isOutfitRefsReadyToLock(
  _settings: OutfitRefSettings,
  refs: {
    model?: { ossUrl?: string };
    modelGallery?: Array<{ ossUrl?: string }>;
  },
): boolean {
  if (refs.model?.ossUrl?.trim()) return true;
  return (refs.modelGallery?.length ?? 0) > 0;
}

export function inferOutfitPhase(opts: {
  hasReferenceVideo: boolean;
  sceneCount: number;
  hasRefsLocked: boolean;
  allShotsHaveVideo: boolean;
  hasComposeVideo: boolean;
}): OutfitWorkflowPhase {
  if (opts.hasComposeVideo) return "done";
  if (opts.allShotsHaveVideo && opts.sceneCount > 0) return "compose";
  if (opts.hasRefsLocked && opts.sceneCount > 0) return "generate_shots";
  if (opts.sceneCount > 0) return "bind_refs";
  if (opts.hasReferenceVideo) return "split";
  return "upload";
}

export function isOutfitRefsLocked(structured: Record<string, unknown> | null | undefined): boolean {
  if (!structured || typeof structured !== "object") return false;
  const env = structured.refs_locked;
  return Boolean(
    env &&
      typeof env === "object" &&
      (env as { schemaVersion?: string }).schemaVersion === "ecom-video-workflow/v1",
  );
}
