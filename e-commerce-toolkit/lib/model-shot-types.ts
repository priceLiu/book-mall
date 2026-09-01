export type ModelShotPhase =
  | "garment"
  | "model"
  | "scene"
  | "prop"
  | "meta"
  | "poses"
  | "confirm"
  | "generate";

export type ModelShotChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ModelShotReferenceRole = "garment" | "model" | "scene" | "prop";

export type ModelShotReference = {
  id: string;
  role: ModelShotReferenceRole;
  source: string;
  ossUrl?: string;
  catalogId?: string;
  name?: string;
  description?: string;
  label?: string;
};

export type ModelShotBrief = {
  platform?: string;
  industry?: string;
  styles?: string[];
  poseCount?: number;
};

export type ModelShotPoseImageVersion = {
  url: string;
  assetId?: string;
  createdAt: string;
};

export type ModelShotPoseItem = {
  index: number;
  poseId?: string;
  category?: string;
  title?: string;
  poseDescription?: string;
  sceneText?: string;
  sceneCatalogId?: string;
  propText?: string;
  propCatalogId?: string;
  prompt: string;
  /** 当前选中版本的 URL（与 imageHistory[activeImageIndex] 同步） */
  imageUrl?: string;
  assetId?: string;
  /** 同姿势多次生成的历史；最早在前，最新在后 */
  imageHistory?: ModelShotPoseImageVersion[];
  /** 格内正在查看的版本下标，默认最新 */
  activeImageIndex?: number;
  promptEdited?: boolean;
  status?: "pending" | "generating" | "ready" | "failed";
};

export type ModelShotPlan = {
  status: "draft" | "ready" | "confirmed";
  items: ModelShotPoseItem[];
};

export type ModelShotSettings = {
  chatModelKey?: string;
  imageModelKey?: string;
};

export type ModelShotMeta = {
  phase?: ModelShotPhase;
  lastAssistantRaw?: string;
  /** 助手分步向导：模式 → 推荐列表 → 下一问 */
  wizard?: {
    modelPick?: boolean;
    scenePick?: boolean;
    propPick?: boolean;
    summaryAcknowledged?: boolean;
  };
  propDeferred?: boolean;
  workflow?: {
    phase?: ModelShotPhase;
    pendingPoseImages?: Record<
      string,
      { startedAt: string; modelKey?: string }
    >;
  };
};

export type ModelShotProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: ModelShotBrief | null;
  settings: ModelShotSettings;
  references: ModelShotReference[];
  chatHistory: ModelShotChatMessage[];
  plan: ModelShotPlan;
  meta: ModelShotMeta | null;
  createdAt: string;
  updatedAt: string;
};

export type ModelShotModelsPayload = {
  chatModels: import("@/lib/storyboard-types").StoryboardGatewayModel[];
  imageModels: import("@/lib/storyboard-types").StoryboardGatewayModel[];
  defaults: { chat: string; image: string };
};

export function refByRole(
  refs: ModelShotReference[],
  role: ModelShotReferenceRole,
): ModelShotReference | undefined {
  return refs.find((r) => r.role === role);
}

/** 道具采集步骤是否完成（V2） */
export function isModelShotPropStepDone(
  refs: ModelShotReference[],
  meta?: ModelShotMeta | null,
): boolean {
  const ref = refByRole(refs, "prop");
  if (ref?.source === "none") return true;
  if (meta?.propDeferred) return true;
  return false;
}

/** 场景步骤是否已完成 */
export function isModelShotOptionalRefDone(
  refs: ModelShotReference[],
  role: "scene" | "prop",
): boolean {
  if (role === "prop") return false;
  const ref = refByRole(refs, role);
  if (!ref) return false;
  if (ref.source === "none") return true;
  return Boolean(ref.ossUrl || ref.description?.trim() || ref.name || ref.catalogId);
}

export function hasGarmentReference(refs: ModelShotReference[]): boolean {
  return refs.some(
    (r) => r.role === "garment" && typeof r.ossUrl === "string" && r.ossUrl.length > 0,
  );
}
