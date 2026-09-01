import {
  hasReplicaModelRefs,
  hasReplicaProductRefs,
} from "@/lib/media-decompose-replica-refs";
import type { MediaDecomposeProject } from "@/lib/media-decompose-types";
import {
  type ReplicaCollectPhase,
} from "@/lib/media-decompose-replica-constants";
import type { SeedVideoProject } from "@/lib/seed-video-types";

export const REPLICA_CHOICE_UPLOAD_MODEL = "上传模特图";
export const REPLICA_CHOICE_PASTE_IMAGE = "粘贴图片";
export const REPLICA_CHOICE_AI_MODEL = "AI 生成模特图";
export const REPLICA_CHOICE_AI_WRITE_MODEL_PROMPT = "AI 写模特提示词";
export const REPLICA_CHOICE_PICK_MODEL_AND_GENERATE = "选择模型并生成";
export const REPLICA_CHOICE_UPLOAD_PRODUCT = "上传产品图";
export const REPLICA_CHOICE_AI_RECOGNIZE_PRODUCT = "AI 识产品";
export const REPLICA_CHOICE_MOCK_RECOGNIZE_PRODUCT = "Mock 识产品";
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

export function isReplicaScriptReady(
  seedVideo: SeedVideoProject,
  phase: ReplicaCollectPhase,
): boolean {
  return (seedVideo.plan?.shots?.length ?? 0) > 0 || phase === "script-done";
}

export function replicaWelcomeMessage(): string {
  return `一键复刻已开始。请按顺序提供 **模特图**（@图片1）与 **产品图**（@图片2），系统将据此匹配替换分镜脚本。

你可以上传、粘贴，或用 AI 生成新模特参考图。`;
}

export function replicaAssistantHint(
  phase: ReplicaCollectPhase,
  opts: { modelReady: boolean; productReady: boolean; scriptReady: boolean; modelGenDraft?: boolean },
): string {
  if (opts.scriptReady) {
    return "脚本已就绪。请在上方「方案② · 精细成片」编辑分镜并生成视频。";
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
  if (phase === "product-info" || phase === "ready") {
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
}): string[] {
  if (opts.scriptReady) return [];

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
}): string {
  if (opts.scriptReady) return "脚本已生成，可在上方编辑分镜…";
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
