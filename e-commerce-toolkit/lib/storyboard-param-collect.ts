import type { StoryboardProject } from "@/lib/storyboard-types";
import { inferProductCategoryFromName } from "@/lib/storyboard-category-infer";
import {
  CHARACTER_PRESET_FEMALE_CHOICE,
  CHARACTER_PRESET_MALE_CHOICE,
} from "@/lib/storyboard-character-presets";
import {
  CUSTOM_SCENE_INPUT_CHOICE,
  getScenePresetChoiceLabels,
} from "@/lib/storyboard-scene-presets";

export type ProductCategoryKey =
  | "home_clean"
  | "beauty"
  | "digital"
  | "food"
  | "fashion"
  | "general";

export const PRODUCT_CATEGORIES: Array<{
  key: ProductCategoryKey;
  label: string;
}> = [
  { key: "home_clean", label: "家清日化" },
  { key: "beauty", label: "美妆护肤" },
  { key: "digital", label: "3C数码" },
  { key: "food", label: "食品饮料" },
  { key: "fashion", label: "服饰鞋包" },
  { key: "general", label: "其他通用" },
];

export const QUICK_GENERATE_CHOICE = "快速生成";
export const CUSTOM_PARAMS_CHOICE = "自定义参数";
export const AUTO_MATCH_CATEGORY_CHOICE = "自动匹配";

export type ParamStepDef = {
  key: string;
  prompt: string;
  options: string[];
};

/** 11 项自定义参数（不含品类 step 0） */
export const PARAM_STEPS: ParamStepDef[] = [
  {
    key: "目标市场",
    prompt: "目标市场是？",
    options: ["中国", "美国", "英国", "越南", "泰国", "其他"],
  },
  {
    key: "脚本语言",
    prompt: "脚本语言是？",
    options: ["中文", "英文", "西班牙语", "泰语", "其他"],
  },
  {
    key: "视频形式",
    prompt: "视频形式是？",
    options: [
      "真人口播",
      "微剧情带货",
      "虚拟达人口播",
      "旁白解说",
      "纯产品展示",
    ],
  },
  {
    key: "剧情方案数量",
    prompt: "需要几套剧情方案？",
    options: ["1套", "2套", "3套"],
  },
  {
    key: "视频时长与镜头数",
    prompt: "视频时长与镜头数是？",
    options: ["10秒/4镜头", "15秒/5镜头", "20秒/6镜头"],
  },
  {
    key: "人物数量",
    prompt: "人物数量是？",
    options: ["1人独白", "2人互动", "3人对比冲突"],
  },
  {
    key: "核心情景",
    prompt: "核心情景是？",
    options: [
      "自动推导",
      "早起通勤",
      "办公室尴尬",
      "约会前急救",
      "家务清洁",
      "厨房翻车",
      "收纳整理",
      "换季穿搭",
      "旅行收纳",
      "送礼场景",
    ],
  },
  {
    key: "剧情模式",
    prompt: "剧情模式是？",
    options: [
      "自动匹配",
      "痛点突发型",
      "对比打脸型",
      "挑战测试型",
      "尴尬救场型",
      "好物分享型",
    ],
  },
  {
    key: "人物UGC人设",
    prompt: "人物 UGC 人设是？",
    options: [
      "本土素人",
      "精致宝妈",
      "都市白领",
      "学生党",
      "专业评测师",
      "其他",
    ],
  },
  {
    key: "产品露出强度",
    prompt: "产品露出强度是？",
    options: ["自然露出", "弱露出", "强特写", "教学式特写"],
  },
  {
    key: "产品信息",
    prompt: "产品信息补充？",
    options: ["无额外产品信息", "沿用产品名作卖点", "输入卖点"],
  },
];

export const SELLPOINT_INPUT_CHOICE = "输入卖点";

const CATEGORY_STEP_PROMPT = "请先选择产品品类（影响脚本情景与痛点侧重）：";

/** 品类 + 11 项 = 12 步 */
export const PARAM_COLLECT_TOTAL_STEPS = 1 + PARAM_STEPS.length;

const SYSTEM_USER_TEXT_FILTERS = [
  QUICK_GENERATE_CHOICE,
  CUSTOM_PARAMS_CHOICE,
  AUTO_MATCH_CATEGORY_CHOICE,
  CUSTOM_SCENE_INPUT_CHOICE,
  "参数已确认",
  "按默认方案A",
  "场景参考已确认",
  ...PRODUCT_CATEGORIES.map((c) => c.label),
  ...getScenePresetChoiceLabels(),
  "已上传场景图",
  "已上传角色图",
  CHARACTER_PRESET_FEMALE_CHOICE,
  CHARACTER_PRESET_MALE_CHOICE,
  "是，自动生成角色",
];

export type DurationShotSpec = {
  paramLabel: string;
  totalSec: number;
  panelCount: number;
};

export function resolveDurationShotSpec(durationSec: number): DurationShotSpec {
  if (durationSec <= 10) {
    return { paramLabel: "10秒/4镜头", totalSec: 10, panelCount: 4 };
  }
  return { paramLabel: "15秒/5镜头", totalSec: 15, panelCount: 5 };
}

export function quickDefaultParams(durationSec: number): Record<string, string> {
  const spec = resolveDurationShotSpec(durationSec);
  return {
    目标市场: "中国",
    脚本语言: "中文",
    视频形式: "微剧情带货",
    剧情方案数量: "3套",
    视频时长与镜头数: spec.paramLabel,
    人物数量: "1人独白",
    核心情景: "自动推导",
    剧情模式: "自动匹配",
    人物UGC人设: "本土素人",
    视频风格: "素人UGC",
    产品露出强度: "自然露出",
    产品信息: "沿用产品名作卖点",
  };
}

function resolveDurationSec(
  project: StoryboardProject,
  opts?: { durationSec?: number },
): number {
  if (typeof opts?.durationSec === "number") return opts.durationSec;
  const fromSettings = project.settings?.durationSec;
  if (typeof fromSettings === "number") return fromSettings;
  return 15;
}

export function inferProductNameFromChat(project: StoryboardProject): string {
  const firstUser = project.chatHistory.find(
    (m) =>
      m.role === "user" &&
      m.content.trim() &&
      !SYSTEM_USER_TEXT_FILTERS.some((x) => m.content.includes(x)) &&
      !m.content.startsWith("参数已确认"),
  );
  return firstUser?.content.trim().slice(0, 120) ?? "";
}

export function hasProductName(project: StoryboardProject): boolean {
  return inferProductNameFromChat(project).length > 0;
}

export function getCategoryChoiceLabels(): string[] {
  return [AUTO_MATCH_CATEGORY_CHOICE, ...PRODUCT_CATEGORIES.map((c) => c.label)];
}

export function isAutoMatchCategoryChoice(text: string): boolean {
  return text === AUTO_MATCH_CATEGORY_CHOICE;
}

export function isCategoryChoiceLabel(text: string): boolean {
  return PRODUCT_CATEGORIES.some((c) => c.label === text);
}

function categoryKeyFromLabel(label: string): ProductCategoryKey | null {
  const hit = PRODUCT_CATEGORIES.find((c) => c.label === label);
  return hit?.key ?? null;
}

export function isAwaitingCategory(project: StoryboardProject): boolean {
  if (isParamCollecting(project)) return false;
  if (project.meta?.workflow?.productCategory) return false;
  if (
    project.meta?.deliverable?.analysis ||
    project.meta?.deliverable?.schemes?.length ||
    project.sheet
  ) {
    return false;
  }
  return hasProductName(project);
}

export function buildStoryboardLlmUserMessage(
  project: StoryboardProject,
  opts?: { durationSec?: number },
): string {
  const wf = project.meta?.workflow ?? {};
  const params = wf.collectedParams ?? {};
  const category = wf.productCategory ?? "general";
  const productName = inferProductNameFromChat(project);
  const durationSec = resolveDurationSec(project, opts);
  const spec = resolveDurationShotSpec(durationSec);
  const stylePref = params["视频风格"]?.trim() || "素人UGC";
  const exposure = params["产品露出强度"]?.trim() || "自然露出";
  const paramLine = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("；");

  return [
    `参数已确认 | 产品名：${productName || "（见对话上文）"} | 品类分支：${category} | 时长：${spec.totalSec}秒 | 风格偏好：${stylePref} | 产品露出强度：${exposure}`,
    "",
    "请一次性生成完整策划交付（表1–3 + 三套分镜 + storyboard-deliverable JSON），勿再追问参数。",
    "",
    "【硬性生成约束】",
    `1. 表1–3 与三套分镜必须严格匹配品类分支 ${category} 的专属情景池、痛点侧重、钩子类型、口播语气与视觉风格，禁止跨品类复用模板`,
    `2. 分镜总时长 ${spec.totalSec} 秒、共 ${spec.panelCount} 镜，时间轴须连续覆盖全片，不得随意改镜头数与总时长`,
    "3. 每镜「画面内容」须可实拍：写清具体场景（如卧室衣柜前/羽毛球馆）+ 人物动作 + 产品介入方式，禁止仅写抽象情绪词",
    "4. storyboard-deliverable 中 productName 必须是用户产品名，禁止使用方案标题（如「方案一：痛点救场型」）",
    "5. 画面内容须来自本品类的情景池，不得出现其他品类的典型场景或动作",
    "",
    "【JSON 字段】",
    "必须使用：index, timeline, shotType, camera, scene, action, emotion, dialogue, durationHintSec, totalDurationHintSec",
    "analysis 须含 audienceMarkdown、painPointsMarkdown、strategiesMarkdown（三张表的 Markdown 原文）",
    "禁止使用：shotId, visualDescription, voiceover, timeStartSec, schemeId",
    "",
    "【完整参数】",
    paramLine || "（快速生成默认参数）",
  ].join("\n");
}

/** @deprecated 使用 buildStoryboardLlmUserMessage */
export function formatParamsForLlm(
  project: StoryboardProject,
  opts?: { durationSec?: number },
): string {
  return buildStoryboardLlmUserMessage(project, opts);
}

export function isParamCollecting(project: StoryboardProject): boolean {
  return Boolean(project.meta?.workflow?.paramCollecting);
}

export function isAwaitingSellpointInput(project: StoryboardProject): boolean {
  return Boolean(project.meta?.workflow?.paramAwaitingSellpoint);
}

export function canTextInputDuringParamCollect(project: StoryboardProject): boolean {
  return isAwaitingSellpointInput(project);
}

export function getParamStep(project: StoryboardProject): number {
  return project.meta?.workflow?.paramStep ?? 0;
}

export function getStepPrompt(step: number): string {
  if (step === 0) return CATEGORY_STEP_PROMPT;
  const def = PARAM_STEPS[step - 1];
  return def?.prompt ?? "";
}

export function getChoicesForStep(project: StoryboardProject): string[] {
  if (isAwaitingSellpointInput(project)) return [];
  const step = getParamStep(project);
  if (step === 0) {
    return getCategoryChoiceLabels();
  }
  const def = PARAM_STEPS[step - 1];
  return def?.options ?? [];
}

function paramKeyForStep(step: number): string | null {
  if (step < 1 || step > PARAM_STEPS.length) return null;
  return PARAM_STEPS[step - 1]!.key;
}

export type AdvanceParamResult = {
  workflowPatch: Record<string, unknown>;
  assistantReply: string;
  completed: boolean;
  llmUserMessage?: string;
};

function categoryLabelFromKey(key: ProductCategoryKey): string {
  return PRODUCT_CATEGORIES.find((c) => c.key === key)?.label ?? "其他通用";
}

export function completeAutoMatchCategory(
  project: StoryboardProject,
  opts?: { duringParamCollect?: boolean },
): AdvanceParamResult | null {
  const name = inferProductNameFromChat(project);
  if (!name) return null;
  const key = inferProductCategoryFromName(name);
  const label = categoryLabelFromKey(key);
  const wf = project.meta?.workflow ?? {};
  const collected = {
    ...(wf.collectedParams ?? {}),
    品类: `${label}（自动匹配）`,
  };

  if (opts?.duringParamCollect) {
    return {
      workflowPatch: {
        paramStep: 1,
        productCategory: key,
        collectedParams: collected,
        categoryAutoMatched: true,
      },
      assistantReply: `已根据产品名「${name}」自动匹配品类：${label}。\n${getStepPrompt(1)}`,
      completed: false,
    };
  }

  return {
    workflowPatch: {
      productCategory: key,
      collectedParams: collected,
      categoryAutoMatched: true,
    },
    assistantReply: `已根据产品名「${name}」自动匹配品类：${label}。\n请选择生成方式：`,
    completed: false,
  };
}

export function selectProductCategory(
  project: StoryboardProject,
  label: string,
): AdvanceParamResult | null {
  const key = categoryKeyFromLabel(label);
  if (!key) return null;
  const wf = project.meta?.workflow ?? {};
  const collected = { ...(wf.collectedParams ?? {}), 品类: label };
  return {
    workflowPatch: {
      productCategory: key,
      collectedParams: collected,
    },
    assistantReply: `已选品类：${label}。请选择生成方式：`,
    completed: false,
  };
}

export function completeQuickGenerate(
  project: StoryboardProject,
  durationSec: number,
): AdvanceParamResult {
  const wf = project.meta?.workflow ?? {};
  const categoryLabel =
    wf.collectedParams?.品类 ??
    PRODUCT_CATEGORIES.find((c) => c.key === wf.productCategory)?.label ??
    "其他通用";
  const collected = {
    ...(wf.collectedParams ?? {}),
    品类: categoryLabel,
    ...quickDefaultParams(durationSec),
  };
  const patchedProject: StoryboardProject = {
    ...project,
    meta: {
      ...project.meta,
      workflow: {
        ...wf,
        productCategory: wf.productCategory ?? "general",
        collectedParams: collected,
        planMode: "quick",
      },
    },
  };
  return {
    workflowPatch: {
      collectedParams: collected,
      planMode: "quick",
      paramCollecting: false,
    },
    assistantReply: "正在根据品类与默认参数生成全品类分镜脚本（表1–3 + 三套方案）…",
    completed: true,
    llmUserMessage: buildStoryboardLlmUserMessage(patchedProject, { durationSec }),
  };
}

export function advanceParamStep(
  project: StoryboardProject,
  choice: string,
): AdvanceParamResult | null {
  const wf = project.meta?.workflow ?? {};
  const step = wf.paramStep ?? 0;
  const collected = { ...(wf.collectedParams ?? {}) };

  if (step === 0) {
    if (choice === AUTO_MATCH_CATEGORY_CHOICE) {
      return completeAutoMatchCategory(project, { duringParamCollect: true });
    }
    const key = categoryKeyFromLabel(choice);
    if (!key) return null;
    const nextPrompt = getStepPrompt(1);
    return {
      workflowPatch: {
        paramStep: 1,
        productCategory: key,
        collectedParams: { ...collected, 品类: choice },
      },
      assistantReply: `已选品类：${choice}。\n${nextPrompt}`,
      completed: false,
    };
  }

  const paramKey = paramKeyForStep(step);
  if (!paramKey) return null;
  const def = PARAM_STEPS[step - 1];
  if (!def?.options.includes(choice)) return null;

  if (choice === SELLPOINT_INPUT_CHOICE) {
    return {
      workflowPatch: { paramAwaitingSellpoint: true },
      assistantReply:
        "请简短输入产品卖点（品牌、价格、优惠、核心卖点等，一行即可）：",
      completed: false,
    };
  }

  collected[paramKey] = choice;
  const nextStep = step + 1;

  if (nextStep <= PARAM_STEPS.length) {
    return {
      workflowPatch: {
        paramStep: nextStep,
        collectedParams: collected,
      },
      assistantReply: `已记录「${paramKey}」：${choice}。\n${getStepPrompt(nextStep)}`,
      completed: false,
    };
  }

  const patchedProject: StoryboardProject = {
    ...project,
    meta: {
      ...project.meta,
      workflow: {
        ...wf,
        collectedParams: collected,
        productCategory: wf.productCategory,
        planMode: "custom",
      },
    },
  };

  return {
    workflowPatch: {
      paramCollecting: false,
      paramAwaitingSellpoint: false,
      paramStep: nextStep,
      collectedParams: collected,
      planMode: "custom",
    },
    assistantReply:
      "参数已全部确认，正在根据你的选择生成全品类分镜脚本（表1–3 + 三套方案）…",
    completed: true,
    llmUserMessage: buildStoryboardLlmUserMessage(patchedProject),
  };
}

export function startCustomParamCollectPatch(
  project?: StoryboardProject,
): Record<string, unknown> {
  const wf = project?.meta?.workflow ?? {};
  const hasCategory = Boolean(wf.productCategory);
  const collected = hasCategory
    ? { ...(wf.collectedParams ?? {}) }
    : {};
  return {
    paramCollecting: true,
    paramStep: hasCategory ? 1 : 0,
    collectedParams: collected,
    productCategory: wf.productCategory,
    planMode: "custom",
  };
}

export function completeSellpointInput(
  project: StoryboardProject,
  sellpoint: string,
): AdvanceParamResult | null {
  const text = sellpoint.trim();
  if (!text) return null;
  const wf = project.meta?.workflow ?? {};
  const step = wf.paramStep ?? 0;
  if (step !== PARAM_STEPS.length || !wf.paramAwaitingSellpoint) return null;

  const collected = { ...(wf.collectedParams ?? {}), 产品信息: text };
  const nextStep = step + 1;
  const patchedProject: StoryboardProject = {
    ...project,
    meta: {
      ...project.meta,
      workflow: {
        ...wf,
        collectedParams: collected,
        productCategory: wf.productCategory,
        planMode: "custom",
      },
    },
  };

  return {
    workflowPatch: {
      paramCollecting: false,
      paramAwaitingSellpoint: false,
      paramStep: nextStep,
      collectedParams: collected,
      planMode: "custom",
    },
    assistantReply:
      "参数已全部确认，正在根据你的选择生成全品类分镜脚本（表1–3 + 三套方案）…",
    completed: true,
    llmUserMessage: buildStoryboardLlmUserMessage(patchedProject),
  };
}

export function resetParamCollectPatch(): Record<string, unknown> {
  return {
    paramCollecting: false,
    paramAwaitingSellpoint: false,
    paramStep: undefined,
    collectedParams: undefined,
    productCategory: undefined,
    planMode: undefined,
  };
}

export function isParamCollectChoice(project: StoryboardProject, text: string): boolean {
  if (!isParamCollecting(project)) return false;
  return getChoicesForStep(project).includes(text);
}
