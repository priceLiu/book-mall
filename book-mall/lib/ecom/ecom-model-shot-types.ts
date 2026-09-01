import { z } from "zod";

export const ECOM_MODEL_SHOT_TOOL_KEY = "ecom-toolkit__model-shot";
export const ECOM_MODEL_SHOT_MODULE = "model-shot";
export const ECOM_MODEL_SHOT_TRYON_ACTION = "tryon";
export const ECOM_MODEL_SHOT_CHAT_ACTION = "chat";
export const ECOM_MODEL_SHOT_REF_GENERATE_ACTION = "ref-generate";

export const MODEL_SHOT_POSE_COUNT_MIN = 6;
export const MODEL_SHOT_POSE_COUNT_MAX = 8;
export const MODEL_SHOT_POSE_COUNT_DEFAULT = 6;

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
  /** 姿势动作描述（不含场景/道具） */
  poseDescription?: string;
  /** 本条场景文案，可逐条覆盖项目默认 */
  sceneText?: string;
  /** 场景库 catalogId */
  sceneCatalogId?: string;
  /** 本条道具文案；空字符串表示无道具 */
  propText?: string;
  /** 道具库 catalogId */
  propCatalogId?: string;
  prompt: string;
  imageUrl?: string;
  assetId?: string;
  imageHistory?: ModelShotPoseImageVersion[];
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
  wizard?: {
    modelPick?: boolean;
    scenePick?: boolean;
    propPick?: boolean;
    summaryAcknowledged?: boolean;
  };
  /** V2：用户选择稍后在姿势表填道具 */
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

const poseImageVersionSchema = z.object({
  url: z.string().min(1),
  assetId: z.string().optional(),
  createdAt: z.string().min(1),
});

const poseItemSchema = z.object({
  index: z.number().int().positive(),
  poseId: z.string().optional(),
  category: z.string().optional(),
  title: z.string().optional(),
  poseDescription: z.string().optional(),
  sceneText: z.string().optional(),
  sceneCatalogId: z.string().optional(),
  propText: z.string().optional(),
  propCatalogId: z.string().optional(),
  prompt: z.string().default(""),
  imageUrl: z.string().optional(),
  assetId: z.string().optional(),
  imageHistory: z.array(poseImageVersionSchema).optional(),
  activeImageIndex: z.number().int().nonnegative().optional(),
  promptEdited: z.boolean().optional(),
  status: z.enum(["pending", "generating", "ready", "failed"]).optional(),
});

export function parseModelShotPlan(raw: unknown): ModelShotPlan {
  if (!raw || typeof raw !== "object") {
    return { status: "draft", items: [] };
  }
  const o = raw as Record<string, unknown>;
  const status =
    o.status === "ready" || o.status === "confirmed" ? o.status : "draft";
  const items: ModelShotPoseItem[] = [];
  if (Array.isArray(o.items)) {
    for (const item of o.items) {
      const parsed = poseItemSchema.safeParse(item);
      if (parsed.success) items.push(parsed.data);
    }
  }
  return { status, items };
}

export function sanitizeModelShotReferences(raw: unknown): ModelShotReference[] {
  if (!Array.isArray(raw)) return [];
  const out: ModelShotReference[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const role = r.role;
    if (role !== "garment" && role !== "model" && role !== "scene" && role !== "prop") continue;
    out.push({
      id: typeof r.id === "string" ? r.id : `${role}-${out.length}`,
      role,
      source: typeof r.source === "string" ? r.source : "upload",
      ossUrl: typeof r.ossUrl === "string" ? r.ossUrl : undefined,
      catalogId: typeof r.catalogId === "string" ? r.catalogId : undefined,
      name: typeof r.name === "string" ? r.name : undefined,
      description: typeof r.description === "string" ? r.description : undefined,
      label: typeof r.label === "string" ? r.label : undefined,
    });
  }
  return out;
}

export function sanitizeModelShotChatMessages(raw: unknown): ModelShotChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ModelShotChatMessage[] = [];
  for (const item of raw.slice(-80)) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const content = typeof m.content === "string" ? m.content.trim() : "";
    if (!content) continue;
    out.push({
      id: typeof m.id === "string" ? m.id : `msg-${out.length}`,
      role: m.role === "assistant" ? "assistant" : "user",
      content,
      createdAt:
        typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

export function hasGarmentReference(refs: ModelShotReference[]): boolean {
  return refs.some(
    (r) => r.role === "garment" && typeof r.ossUrl === "string" && r.ossUrl.length > 0,
  );
}

export function refByRole(
  refs: ModelShotReference[],
  role: ModelShotReferenceRole,
): ModelShotReference | undefined {
  return refs.find((r) => r.role === role);
}

/** 道具采集步骤是否完成（V2：仅两选项，不在此选具体道具） */
export function isModelShotPropStepDone(
  refs: ModelShotReference[],
  meta?: ModelShotMeta | null,
): boolean {
  const ref = refByRole(refs, "prop");
  if (ref?.source === "none") return true;
  if (meta?.propDeferred) return true;
  return false;
}

/** 场景步骤是否已完成（含显式跳过 source=none） */
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
