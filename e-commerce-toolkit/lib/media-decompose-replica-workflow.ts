import {
  hasReplicaModelRefs,
  hasReplicaProductRefs,
} from "@/lib/media-decompose-replica-refs";
import type { MediaDecomposeProject } from "@/lib/media-decompose-types";
import {
  type ReplicaCollectPhase,
} from "@/lib/media-decompose-replica-constants";
import {
  listReplicaAssetPlanSlots,
  readReplicaAssetPlan,
  type ReplicaAssetPlan,
} from "@/lib/replica-asset-plan";
import type { SeedVideoProject } from "@/lib/seed-video-types";

export const REPLICA_CHOICE_UPLOAD_MODEL = "上传模特图";
export const REPLICA_CHOICE_PASTE_IMAGE = "粘贴图片";
export const REPLICA_CHOICE_AI_MODEL = "AI 生成模特图";
export const REPLICA_CHOICE_AI_WRITE_MODEL_PROMPT = "AI 写模特提示词";
export const REPLICA_CHOICE_PICK_MODEL_AND_GENERATE = "选择模型并生成";
export const REPLICA_CHOICE_UPLOAD_PRODUCT = "上传产品图";
export const REPLICA_CHOICE_AI_RECOGNIZE_PRODUCT = "AI 识产品";
export const REPLICA_CHOICE_GENERATE_SCRIPT = "生成复刻脚本";

export type ReplicaAssistantAttachment = {
  url: string;
  kind: "model" | "product";
  label?: string;
  /** 上传中展示扫光；完成后为 done */
  status?: "uploading" | "done" | "error";
};

export type ReplicaAssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  attachments?: ReplicaAssistantAttachment[];
};

export function readReplicaPhase(seedVideo: SeedVideoProject): ReplicaCollectPhase {
  const meta = seedVideo.meta as Record<string, unknown> | undefined;
  const raw = meta?.replicaCollectPhase;
  if (typeof raw === "string") return raw as ReplicaCollectPhase;
  const assetPlan = readReplicaAssetPlan(meta);
  if (assetPlan && listReplicaAssetPlanSlots(assetPlan).length > 0) {
    return "asset-upload";
  }
  const hasModel = hasReplicaModelRefs(seedVideo.references);
  const hasProduct = hasReplicaProductRefs(seedVideo.references);
  if (!hasModel) return "model";
  if (!hasProduct) return "product";
  return "product-info";
}

export function readProductBrief(
  project: MediaDecomposeProject,
  seedVideo: SeedVideoProject,
): string {
  const projectMeta = project.meta as Record<string, unknown> | null | undefined;
  const seedMeta = seedVideo.meta as Record<string, unknown> | undefined;
  const fromProject =
    typeof projectMeta?.replicaProductBrief === "string"
      ? projectMeta.replicaProductBrief.trim()
      : "";
  if (fromProject) return fromProject;
  const fromSeed =
    typeof seedMeta?.replicaProductBrief === "string" ? seedMeta.replicaProductBrief.trim() : "";
  return fromSeed;
}

/** 拆解/四槽方案中的原片产品描述，仅作卖点输入框 placeholder 提示（非已保存卖点） */
export function readDecomposeProductDescriptionHint(
  seedVideo: SeedVideoProject,
): string {
  const plan = seedVideo.meta?.replicaAssetPlan;
  if (!plan || typeof plan !== "object") return "";
  const products = (plan as { products?: Array<{ description?: string }> }).products;
  const desc = products?.[0]?.description?.trim();
  return desc ?? "";
}

export function readSellingPoints(
  project: MediaDecomposeProject,
  seedVideo: SeedVideoProject,
): string {
  const projectMeta = project.meta as Record<string, unknown> | null | undefined;
  const seedMeta = seedVideo.meta as Record<string, unknown> | undefined;
  const fromProject =
    typeof projectMeta?.replicaSellingPoints === "string"
      ? projectMeta.replicaSellingPoints.trim()
      : "";
  if (fromProject) return fromProject;
  const fromSeed =
    typeof seedMeta?.replicaSellingPoints === "string"
      ? String(seedMeta.replicaSellingPoints).trim()
      : "";
  return fromSeed;
}

export type ReplicaVoiceoverDraft = {
  shots: Array<{ index: number; voiceover: string }>;
  generatedAt?: string;
};

export function readVoiceoverDraft(seedVideo: SeedVideoProject): ReplicaVoiceoverDraft | null {
  const raw = seedVideo.meta?.replicaVoiceoverDraft;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.shots)) return null;
  const shots = o.shots
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const index = Number(r.index);
      if (!Number.isFinite(index) || index < 1) return null;
      return {
        index: Math.round(index),
        voiceover: typeof r.voiceover === "string" ? r.voiceover : "",
      };
    })
    .filter((s): s is { index: number; voiceover: string } => s != null);
  if (shots.length === 0) return null;
  return {
    shots,
    generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : undefined,
  };
}

export function isReplicaScriptReady(
  seedVideo: SeedVideoProject,
  phase: ReplicaCollectPhase,
): boolean {
  return (seedVideo.plan?.shots?.length ?? 0) > 0 || phase === "script-done";
}

function formatAssetPlanSummary(plan: ReplicaAssetPlan): string {
  const parts: string[] = [];
  if (plan.characters.length) {
    parts.push(`人物 ${plan.characters.map((s) => s.label).join("、")}`);
  }
  if (plan.products.length) {
    parts.push(`产品 ${plan.products.map((s) => s.label).join("、")}`);
  }
  if (plan.props.length) {
    parts.push(`道具 ${plan.props.map((s) => s.label).join("、")}`);
  }
  if (plan.scenes.length) {
    parts.push(`场景 ${plan.scenes.map((s) => s.label).join("、")}`);
  }
  return parts.join("；");
}

export function replicaWelcomeMessage(opts?: { assetPlan?: ReplicaAssetPlan | null }): string {
  const plan = opts?.assetPlan;
  if (plan && listReplicaAssetPlanSlots(plan).length > 0) {
    return `一键复刻已开始。系统已从拆解结果列出 **复刻资产方案**（${formatAssetPlanSummary(plan)}）。

按需上传要 **替换** 的槽位图（Prompt 用 @人物A / @产品1 等 token）；**未上传** 的槽位将 **inherit** 沿用原片描述。可直接生成脚本，也可先上传部分槽位再生成。`;
  }
  return `一键复刻已开始。请按顺序提供 **模特图**（@图片1）与 **产品图**（@图片2），系统将据此匹配替换分镜脚本。

你可以上传、粘贴，或用 AI 生成新模特参考图。`;
}

export function replicaAssistantHint(
  phase: ReplicaCollectPhase,
  opts: {
    modelReady: boolean;
    productReady: boolean;
    scriptReady: boolean;
    modelGenDraft?: boolean;
    assetPlan?: ReplicaAssetPlan | null;
    hasProductSlots?: boolean;
  },
): string {
  if (opts.scriptReady) {
    return "脚本已就绪。请在上方「方案② · 精细成片」编辑分镜并生成视频。";
  }
  if (opts.assetPlan && listReplicaAssetPlanSlots(opts.assetPlan).length > 0) {
    if (opts.hasProductSlots) {
      return "在上方四槽方案中按需上传替换图；有产品槽位时建议 AI 识产品或填写产品描述，然后生成复刻脚本。";
    }
    return "在上方四槽方案中按需上传替换图；未上传的槽位沿用原片描述。确认后点「生成复刻脚本」。";
  }
  if (opts.modelGenDraft) {
    return "请确认或编辑模特生图 Prompt，然后点「选择模型并生成」。";
  }
  if (!opts.modelReady) {
    return "请先提供模特参考图：上传、粘贴，或 AI 生成。";
  }
  if (!opts.productReady) {
    return "模特图已就绪。请上传或粘贴产品图。";
  }
  if (phase === "product-info" || phase === "ready" || phase === "asset-upload") {
    return "请补充产品描述（可 AI 识产品），然后生成复刻脚本。";
  }
  return "按上方步骤继续。";
}

export function inferReplicaAssistantChoices(opts: {
  phase: ReplicaCollectPhase;
  modelReady: boolean;
  productReady: boolean;
  scriptReady: boolean;
  modelGenDraft: boolean;
  productBrief: string;
  modelPromptDraft: string;
  assetPlan?: ReplicaAssetPlan | null;
}): string[] {
  if (opts.scriptReady) return [];

  if (opts.assetPlan && listReplicaAssetPlanSlots(opts.assetPlan).length > 0) {
    const out: string[] = [];
    if (opts.assetPlan.products.length > 0 && !opts.productBrief.trim()) {
      out.push(REPLICA_CHOICE_AI_RECOGNIZE_PRODUCT);
    }
    out.push(REPLICA_CHOICE_GENERATE_SCRIPT);
    return out;
  }

  if (opts.modelGenDraft) {
    const out = [REPLICA_CHOICE_AI_WRITE_MODEL_PROMPT];
    if (opts.modelPromptDraft.trim()) out.push(REPLICA_CHOICE_PICK_MODEL_AND_GENERATE);
    return out;
  }

  if (!opts.modelReady) {
    return [REPLICA_CHOICE_UPLOAD_MODEL, REPLICA_CHOICE_PASTE_IMAGE, REPLICA_CHOICE_AI_MODEL];
  }

  if (!opts.productReady) {
    return [REPLICA_CHOICE_UPLOAD_PRODUCT, REPLICA_CHOICE_PASTE_IMAGE];
  }

  const out: string[] = [];
  if (!opts.productBrief.trim()) out.push(REPLICA_CHOICE_AI_RECOGNIZE_PRODUCT);
  out.push(REPLICA_CHOICE_GENERATE_SCRIPT);
  return out;
}

export function replicaComposerPlaceholder(opts: {
  modelReady: boolean;
  productReady: boolean;
  scriptReady: boolean;
  modelGenDraft: boolean;
  pasteReady?: boolean;
  assetPlan?: ReplicaAssetPlan | null;
}): string {
  if (opts.scriptReady) return "脚本已生成，可在上方编辑分镜…";
  if (opts.assetPlan && listReplicaAssetPlanSlots(opts.assetPlan).length > 0) {
    if (opts.assetPlan.products.length > 0) {
      return "补充产品说明，或点「生成复刻脚本」…";
    }
    return "补充备注，或点「生成复刻脚本」…";
  }
  if (opts.modelGenDraft) return "编辑模特生图 Prompt，或点快捷选项…";
  if (!opts.modelReady) {
    return opts.pasteReady
      ? "描述模特偏好，或 ⌘V 粘贴 / 拖入图片…"
      : "描述模特偏好，或点 + 上传 / 粘贴 / 拖入图片…";
  }
  if (!opts.productReady) {
    return opts.pasteReady
      ? "补充产品说明，或 ⌘V 粘贴 / 拖入产品图…"
      : "补充产品说明，或点 + 上传 / 粘贴 / 拖入产品图…";
  }
  return "在上方产品描述卡片编辑并保存，或点「生成复刻脚本」…";
}
