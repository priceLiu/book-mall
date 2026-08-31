import type {
  ModelShotBrief,
  ModelShotPhase,
  ModelShotProject,
  ModelShotReference,
} from "@/lib/model-shot-types";
import {
  hasGarmentReference,
  isModelShotOptionalRefDone,
  refByRole,
} from "@/lib/model-shot-types";
import {
  listModelShotPropPresets,
  listModelShotScenePresets,
  MODEL_SHOT_MODEL_ARCHETYPES,
  MODEL_SHOT_MODEL_CHOICE_PREFIX,
  MODEL_SHOT_MODEL_MODE_PREFIX,
  MODEL_SHOT_PROP_CHOICE_PREFIX,
  MODEL_SHOT_PROP_MODE_PREFIX,
  MODEL_SHOT_SCENE_CHOICE_PREFIX,
  MODEL_SHOT_SCENE_MODE_PREFIX,
  parseModelArchetypeChoice,
  parsePropChoiceLabel,
  parseSceneChoiceLabel,
  type ModelShotModelArchetype,
  type ModelShotPropPreset,
  type ModelShotScenePreset,
} from "@/lib/model-shot-prompt-presets";

const MODEL_SHOT_PHASE_ORDER: ModelShotPhase[] = [
  "garment",
  "model",
  "scene",
  "prop",
  "meta",
  "poses",
  "confirm",
  "generate",
];

function modelShotPhaseRank(phase: ModelShotPhase): number {
  const idx = MODEL_SHOT_PHASE_ORDER.indexOf(phase);
  return idx >= 0 ? idx : 0;
}

/** 仅根据参考图 / brief / plan 推导阶段（不受陈旧 meta.phase 拖累） */
export function deriveModelShotPhaseFromState(project: ModelShotProject): ModelShotPhase {
  if (project.plan.status === "confirmed") return "generate";
  if (project.plan.items.length > 0) return "confirm";
  if (!hasGarmentReference(project.references)) return "garment";
  if (!refByRole(project.references, "model")) return "model";
  if (!isModelShotOptionalRefDone(project.references, "scene")) return "scene";
  if (!isModelShotOptionalRefDone(project.references, "prop")) return "prop";
  if (!isModelShotMetaPhaseComplete(project)) return "meta";
  return "poses";
}

export function isModelShotMetaPhaseComplete(project: ModelShotProject): boolean {
  return (
    isMetaBriefComplete(project.brief) &&
    Boolean(project.meta?.wizard?.summaryAcknowledged)
  );
}

export function isMetaBriefComplete(brief: ModelShotBrief | null | undefined): boolean {
  return Boolean(brief?.styles?.length && brief?.platform && brief?.poseCount);
}

export type ModelShotMetaSubStep = "style" | "usage" | "count" | "summary";

export function inferMetaSubStep(project: ModelShotProject): ModelShotMetaSubStep | null {
  if (inferModelShotPhase(project) !== "meta") return null;
  const brief = project.brief ?? {};
  if (!brief.styles?.length) return "style";
  if (!brief.platform) return "usage";
  if (!brief.poseCount) return "count";
  if (!project.meta?.wizard?.summaryAcknowledged) return "summary";
  return null;
}

/** 文档 Step4 · 风格调性（一问一选） */
export const MODEL_SHOT_STYLE_CHOICES = [
  { label: "静奢知性", styles: ["优雅", "知性"] as string[] },
  { label: "松弛度假", styles: ["慵懒", "随性"] as string[] },
  { label: "法式柔雾", styles: ["优雅", "温柔"] as string[] },
  { label: "干净实拍", styles: ["邻家", "自然"] as string[] },
] as const;

/** 文档 Step4 · 主要用途 */
export const MODEL_SHOT_USAGE_CHOICES = [
  { label: "电商主图 / 详情页", platform: "淘宝", industry: "女装电商" },
  { label: "小红书种草", platform: "小红书", industry: "女装电商" },
  { label: "品牌 lookbook / 官网", platform: "品牌 lookbook", industry: "品牌广告" },
  { label: "社交媒体广告投放", platform: "抖音", industry: "社交媒体" },
] as const;

export const MODEL_SHOT_COUNT_CHOICES = [
  { label: "6 张", poseCount: 6 },
  { label: "8 张", poseCount: 8 },
] as const;

export const MODEL_SHOT_STYLE_CHOICE_PREFIX = "风格·";
export const MODEL_SHOT_USAGE_CHOICE_PREFIX = "用途·";
export const MODEL_SHOT_COUNT_CHOICE_PREFIX = "张数·";

function stableCatalogOffset(seed: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i)) % length;
  return hash;
}

function stableSceneChoiceLabels(projectId: string, count = 5): string[] {
  const all = listModelShotScenePresets();
  if (!all.length) return [];
  const offset = stableCatalogOffset(projectId, all.length);
  return [...all.slice(offset), ...all.slice(0, offset)]
    .slice(0, count)
    .map((s) => `${MODEL_SHOT_SCENE_CHOICE_PREFIX}${s.name}`);
}

function stablePropChoiceLabels(projectId: string, count = 5): string[] {
  const all = listModelShotPropPresets();
  if (!all.length) return [];
  const offset = stableCatalogOffset(`${projectId}-prop`, all.length);
  return [...all.slice(offset), ...all.slice(0, offset)]
    .slice(0, count)
    .map((p) => `${MODEL_SHOT_PROP_CHOICE_PREFIX}${p.name}`);
}

export function parseMetaStyleChoice(choice: string): { styles: string[] } | null {
  if (!choice.startsWith(MODEL_SHOT_STYLE_CHOICE_PREFIX)) return null;
  const label = choice.slice(MODEL_SHOT_STYLE_CHOICE_PREFIX.length).trim();
  const hit = MODEL_SHOT_STYLE_CHOICES.find((s) => s.label === label);
  return hit ? { styles: [...hit.styles] } : null;
}

export function parseMetaUsageChoice(choice: string): Pick<ModelShotBrief, "platform" | "industry"> | null {
  if (!choice.startsWith(MODEL_SHOT_USAGE_CHOICE_PREFIX)) return null;
  const label = choice.slice(MODEL_SHOT_USAGE_CHOICE_PREFIX.length).trim();
  const hit = MODEL_SHOT_USAGE_CHOICES.find((u) => u.label === label);
  return hit ? { platform: hit.platform, industry: hit.industry } : null;
}

export function parseMetaCountChoice(choice: string): { poseCount: number } | null {
  if (!choice.startsWith(MODEL_SHOT_COUNT_CHOICE_PREFIX)) return null;
  const label = choice.slice(MODEL_SHOT_COUNT_CHOICE_PREFIX.length).trim();
  const hit = MODEL_SHOT_COUNT_CHOICES.find((c) => c.label === label);
  return hit ? { poseCount: hit.poseCount } : null;
}

function formatSceneRecommendList(projectId: string): string {
  const presets = stableSceneChoiceLabels(projectId, 5)
    .map((c) => parseSceneChoiceLabel(c))
    .filter(Boolean) as ModelShotScenePreset[];
  return presets
    .map((s, i) => `${i + 1}. **${s.name}** — ${s.visualPrompt}`)
    .join("\n");
}

function formatPropRecommendList(projectId: string): string {
  const presets = stablePropChoiceLabels(projectId, 5)
    .map((c) => parsePropChoiceLabel(c))
    .filter(Boolean) as ModelShotPropPreset[];
  return presets
    .map((p, i) => `${i + 1}. **${p.name}** — ${p.visualDescription}`)
    .join("\n");
}

function formatModelRecommendList(): string {
  return MODEL_SHOT_MODEL_ARCHETYPES.map(
    (m, i) => `${i + 1}. **${m.label}** — ${m.description}`,
  ).join("\n");
}

export function buildModelShotCollectionSummary(project: ModelShotProject): string {
  const model = refByRole(project.references, "model");
  const scene = refByRole(project.references, "scene");
  const prop = refByRole(project.references, "prop");
  const brief = project.brief ?? {};
  const modelLine = model?.name ?? model?.description?.slice(0, 40) ?? "未指定";
  const sceneLine =
    scene?.source === "none"
      ? "跳过（出图时由模型自由发挥）"
      : (scene?.name ?? scene?.description?.slice(0, 40) ?? "未指定");
  const propLine =
    prop?.source === "none" ? "不需要" : (prop?.name ?? prop?.description?.slice(0, 32) ?? "未指定");
  const styles = brief.styles?.join("、") ?? "—";
  const n = brief.poseCount ?? 6;
  return `明白。信息采集已完成，汇总如下：

- **模特**：${modelLine}
- **场景**：${sceneLine}
- **道具**：${propLine}
- **风格**：${styles}
- **平台/用途**：${brief.platform ?? "—"}
- **姿势张数**：${n} 张

接下来将为您编排 **${n} 个**差异化全身姿势（涵盖站姿、行走、侧身等多种类型），并同步到中栏。请确认后开始生成。`;
}

export function posePlanGenerateChoiceLabel(poseCount: number): string {
  return `生成 ${poseCount} 个姿势方案`;
}

export { parsePropChoiceLabel, parseSceneChoiceLabel, parseModelArchetypeChoice };

export function inferModelShotPhase(project: ModelShotProject): ModelShotPhase {
  const derived = deriveModelShotPhaseFromState(project);
  const metaPhase = project.meta?.phase;
  if (!metaPhase) return derived;
  // meta 可表示助手已推进（如跳过道具）；但不能把已上传的参考图「拉回」更早阶段
  return modelShotPhaseRank(metaPhase) > modelShotPhaseRank(derived)
    ? metaPhase
    : derived;
}

const WELCOME_INTRO = `你好，我是服装模特图创作助手。

我会帮你锁定服装、模特、场景与道具，编排 6～8 个差异化全身姿势，然后在中栏确认 Prompt 后批量出图。`;

export const MODEL_SHOT_WELCOME_MESSAGE = `${WELCOME_INTRO}

**请先在中栏上传服装参考图**（必填），上传后我会自动识别并引导下一步。`;

export function resolveModelShotWelcomeMessage(project: ModelShotProject): string {
  switch (inferModelShotPhase(project)) {
    case "garment":
      return MODEL_SHOT_WELCOME_MESSAGE;
    case "model":
      return `${WELCOME_INTRO}

**第一步 · 关于模特**：您有三种方式确定模特形象——请点选一项：`;
    case "scene":
      return `${WELCOME_INTRO}

**第二步 · 关于场景/背景**：请选择确定方式（可跳过）：`;
    case "prop": {
      const sceneSkipped = refByRole(project.references, "scene")?.source === "none";
      return `${WELCOME_INTRO}

${sceneSkipped ? "场景已跳过。" : "场景已就绪。"}

**第三步 · 关于手持道具**：请选择（可不需要）：`;
    }
    case "meta": {
      const sub = inferMetaSubStep(project);
      if (sub === "style") {
        return `${WELCOME_INTRO}

**第四步 · 风格调性** — 请先选 1 项：`;
      }
      if (sub === "usage") {
        return `${WELCOME_INTRO}

**第四步 · 主要用途** — 选 1 项：`;
      }
      if (sub === "count") {
        return `${WELCOME_INTRO}

**第四步 · 姿势张数**（6～8 张）— 选 1 项：`;
      }
      if (sub === "summary") {
        return buildModelShotCollectionSummary(project);
      }
      return `${WELCOME_INTRO}

请继续完成元信息采集。`;
    }
    case "poses":
      return `${WELCOME_INTRO}

**第五步 · 姿势方案**已就绪，请在中栏核对 Prompt。`;
    case "confirm":
      return `${WELCOME_INTRO}

**第六步 · 确认出图**：请在中栏核对 **姿势脚本**，点击「确认计划」后于下方 **模特图** 卡片逐张或勾选生成。`;
    case "generate":
      return `${WELCOME_INTRO}

计划已确认。请在中栏 **姿势脚本** 表编辑姿势/场景/道具，下方 **模特图** 卡片可逐张或勾选批量生成。`;
    default:
      return MODEL_SHOT_WELCOME_MESSAGE;
  }
}

export type ModelShotRailStep = {
  id: ModelShotPhase;
  label: string;
  short: string;
};

export const MODEL_SHOT_RAIL_STEPS: ModelShotRailStep[] = [
  { id: "garment", label: "采集", short: "采" },
  { id: "poses", label: "姿势方案", short: "姿" },
  { id: "confirm", label: "确认", short: "确" },
  { id: "generate", label: "出图", short: "图" },
];

export function railStepState(
  project: ModelShotProject,
  stepId: ModelShotPhase,
): "done" | "active" | "pending" {
  const phase = inferModelShotPhase(project);
  const order: ModelShotPhase[] = ["garment", "poses", "confirm", "generate"];
  const phaseIdx = order.indexOf(
    phase === "model" || phase === "scene" || phase === "prop" || phase === "meta"
      ? "garment"
      : phase,
  );
  const stepIdx = order.indexOf(stepId);
  if (stepIdx < phaseIdx) return "done";
  if (stepIdx === phaseIdx) return "active";
  return "pending";
}

export function inferAssistantChoices(project: ModelShotProject): string[] {
  const phase = inferModelShotPhase(project);
  const wizard = project.meta?.wizard ?? {};
  const modelRef = refByRole(project.references, "model");
  const sceneRef = refByRole(project.references, "scene");
  const propRef = refByRole(project.references, "prop");

  switch (phase) {
    case "garment":
      return [];
    case "model":
      if (modelRef) return [];
      if (wizard.modelPick) {
        return MODEL_SHOT_MODEL_ARCHETYPES.map(
          (m) => `${MODEL_SHOT_MODEL_CHOICE_PREFIX}${m.label}`,
        );
      }
      return [
        `${MODEL_SHOT_MODEL_MODE_PREFIX}上传参考图`,
        `${MODEL_SHOT_MODEL_MODE_PREFIX}AI推荐虚拟模特`,
        `${MODEL_SHOT_MODEL_MODE_PREFIX}手写描述`,
        `${MODEL_SHOT_MODEL_MODE_PREFIX}从模特库选择`,
      ];
    case "scene":
      if (sceneRef) return [];
      if (wizard.scenePick) {
        return stableSceneChoiceLabels(project.id);
      }
      return [
        `${MODEL_SHOT_SCENE_MODE_PREFIX}上传参考图`,
        `${MODEL_SHOT_SCENE_MODE_PREFIX}词库推荐`,
        `${MODEL_SHOT_SCENE_MODE_PREFIX}跳过场景`,
        `${MODEL_SHOT_SCENE_MODE_PREFIX}AI生成（中栏）`,
      ];
    case "prop":
      if (propRef) return [];
      if (wizard.propPick) {
        return stablePropChoiceLabels(project.id);
      }
      return [
        `${MODEL_SHOT_PROP_MODE_PREFIX}不需要道具`,
        `${MODEL_SHOT_PROP_MODE_PREFIX}上传参考图`,
        `${MODEL_SHOT_PROP_MODE_PREFIX}词库推荐`,
        `${MODEL_SHOT_PROP_MODE_PREFIX}AI生成（中栏）`,
      ];
    case "meta": {
      const sub = inferMetaSubStep(project);
      if (sub === "style") {
        return MODEL_SHOT_STYLE_CHOICES.map((s) => `${MODEL_SHOT_STYLE_CHOICE_PREFIX}${s.label}`);
      }
      if (sub === "usage") {
        return MODEL_SHOT_USAGE_CHOICES.map((u) => `${MODEL_SHOT_USAGE_CHOICE_PREFIX}${u.label}`);
      }
      if (sub === "count") {
        return MODEL_SHOT_COUNT_CHOICES.map((c) => `${MODEL_SHOT_COUNT_CHOICE_PREFIX}${c.label}`);
      }
      if (sub === "summary") {
        return [posePlanGenerateChoiceLabel(project.brief?.poseCount ?? 6)];
      }
      return [];
    }
    case "poses":
      return project.plan.items.length > 0
        ? ["查看中栏姿势方案", "重新生成姿势方案"]
        : ["生成姿势方案"];
    case "confirm":
      return project.plan.status === "confirmed" ? [] : ["确认姿势计划"];
    case "generate":
      return [];
    default:
      return [];
  }
}

/** 本地跳过步骤时的固定助手回复（不调 LLM） */
export const MODEL_SHOT_SKIP_SCENE_ASSISTANT_REPLY =
  "好的，场景已跳过，出图时由模型自由发挥背景。如需道具可上传或选择；不需要可点「不需要道具」。";

export const MODEL_SHOT_SKIP_PROP_ASSISTANT_REPLY =
  "好的，本次不使用道具。接下来补 **3 项元信息**（风格 → 用途 → 张数），请逐项点选。";

export const MODEL_SHOT_META_STYLE_REPLY =
  "已记录风格。请继续选择 **主要用途**（电商主图 / 种草 / lookbook / 社媒广告）。";

export const MODEL_SHOT_META_USAGE_REPLY =
  "已记录用途。请选择 **姿势张数**（6 张或 8 张）。";

export const MODEL_SHOT_META_COUNT_REPLY = (project: ModelShotProject) =>
  buildModelShotCollectionSummary(project);

export function modelModeAssistantReply(choice: string, projectId: string): string | null {
  if (choice === `${MODEL_SHOT_MODEL_MODE_PREFIX}上传参考图`) {
    return `好的。请在中栏 **模特图** 区域上传参考图，或拖放/粘贴图片。上传完成后我会自动进入第二步。`;
  }
  if (choice === `${MODEL_SHOT_MODEL_MODE_PREFIX}AI推荐虚拟模特`) {
    return `结合服装款式，为您推荐三种虚拟模特风格，请选 1 个：\n\n${formatModelRecommendList()}`;
  }
  if (choice === `${MODEL_SHOT_MODEL_MODE_PREFIX}手写描述`) {
    return `请在下方输入框 **手写描述** 模特外貌、身形与气质；发送后我会锁定为模特参考。`;
  }
  if (choice === `${MODEL_SHOT_MODEL_MODE_PREFIX}从模特库选择`) {
    return `请在中栏模特图区域点击 **「模特库」**，挑选平台模特。选定后我会进入第二步。`;
  }
  if (choice === `${MODEL_SHOT_SCENE_MODE_PREFIX}上传参考图`) {
    return `请在中栏 **场景图** 上传背景参考，或从「我的资产」添加。`;
  }
  if (choice === `${MODEL_SHOT_SCENE_MODE_PREFIX}词库推荐`) {
    return `为您推荐以下场景（含视觉提示词），请选 1 个：\n\n${formatSceneRecommendList(projectId)}`;
  }
  if (choice === `${MODEL_SHOT_SCENE_MODE_PREFIX}跳过场景`) {
    return MODEL_SHOT_SKIP_SCENE_ASSISTANT_REPLY;
  }
  if (choice === `${MODEL_SHOT_SCENE_MODE_PREFIX}AI生成（中栏）`) {
    return `请在中栏场景图区域点击 **「AI生成」**，从内置词库切换提示词后生成场景参考图。`;
  }
  if (choice === `${MODEL_SHOT_PROP_MODE_PREFIX}不需要道具`) {
    return MODEL_SHOT_SKIP_PROP_ASSISTANT_REPLY;
  }
  if (choice === `${MODEL_SHOT_PROP_MODE_PREFIX}上传参考图`) {
    return `请在中栏 **道具图** 上传道具参考。`;
  }
  if (choice === `${MODEL_SHOT_PROP_MODE_PREFIX}词库推荐`) {
    return `结合当前风格，为您推荐以下道具，请选 1 个：\n\n${formatPropRecommendList(projectId)}`;
  }
  if (choice === `${MODEL_SHOT_PROP_MODE_PREFIX}AI生成（中栏）`) {
    return `请在中栏道具图区域点击 **「AI生成」**，从内置词库切换提示词后生成道具参考图。`;
  }
  return null;
}

export function modelArchetypeAssistantReply(archetype: ModelShotModelArchetype): string {
  return `好的，已锁定模特「**${archetype.label}**」。\n\n**第二步 · 关于场景/背景** — 请选择确定方式：`;
}

export function scenePickAssistantReply(name: string): string {
  return `收到，已选定场景「**${name}**」。\n\n**第三步 · 关于手持道具** — 请选择：`;
}

export function propPickAssistantReply(name: string): string {
  return `已选定道具「**${name}**」。\n\n**第四步 · 元信息** — 请先选择 **风格调性**：`;
}

export const MODEL_SHOT_POSE_PLAN_READY_REPLY =
  "姿势方案已生成。\n\n**第六步 · 确认出图** — 请在中栏 **姿势脚本** 核对并编辑，点击「确认计划」后于下方 **模特图** 卡片选择出图。";

export function metaAssistantReplyAfterChoice(choice: string): string | null {
  if (parseMetaStyleChoice(choice)) return MODEL_SHOT_META_STYLE_REPLY;
  if (parseMetaUsageChoice(choice)) return MODEL_SHOT_META_USAGE_REPLY;
  return null;
}

/** 仅自由输入时送 LLM；Choice 点选走本地逻辑 */
export function choicePrompt(choice: string): string {
  if (choice === "生成姿势方案" || choice.startsWith("生成 ") && choice.endsWith("个姿势方案")) {
    return "信息采集已完成，请生成姿势方案并同步到中栏。";
  }
  if (choice === "重新生成姿势方案") return "请重新生成姿势方案。";
  if (choice === "确认姿势计划") return "我已在中栏确认姿势计划，可以出图。";
  return choice;
}

export function modelRefLabel(ref: ModelShotReference | undefined): string {
  if (!ref) return "未选择";
  if (ref.source === "none") return "已跳过";
  if (ref.name) return ref.name;
  if (ref.source === "text" && ref.description) return ref.description.slice(0, 24);
  if (ref.source === "model-library") return "模特库";
  if (ref.ossUrl) return "已上传";
  return "未选择";
}
