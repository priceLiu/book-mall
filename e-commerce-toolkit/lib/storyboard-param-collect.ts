import type { StoryboardProject } from "@/lib/storyboard-types";

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

export function isParamCollecting(project: StoryboardProject): boolean {
  return Boolean(project.meta?.workflow?.paramCollecting);
}

export function isAwaitingSellpointInput(project: StoryboardProject): boolean {
  return Boolean(project.meta?.workflow?.paramAwaitingSellpoint);
}

/** 参数收集中是否允许文字输入（仅「输入卖点」步骤） */
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
    return PRODUCT_CATEGORIES.map((c) => c.label);
  }
  const def = PARAM_STEPS[step - 1];
  return def?.options ?? [];
}

function categoryKeyFromLabel(label: string): ProductCategoryKey | null {
  const hit = PRODUCT_CATEGORIES.find((c) => c.label === label);
  return hit?.key ?? null;
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

export function advanceParamStep(
  project: StoryboardProject,
  choice: string,
): AdvanceParamResult | null {
  const wf = project.meta?.workflow ?? {};
  const step = wf.paramStep ?? 0;
  const collected = { ...(wf.collectedParams ?? {}) };

  if (step === 0) {
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
    llmUserMessage: formatParamsForLlm({
      ...project,
      meta: {
        ...project.meta,
        workflow: {
          ...wf,
          collectedParams: collected,
          productCategory: wf.productCategory,
        },
      },
    }),
  };
}

export function formatParamsForLlm(project: StoryboardProject): string {
  const wf = project.meta?.workflow ?? {};
  const params = wf.collectedParams ?? {};
  const parts = Object.entries(params).map(([k, v]) => `${k}=${v}`);
  const category = wf.productCategory ?? "general";
  const productName = inferProductNameFromChat(project);
  return [
    "参数已确认，请一次性生成完整策划交付（表1–3 + 三套分镜 + storyboard-deliverable JSON），勿再追问参数。",
    `产品名：${productName || "（见对话上文）"}`,
    `品类分支：${category}`,
    `参数：${parts.join("；")}`,
  ].join("\n");
}

function inferProductNameFromChat(project: StoryboardProject): string {
  const firstUser = project.chatHistory.find(
    (m) =>
      m.role === "user" &&
      m.content.trim() &&
      !["按默认方案A", "自定义参数", "参数已确认"].some((x) =>
        m.content.includes(x),
      ),
  );
  return firstUser?.content.trim().slice(0, 120) ?? "";
}

export function startCustomParamCollectPatch(): Record<string, unknown> {
  return {
    paramCollecting: true,
    paramStep: 0,
    collectedParams: {},
    productCategory: undefined,
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
    llmUserMessage: formatParamsForLlm({
      ...project,
      meta: {
        ...project.meta,
        workflow: {
          ...wf,
          collectedParams: collected,
          productCategory: wf.productCategory,
        },
      },
    }),
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
