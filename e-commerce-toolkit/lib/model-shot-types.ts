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

export type ModelShotPoseItem = {
  index: number;
  poseId?: string;
  category?: string;
  title?: string;
  poseDescription?: string;
  sceneText?: string;
  propText?: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
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

/** 场景 / 道具步骤是否已完成（含显式跳过 source=none） */
export function isModelShotOptionalRefDone(
  refs: ModelShotReference[],
  role: "scene" | "prop",
): boolean {
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
