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

/** 分镜表展示 enrich 四要素（运镜/动作/光影/场景） */
export const OUTFIT_V1_SHOW_SHOT_ANALYSIS_COLUMNS = true;

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

export type OutfitRefMode = "already_dressed" | "need_tryon";
export type OutfitGarmentMode = "two_piece" | "one_piece";

export type OutfitRefSettings = {
  outfitRefMode?: OutfitRefMode;
  garmentMode?: OutfitGarmentMode;
};

export function isOutfitRefsReadyToLock(
  settings: OutfitRefSettings,
  refs: {
    model?: { ossUrl?: string };
    clothing?: { ossUrl?: string };
    topGarment?: { ossUrl?: string };
    bottomGarment?: { ossUrl?: string };
  },
): boolean {
  const mode = settings.outfitRefMode ?? "need_tryon";
  if (mode === "already_dressed") {
    return Boolean(refs.model?.ossUrl?.trim());
  }
  const garmentMode = settings.garmentMode ?? "two_piece";
  if (!refs.model?.ossUrl?.trim()) return false;
  if (garmentMode === "two_piece") {
    return Boolean(refs.topGarment?.ossUrl?.trim() && refs.bottomGarment?.ossUrl?.trim());
  }
  return Boolean(refs.clothing?.ossUrl?.trim());
}

export function inferOutfitPhase(opts: {
  hasReferenceVideo: boolean;
  sceneCount: number;
  hasDressedImage: boolean;
  allShotsHaveVideo: boolean;
  hasComposeVideo: boolean;
}): OutfitWorkflowPhase {
  if (opts.hasComposeVideo) return "done";
  if (opts.allShotsHaveVideo && opts.sceneCount > 0) return "compose";
  if (opts.hasDressedImage && opts.sceneCount > 0) return "generate_shots";
  if (opts.sceneCount > 0) return "bind_refs";
  if (opts.hasReferenceVideo) return "split";
  return "upload";
}
