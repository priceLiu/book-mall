import type {
  EcomPlatformSpec,
  ProductDesign,
  ProductDesignBrief,
  ProductDesignMainImage,
  ProductDesignProject,
} from "@/lib/product-design-types";
import { buildProductDesignPromptMentionRefs } from "@/lib/product-design-mention-refs";
import { hasProductRef } from "@/lib/product-design-ref-rules";
import {
  isAwaitingMarketingPlanSelection,
  parseMarketingPlansFromMarkdown,
} from "@/lib/product-design-marketing-parse";

export type ProductDesignStepId =
  | "brief"
  | "analysis"
  | "marketing"
  | "reasons"
  | "main-copy"
  | "main-image"
  | "detail-outline"
  | "detail-copy"
  | "detail-image";

export type SetupPhase = "product" | "style-ref" | "workflow-choice" | "platform" | "done";

export type MainWorkflowPath = "interactive" | "reference-prompt";
export type DetailWorkflowPath = "interactive" | "reference-decompose";

export type BriefSuggestField =
  | "productName"
  | "targetUserGroup"
  | "mainPainPoint"
  | "productCoreAdvantage";

export type BriefSuggestions = Partial<Record<BriefSuggestField, string[]>>;

export const PRODUCT_DESIGN_STEPS: Array<{
  id: ProductDesignStepId;
  label: string;
  short: string;
}> = [
  { id: "brief", label: "信息采集", short: "采" },
  { id: "analysis", label: "平台拆解", short: "拆" },
  { id: "marketing", label: "营销方案", short: "案" },
  { id: "reasons", label: "购买理由", short: "由" },
  { id: "main-copy", label: "主图文案", short: "文" },
  { id: "main-image", label: "主图出图", short: "图" },
  { id: "detail-outline", label: "详情架构", short: "构" },
  { id: "detail-copy", label: "分屏文案", short: "屏" },
  { id: "detail-image", label: "详情出图", short: "详" },
];

export type StepVisual = "done" | "active" | "pending";

export function hasMainStyleRef(references: ProductDesignProject["references"]): boolean {
  return references.some((r) => r.role === "main-style");
}

export function hasDetailStyleRef(references: ProductDesignProject["references"]): boolean {
  return references.some((r) => r.role === "detail-style");
}

export function isFastMainPath(project: ProductDesignProject): boolean {
  return (
    project.meta?.mainWorkflowPath === "reference-prompt" ||
    project.settings.mainImageGenMode === "reference-prompt"
  );
}

export function isFastDetailPath(project: ProductDesignProject): boolean {
  return (
    project.meta?.detailWorkflowPath === "reference-decompose" ||
    project.settings.detailPageGenMode === "reference-decompose"
  );
}

export function shouldSkipBrief(project: ProductDesignProject): boolean {
  return Boolean(project.meta?.briefSkipped) || isFastMainPath(project);
}

export function emptyProductDesignShell(): ProductDesign {
  return {
    marketingPlans: [],
    buyingReasons: [],
    mainImages: [],
    detailOutline: [],
    detailPages: [],
  };
}

/** 快速主图路径：仅建空槽位，跳过 Step4 文案 */
export function bootstrapFastMainDesignPatch(mainCount: number): Partial<ProductDesign> {
  const base = emptyProductDesignShell();
  return {
    mainImages: resizeMainImageSlots({ ...base, mainImages: [] }, mainCount),
  };
}

export function resolveProductDesignStepStates(
  project: ProductDesignProject,
): Record<ProductDesignStepId, StepVisual> {
  const design = project.design;
  const fastMain = isFastMainPath(project);
  const briefDone = shouldSkipBrief(project) || Boolean(project.brief?.productName?.trim());
  const done: Record<ProductDesignStepId, boolean> = {
    brief: briefDone,
    analysis: fastMain ? briefDone : Boolean(design?.analysis),
    marketing: fastMain ? briefDone : (design?.marketingPlans.length ?? 0) > 0,
    reasons: fastMain ? briefDone : (design?.buyingReasons.length ?? 0) > 0,
    "main-copy": fastMain
      ? (design?.mainImages.length ?? 0) > 0
      : (design?.mainImages.length ?? 0) > 0,
    "main-image": Boolean(
      design?.mainImages.length && design.mainImages.every((m) => m.imageUrl),
    ),
    "detail-outline": (design?.detailOutline.length ?? 0) > 0,
    "detail-copy": (design?.detailPages.length ?? 0) > 0,
    "detail-image": Boolean(
      design?.detailPages.length && design.detailPages.every((d) => d.imageUrl),
    ),
  };

  const active = PRODUCT_DESIGN_STEPS.find((s) => !done[s.id])?.id ?? "detail-image";

  const out = {} as Record<ProductDesignStepId, StepVisual>;
  for (const step of PRODUCT_DESIGN_STEPS) {
    out[step.id] = done[step.id] ? "done" : step.id === active ? "active" : "pending";
  }
  return out;
}

export function resolveSetupPhase(project: ProductDesignProject): SetupPhase {
  const meta = project.meta ?? {};
  const stored = meta.setupPhase;
  if (
    stored === "product" ||
    stored === "style-ref" ||
    stored === "workflow-choice" ||
    stored === "platform" ||
    stored === "done"
  ) {
    if (stored === "product" && hasProductRef(project.references)) return "style-ref";
    if (stored === "style-ref" && meta.styleRefSkipped) return "platform";
    if (stored === "style-ref" && meta.styleRefDone) {
      return meta.mainWorkflowPath ? "platform" : "workflow-choice";
    }
    if (stored === "workflow-choice" && !meta.mainWorkflowPath) return "workflow-choice";
    if (stored === "workflow-choice" && meta.mainWorkflowPath) return "platform";
    if (stored === "platform" && project.meta?.platformConfirmed) return "done";
    return stored;
  }
  if (!hasProductRef(project.references)) return "product";
  if (project.meta?.platformConfirmed) return "done";
  if (!meta.styleRefSkipped && !meta.styleRefDone) return "style-ref";
  if (hasMainStyleRef(project.references) && !meta.mainWorkflowPath) return "workflow-choice";
  if (!project.meta?.platformConfirmed) return "platform";
  return "done";
}

export function readBriefSuggestions(project: ProductDesignProject): BriefSuggestions {
  const raw = project.meta?.briefSuggestions;
  if (!raw || typeof raw !== "object") return {};
  return raw as BriefSuggestions;
}

function trustBadgeFilled(brief: ProductDesignBrief | null): boolean {
  const v = brief?.hasTrustBadge;
  if (Array.isArray(v)) return v.length > 0;
  return String(v ?? "").trim().length > 0;
}

function multiBriefFieldFilled(brief: ProductDesignBrief | null, key: keyof ProductDesignBrief): boolean {
  const v = brief?.[key];
  if (Array.isArray(v)) return v.length > 0;
  return String(v ?? "").trim().length > 0;
}

function briefFieldFilled(brief: ProductDesignBrief | null, key: keyof ProductDesignBrief): boolean {
  if (key === "hasTrustBadge") return trustBadgeFilled(brief);
  if (key === "mainPainPoint" || key === "productCoreAdvantage") {
    return multiBriefFieldFilled(brief, key);
  }
  return String(brief?.[key] ?? "").trim().length > 0;
}

/** Step0 表单字段，顺序即采集顺序 */
export const BRIEF_FIELDS: Array<{
  key: keyof ProductDesignBrief;
  label: string;
  prompt: string;
  options?: string[];
  aiInferrable?: boolean;
  multiSelect?: boolean;
  freeText?: boolean;
  placeholder?: string;
}> = [
  {
    key: "productName",
    label: "产品名",
    prompt: "请选择产品名称（AI 已根据主图推断，也可自己输入）：",
    aiInferrable: true,
    freeText: true,
    placeholder: "请输入产品名称…",
  },
  {
    key: "productCategory",
    label: "产品大类",
    prompt: "请选择产品大类：",
    options: [
      "实物商品",
      "虚拟课程",
      "服务型产品",
      "软件工具",
      "食品饮料",
      "美妆护肤",
      "服饰鞋包",
      "3C 数码",
      "家清日化",
    ],
  },
  {
    key: "targetUserGroup",
    label: "核心目标人群",
    prompt: "请选择核心目标人群（AI 已根据主图推断，也可自己输入）：",
    aiInferrable: true,
    freeText: true,
    placeholder: "请描述目标人群…",
  },
  {
    key: "mainPainPoint",
    label: "核心痛点",
    prompt: "请选择用户核心痛点（可多选，AI 已根据主图推断；也可点「自己输入」）：",
    aiInferrable: true,
    multiSelect: true,
    freeText: true,
    placeholder: "请输入痛点，多条用换行分隔…",
  },
  {
    key: "productCoreAdvantage",
    label: "产品核心优势",
    prompt: "请选择产品差异化优势（可多选，AI 已根据主图推断；也可点「自己输入」）：",
    aiInferrable: true,
    multiSelect: true,
    freeText: true,
    placeholder: "请输入优势，多条用换行分隔…",
  },
  {
    key: "deliveryType",
    label: "交付形式",
    prompt: "请选择交付形式：",
    options: ["实物快递", "线上即时交付", "线下服务", "混合交付"],
  },
  {
    key: "hasTrustBadge",
    label: "信任背书",
    prompt: "请选择信任背书（可多选，选完后点「确认背书」）：",
    multiSelect: true,
    options: ["有权威认证", "有销量口碑", "有媒体背书", "暂无背书"],
  },
];

export function nextBriefField(brief: ProductDesignBrief | null) {
  return BRIEF_FIELDS.find((f) => !briefFieldFilled(brief, f.key)) ?? null;
}

export function briefComplete(brief: ProductDesignBrief | null): boolean {
  return nextBriefField(brief) === null;
}

export const PLATFORM_CHOICE_PREFIX = "平台：";
export const MAIN_COUNT_CHOICE_PREFIX = "主图：";
export const DETAIL_COUNT_CHOICE_PREFIX = "详情：";

export function platformChoiceLabel(spec: EcomPlatformSpec): string {
  return `${PLATFORM_CHOICE_PREFIX}${spec.label}`;
}

export function parsePlatformChoice(
  text: string,
  specs: EcomPlatformSpec[],
): EcomPlatformSpec | null {
  if (!text.startsWith(PLATFORM_CHOICE_PREFIX)) return null;
  const label = text.slice(PLATFORM_CHOICE_PREFIX.length).trim();
  return specs.find((s) => s.label === label) ?? null;
}

export function countChoices(min: number, max: number, recommended: number): number[] {
  const all: number[] = [];
  for (let n = min; n <= max; n++) all.push(n);
  return [recommended, ...all.filter((n) => n !== recommended)];
}

export function parseCountChoice(text: string, prefix: string): number | null {
  if (!text.startsWith(prefix)) return null;
  const n = Number.parseInt(text.slice(prefix.length).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const NEXT_STEP_CHOICE = "下一步";
export const REVISE_CHOICE = "修改当前步";
export const CUSTOM_INPUT_CHOICE = "自己输入";
export const SKIP_STYLE_REF_CHOICE = "跳过，直接选平台";
export const INTERACTIVE_WORKFLOW_CHOICE = "完整助手流程（Step1–9）";
export const MAIN_REF_PROMPT_WORKFLOW_CHOICE = "参考图 + 自定义 Prompt（快速主图）";
export const DETAIL_INTERACTIVE_CHOICE = "助手规划详情（Step7-8）";
export const DETAIL_DECOMPOSE_CHOICE = "参考详情页拆解出图";
export const ANALYZE_DETAIL_DECOMPOSE_CHOICE = "分析并拆解详情页";
export const CONFIRM_BRIEF_MULTI_CHOICE = "确认选择";
export const CONFIRM_TRUST_BADGE_CHOICE = "确认背书";
export const NO_TRUST_BADGE_CHOICE = "暂无背书";
export const REGENERATE_MARKETING_PLANS_CHOICE = "重新生成三套方案";
export const GENERATE_MAIN_IMAGES_CHOICE = "生成全部主图";
export const GENERATE_DETAIL_IMAGES_CHOICE = "生成全部详情屏";
export const ENTER_DETAIL_PAGE_CHOICE = "进入详情页制作";

export const REVISE_DIMENSION_CHOICES = [
  "修改：核心目标人群",
  "修改：痛点与优势",
  "修改：视觉调性",
  "修改：平台策略侧重",
] as const;

export const MARKETING_PLAN_CHOICE_PREFIX = "方案 ";

export function marketingPlanChoiceLabel(no: number): string {
  return `${MARKETING_PLAN_CHOICE_PREFIX}${no}`;
}

export function parseMarketingPlanChoice(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(MARKETING_PLAN_CHOICE_PREFIX)) return null;
  const n = Number.parseInt(trimmed.slice(MARKETING_PLAN_CHOICE_PREFIX.length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isReviseDimensionChoice(text: string): boolean {
  return (REVISE_DIMENSION_CHOICES as readonly string[]).includes(text);
}

export function isTrustBadgeOption(text: string): boolean {
  const field = BRIEF_FIELDS.find((f) => f.key === "hasTrustBadge");
  return field?.options?.includes(text) ?? false;
}

export function isBriefMultiToggleOption(
  project: ProductDesignProject,
  text: string,
): boolean {
  const field = nextBriefField(project.brief);
  if (!field?.multiSelect || field.key === "hasTrustBadge") return false;
  if (field.options?.includes(text)) return true;
  if (!field.aiInferrable) return false;
  const suggestions = readBriefSuggestions(project)[field.key as BriefSuggestField] ?? [];
  return suggestions.includes(text);
}

export function isPrimaryBriefAction(text: string): boolean {
  return (
    text === CONFIRM_BRIEF_MULTI_CHOICE ||
    text === CONFIRM_TRUST_BADGE_CHOICE ||
    text === NO_TRUST_BADGE_CHOICE
  );
}

function choicesForBriefField(
  project: ProductDesignProject,
  field: (typeof BRIEF_FIELDS)[number],
): string[] {
  if (field.multiSelect && field.key === "hasTrustBadge") {
    const opts = (field.options ?? []).filter((o) => o !== NO_TRUST_BADGE_CHOICE && o !== "暂无背书");
    return [...opts, NO_TRUST_BADGE_CHOICE, CONFIRM_TRUST_BADGE_CHOICE];
  }
  if (field.multiSelect && field.aiInferrable) {
    const suggestions = readBriefSuggestions(project)[field.key as BriefSuggestField] ?? [];
    return [...suggestions, CUSTOM_INPUT_CHOICE, CONFIRM_BRIEF_MULTI_CHOICE];
  }
  if (field.multiSelect) {
    return [...(field.options ?? []), CONFIRM_BRIEF_MULTI_CHOICE];
  }
  if (field.options) return field.options;
  if (field.aiInferrable) {
    const suggestions = readBriefSuggestions(project)[field.key as BriefSuggestField] ?? [];
    return [...suggestions, CUSTOM_INPUT_CHOICE];
  }
  return field.freeText ? [CUSTOM_INPUT_CHOICE] : [];
}

/** 聊天已推进到张数/屏数确认，但 meta 尚未落库时的兜底 */
function inferPendingCountStepFromChat(
  project: ProductDesignProject,
): "main" | "detail" | null {
  if (project.meta?.countsConfirmed) return null;
  const last = [...project.chatHistory].reverse().find((m) => m.role === "assistant");
  if (!last?.content) return null;
  const c = last.content;
  if (/详情页屏数|详情页定为|请确认详情|详情页建议/.test(c)) return "detail";
  if (project.meta?.mainCountConfirmed) return "detail";
  if (/主图建议|请确认主图|主图张数|主图定为/.test(c) && !/详情页屏数/.test(c)) return "main";
  return null;
}

function marketingPlanChoices(project: ProductDesignProject): string[] {
  const plans = project.design?.marketingPlans ?? [];
  if (plans.length > 0) {
    return [
      ...plans.map((p) => marketingPlanChoiceLabel(p.no)),
      REGENERATE_MARKETING_PLANS_CHOICE,
      REVISE_CHOICE,
    ];
  }
  if (isAwaitingMarketingPlanSelection(project)) {
    return [
      marketingPlanChoiceLabel(1),
      marketingPlanChoiceLabel(2),
      marketingPlanChoiceLabel(3),
      REGENERATE_MARKETING_PLANS_CHOICE,
      REVISE_CHOICE,
    ];
  }
  return [];
}

/** 按当前进度推断助手气泡内的快捷选项 */
export function inferProductDesignChoices(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): string[] {
  const phase = resolveSetupPhase(project);

  if (phase === "product") return [];
  if (phase === "style-ref") return [SKIP_STYLE_REF_CHOICE];
  if (phase === "workflow-choice") {
    return hasMainStyleRef(project.references)
      ? [INTERACTIVE_WORKFLOW_CHOICE, MAIN_REF_PROMPT_WORKFLOW_CHOICE]
      : [INTERACTIVE_WORKFLOW_CHOICE];
  }

  if (phase === "platform" || !project.meta?.platformConfirmed) {
    return specs.map(platformChoiceLabel);
  }

  const brief = project.brief;
  const spec = specs.find((s) => s.code === project.platform);

  const chatCountStep = inferPendingCountStepFromChat(project);
  const needMainCount =
    spec && !project.meta?.mainCountConfirmed && chatCountStep !== "detail";
  if (needMainCount) {
    return countChoices(
      spec.mainImage.min,
      spec.mainImage.max,
      spec.mainImage.recommended,
    ).map((n) => `${MAIN_COUNT_CHOICE_PREFIX}${n} 张`);
  }
  if (spec && !project.meta?.countsConfirmed) {
    return countChoices(
      spec.detailPage.min,
      spec.detailPage.max,
      spec.detailPage.recommended,
    ).map((n) => `${DETAIL_COUNT_CHOICE_PREFIX}${n} 屏`);
  }

  if (project.meta?.reviseMode) {
    return [...REVISE_DIMENSION_CHOICES, NEXT_STEP_CHOICE];
  }

  if (!shouldSkipBrief(project)) {
    const field = nextBriefField(brief);
    if (field) return choicesForBriefField(project, field);
  }

  const design = project.design;
  if (!design) {
    const marketingChoices = marketingPlanChoices(project);
    if (marketingChoices.length) return marketingChoices;
    return [NEXT_STEP_CHOICE];
  }

  if (design.selectedPlanNo == null) {
    const marketingChoices = marketingPlanChoices(project);
    if (marketingChoices.length) return marketingChoices;
  }

  if (design.marketingPlans.length > 0 && design.selectedPlanNo != null) {
    /* fall through to next steps */
  } else if (design.marketingPlans.length > 0 && design.selectedPlanNo == null) {
    return [
      ...design.marketingPlans.map((p) => marketingPlanChoiceLabel(p.no)),
      REGENERATE_MARKETING_PLANS_CHOICE,
      REVISE_CHOICE,
    ];
  }

  if (design.mainImages.length > 0 && !design.mainImages.every((m) => m.imageUrl)) {
    return [GENERATE_MAIN_IMAGES_CHOICE, NEXT_STEP_CHOICE, REVISE_CHOICE];
  }
  if (
    design.mainImages.length > 0 &&
    design.mainImages.every((m) => m.imageUrl) &&
    design.detailOutline.length === 0
  ) {
    if (!project.meta?.detailWorkflowPath) {
      return [DETAIL_INTERACTIVE_CHOICE, DETAIL_DECOMPOSE_CHOICE, REVISE_CHOICE];
    }
    if (isFastDetailPath(project) && design.detailPages.length === 0) {
      return [ANALYZE_DETAIL_DECOMPOSE_CHOICE, REVISE_CHOICE];
    }
    return [ENTER_DETAIL_PAGE_CHOICE, NEXT_STEP_CHOICE, REVISE_CHOICE];
  }
  if (design.detailPages.length > 0 && !design.detailPages.every((d) => d.imageUrl)) {
    return [GENERATE_DETAIL_IMAGES_CHOICE, NEXT_STEP_CHOICE, REVISE_CHOICE];
  }
  return [NEXT_STEP_CHOICE, REVISE_CHOICE];
}

/** 当前步骤的提示语，展示在选项上方 */
export function choicePrompt(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): string {
  const phase = resolveSetupPhase(project);

  if (phase === "product") {
    return "请先在上方上传至少 1 张产品实拍图（必传）。";
  }
  if (phase === "style-ref") {
    return "可选：在上方上传主图风格参考图；不需要可点「跳过，直接选平台」。";
  }
  if (phase === "workflow-choice") {
    return hasMainStyleRef(project.references)
      ? "请选择主图制作方式：完整助手流程，或参考图 + 自定义 Prompt 快速出主图。"
      : "请先选择完整助手流程（上传风格参考后可走快速主图路径）。";
  }
  if (phase === "platform" || !project.meta?.platformConfirmed) {
    return "请选择商品要上架的平台：";
  }

  const spec = specs.find((s) => s.code === project.platform);
  const chatCountStep = inferPendingCountStepFromChat(project);
  const needMainCount =
    spec && !project.meta?.mainCountConfirmed && chatCountStep !== "detail";
  if (needMainCount) {
    if (isFastMainPath(project)) {
      return `${spec.label} 快速主图：请确认主图张数（${spec.mainImage.min}-${spec.mainImage.max} 张，建议 ${spec.mainImage.recommended}），确认后将跳过 Step1–4：`;
    }
    return `${spec.label} 主图建议 ${spec.mainImage.recommended} 张（可选 ${spec.mainImage.min}-${spec.mainImage.max} 张）：`;
  }
  if (spec && !project.meta?.countsConfirmed) {
    return `${spec.label} 详情页建议 ${spec.detailPage.recommended} 屏（可选 ${spec.detailPage.min}-${spec.detailPage.max} 屏）：`;
  }

  if (project.meta?.reviseMode) {
    return "请选择要修改的维度（点选即可，无需输入）：";
  }

  const field = nextBriefField(project.brief);
  if (field) return field.prompt;

  const design = project.design;
  if (design?.marketingPlans.length && design.selectedPlanNo == null) {
    return "请从下面选择一套营销方案；都不合适可点「重新生成三套方案」或在右侧修改后再选：";
  }
  if (isAwaitingMarketingPlanSelection(project)) {
    return "请从下面选择一套营销方案；都不合适可点「重新生成三套方案」：";
  }

  const hint = nextStepChoiceHint(project);
  if (hint) return hint;

  return "请选择（无需输入）：";
}

/** 用户点「下一步」时，根据当前 design 进度生成明确的 LLM 指令（对齐 core_agent_prompt 9 步） */
export function buildProductDesignNextStepCommand(
  project: ProductDesignProject,
): { prompt: string; focusStep: ProductDesignStepId } | null {
  if (!project.meta?.countsConfirmed) {
    return null;
  }
  if (!shouldSkipBrief(project) && !briefComplete(project.brief)) {
    return null;
  }

  const design = project.design;
  const mainCount = project.resolved.mainImageCount;
  const detailCount = project.resolved.detailPageCount;

  if (isFastMainPath(project)) {
    if (!design?.mainImages?.length) {
      return {
        prompt: "【快速主图】请在中间工作区确认 Prompt 与参考图，点击生成主图。",
        focusStep: "main-image",
      };
    }
    if (!design.mainImages.every((m) => m.imageUrl)) {
      return {
        prompt: "【快速主图】请继续在中间工作区生成未完成的主图。",
        focusStep: "main-image",
      };
    }
    if (design.detailOutline.length === 0) {
      if (!project.meta?.detailWorkflowPath) {
        return null;
      }
      if (isFastDetailPath(project)) {
        return {
          prompt: `【详情拆解】请阅读 detail-style 参考图，拆解 ${detailCount} 屏 detailOutline + detailPages（须 product-design JSON）。`,
          focusStep: "detail-outline",
        };
      }
    }
  }

  if (!design?.analysis) {
    return {
      prompt: "【下一步】请执行 Step1：平台合规与产品深度拆解，输出完整 Step1 报告。",
      focusStep: "analysis",
    };
  }

  if ((design.marketingPlans?.length ?? 0) === 0) {
    return {
      prompt:
        "【下一步】请执行 Step2：输出三套差异化营销方案（须 Markdown 表格 + 末尾 product-design JSON 补丁）。",
      focusStep: "marketing",
    };
  }

  if (design.selectedPlanNo == null) {
    return null;
  }

  if ((design.buyingReasons?.length ?? 0) === 0) {
    return {
      prompt: `【下一步】已选定方案 ${design.selectedPlanNo}。请执行 Step3：将卖点转化为用户购买理由。`,
      focusStep: "reasons",
    };
  }

  if ((design.mainImages?.length ?? 0) === 0) {
    return {
      prompt: `【下一步】请执行 Step4：生成 ${mainCount} 张主图分层定稿文案（每张职责不同，须输出 mainImages 共 ${mainCount} 条）。`,
      focusStep: "main-copy",
    };
  }

  if ((design.detailOutline?.length ?? 0) === 0) {
    const allMainImages = design.mainImages.every((m) => m.imageUrl);
    const lead = allMainImages
      ? "主图已全部生成完毕。"
      : "主图文案已定稿（未出图的主图可稍后在右侧工作台补生成）。";
    return {
      prompt: `${lead}【下一步】请执行 Step7：${detailCount} 屏详情页销售逻辑框架（详情页架构规划）。只输出结构大纲，不写逐屏正文；须输出 detailOutline 共 ${detailCount} 条。`,
      focusStep: "detail-outline",
    };
  }

  if ((design.detailPages?.length ?? 0) === 0) {
    return {
      prompt: `【下一步】请执行 Step8：根据 Step7 架构，为全部 ${detailCount} 屏生成详情页海报定稿文案；须输出 detailPages 共 ${detailCount} 条。`,
      focusStep: "detail-copy",
    };
  }

  const allDetailImages = design.detailPages.every((d) => d.imageUrl);
  if (!allDetailImages) {
    return {
      prompt:
        "【下一步】详情页文案已定稿。我将在右侧工作台继续为各屏出图；如需先改某一屏文案请说明屏号。",
      focusStep: "detail-image",
    };
  }

  return {
    prompt:
      "【下一步】9 步流水线已全部完成。如需调整某一环节，请点「修改当前步」或直接在右侧编辑对应内容。",
    focusStep: "detail-image",
  };
}

/** 「下一步」按钮上方的情境提示 */
export function nextStepChoiceHint(project: ProductDesignProject): string | null {
  const design = project.design;
  if (!design) return "确认当前步无误后，点「下一步」继续 9 步流水线。";

  if (
    design.mainImages.length > 0 &&
    design.mainImages.every((m) => m.imageUrl) &&
    design.detailOutline.length === 0
  ) {
    if (isFastDetailPath(project)) {
      return "主图已全部生成。请在中间工作区上传详情页参考长图，点「分析并拆解详情页」。";
    }
    return "主图已全部生成。点「进入详情页制作」规划详情页架构，或在中间工作区补生成未完成的图。";
  }

  if (
    design.mainImages.length > 0 &&
    design.detailOutline.length === 0
  ) {
    return "主图文案已定稿。点「下一步」进入 Step7 详情页架构；主图出图可在中间工作区进行。";
  }

  if (design.detailOutline.length > 0 && design.detailPages.length === 0) {
    return "详情架构已就绪。点「下一步」生成 Step8 各屏详情文案。";
  }

  if (design.detailPages.length > 0 && !design.detailPages.every((d) => d.imageUrl)) {
    return "详情文案已就绪。可点「生成全部详情屏」出图，或点「下一步」继续。";
  }

  return null;
}

export function defaultMainImageRefPrompt(project: ProductDesignProject): string {
  const refs = buildProductDesignPromptMentionRefs(project, "main");
  const styleRefs = refs.filter((r) => r.role === "main-style");
  const productRefs = refs.filter((r) => r.role === "product");
  const styleTags = styleRefs.map((r) => `@图片${r.index}`).join("");
  const productTags = productRefs.map((r) => `@图片${r.index}`).join("");
  if (styleRefs.length === 0) {
    return `我的商品是${productTags || "@图片1"}，请生成可用于${project.platform}平台店铺主图的模特展示图，保持商品款式与颜色一致，使用最佳生图引擎。`;
  }
  return `我店铺的主图风格是${styleTags}，请学习这组图的整体风格（模特、配饰、光线、背景、构图等），后续给到衣服要生成风格一致可用于店铺的模特图。我的商品是${productTags}，请基于上述风格生成一套${project.platform}平台主图物料（多张不同姿势），使用最佳引擎。`;
}

/** 主图槽位硬上限（追加模式；可超出平台上架张数，便于多姿势选片） */
export const PRODUCT_DESIGN_MAIN_IMAGE_SLOTS_MAX = 30;

/** 追加 N 张空主图槽位（不覆盖已有） */
export function appendMainImageSlots(
  design: ProductDesign,
  addCount: number,
  maxTotal = PRODUCT_DESIGN_MAIN_IMAGE_SLOTS_MAX,
): ProductDesignMainImage[] {
  const current = design.mainImages ?? [];
  const toAdd = Math.min(Math.max(0, addCount), maxTotal - current.length);
  if (toAdd <= 0) return current;
  const out = [...current];
  for (let i = 0; i < toAdd; i++) {
    const index = out.length + 1;
    out.push({
      index,
      purpose: "",
      layers: { title: `主图 ${index}`, bullets: [] },
      emphasis: { bold: [], color: [] },
    });
  }
  return out;
}

/** 调整主图槽位数（平台 min-max 内）；新增槽位为空文案，减少时截断 */
export function resizeMainImageSlots(
  design: ProductDesign,
  nextCount: number,
): ProductDesignMainImage[] {
  const current = design.mainImages ?? [];
  if (nextCount === current.length) return current;
  if (nextCount < current.length) {
    return current.slice(0, nextCount).map((m, i) => ({ ...m, index: i + 1 }));
  }
  const out = current.map((m, i) => ({ ...m, index: i + 1 }));
  for (let i = current.length + 1; i <= nextCount; i++) {
    out.push({
      index: i,
      purpose: "",
      layers: { title: `主图 ${i}`, bullets: [] },
      emphasis: { bold: [], color: [] },
    });
  }
  return out;
}

export function productDesignStepAnchorId(step: ProductDesignStepId): string {
  switch (step) {
    case "brief":
      return "pdt-step-top";
    case "analysis":
      return "pdt-step-analysis";
    case "marketing":
      return "pdt-step-marketing";
    case "reasons":
      return "pdt-step-reasons";
    case "main-copy":
    case "main-image":
      return "pdt-step-main";
    case "detail-outline":
      return "pdt-step-detail-outline";
    case "detail-copy":
    case "detail-image":
      return "pdt-step-detail";
    default:
      return "pdt-step-top";
  }
}

export function productDesignAssistantAnchorId(step: ProductDesignStepId): string {
  return `pdt-assistant-step-${step}`;
}

export function inferAssistantMessageStep(
  message: { id: string; role: string; content: string },
  index: number,
): ProductDesignStepId | null {
  if (message.id === "welcome" || index === 0) return "brief";
  const c = message.content;
  if (/Step0|信息采集|请选择商品要上架的平台|产品名|产品大类|风格参考/.test(c)) return "brief";
  if (/Step1|平台规则|流量逻辑|平台拆解|用户痛点与机会/.test(c)) return "analysis";
  if (/Step2|营销方案|三套方案|方案 1|方案 2|方案 3/.test(c)) return "marketing";
  if (/Step3|购买理由|TOP3/.test(c)) return "reasons";
  if (/Step4|主图文案|主图.*层/.test(c)) return "main-copy";
  if (/Step5|主图出图|生成全部主图/.test(c)) return "main-image";
  if (/Step7|详情架构|详情页架构|详情大纲|销售逻辑框架/.test(c)) return "detail-outline";
  if (/Step8|分屏文案|详情分页|详情.*定稿文案/.test(c)) return "detail-copy";
  if (/Step9|详情出图|生成全部详情/.test(c)) return "detail-image";
  if (/Step6|主图局部|无损修改/.test(c)) return "main-image";
  if (message.role === "user") {
    if (/^平台：/.test(c.trim())) return "brief";
    if (/^主图：|^详情：/.test(c.trim())) return "brief";
    if (/^方案 /.test(c.trim())) return "marketing";
  }
  return null;
}

export function formatBriefMultiValue(value: string[] | string | undefined): string {
  if (Array.isArray(value)) return value.join("、");
  return String(value ?? "").trim();
}

export const formatTrustBadgeValue = formatBriefMultiValue;

export { parseMarketingPlansFromMarkdown, isAwaitingMarketingPlanSelection };
