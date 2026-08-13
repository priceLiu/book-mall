import type {
  EcomPlatformSpec,
  ImageGenPlan,
  ProductDesign,
  ProductDesignBrief,
  ProductDesignDetailPage,
  ProductDesignMainImage,
  ProductDesignProject,
} from "@/lib/product-design-types";
import { buildProductDesignPromptMentionRefs } from "@/lib/product-design-mention-refs";
import { hasProductRef } from "@/lib/product-design-ref-rules";
import { hasBuyingReasonBriefContent } from "@/lib/product-design-buying-reason-parse";
import {
  isAwaitingMarketingPlanSelection,
  parseMarketingPlansFromMarkdown,
  resolveMarketingPlansForDisplay,
} from "@/lib/product-design-marketing-parse";
import {
  hasValidAnalysis,
  resolveAnalysisForDisplay,
} from "@/lib/product-design-step-sync-parse";

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

export type SetupPhase = "product" | "workflow-choice" | "platform" | "done";

/** 两条分支：助手流程 / 产品图 + 参考图 + Prompt */
export type MainWorkflowPath = "interactive" | "prompt";
export type DetailWorkflowPath = "interactive" | "prompt";

/** 产线：主图与详情页并行，互不阻塞 */
export type ProductionTrack = "main" | "detail";

/**
 * 存量项目的 workflowPath / genMode 兼容映射。
 * 旧值 reference-decompose / reference-prompt / reference 统一归到 prompt 分支。
 */
export function normalizeWorkflowPath(raw: unknown): MainWorkflowPath | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (raw === "interactive") return "interactive";
  return "prompt";
}

/** 分支持久化到 settings 的取值（保持历史值，避免数据迁移） */
export function workflowPathToGenMode(path: MainWorkflowPath): "copy" | "reference-prompt" {
  return path === "interactive" ? "copy" : "reference-prompt";
}

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

/** 策略层：两条产线共享的 Step0–3 */
export const STRATEGY_STEPS: ProductDesignStepId[] = [
  "brief",
  "analysis",
  "marketing",
  "reasons",
];

const MAIN_TRACK_STEPS: ProductDesignStepId[] = [
  ...STRATEGY_STEPS,
  "main-copy",
  "main-image",
];

const DETAIL_TRACK_STEPS: ProductDesignStepId[] = [
  ...STRATEGY_STEPS,
  "detail-outline",
  "detail-copy",
  "detail-image",
];

/**
 * 产线由项目 module 决定，一个项目只属于一条产线（主图 / 详情页），运行中不可切换。
 * 旧项目 module 为 "product-creation"，一律按主图产线处理。
 */
export function resolveActiveTrack(project: ProductDesignProject): ProductionTrack {
  return project.module === "detail-page" ? "detail" : "main";
}

export function stepsForTrack(track: ProductionTrack): ProductDesignStepId[] {
  return track === "detail" ? DETAIL_TRACK_STEPS : MAIN_TRACK_STEPS;
}

export function isStepInTrack(step: ProductDesignStepId, track: ProductionTrack): boolean {
  return stepsForTrack(track).includes(step);
}

/** 当前产线选定的分支 */
export function trackWorkflowPath(project: ProductDesignProject): MainWorkflowPath | null {
  const raw =
    resolveActiveTrack(project) === "detail"
      ? project.meta?.detailWorkflowPath
      : project.meta?.mainWorkflowPath;
  return normalizeWorkflowPath(raw);
}

/** 当前产线是否走助手流程 */
export function isInteractiveTrackWorkflow(project: ProductDesignProject): boolean {
  return trackWorkflowPath(project) === "interactive";
}

export function hasMainStyleRef(references: ProductDesignProject["references"]): boolean {
  return references.some((r) => r.role === "main-style");
}

export function hasDetailStyleRef(references: ProductDesignProject["references"]): boolean {
  return references.some((r) => r.role === "detail-style");
}

/** 主图 · 产品图 + 参考图 + Prompt（含存量 reference-decompose / reference） */
export function isFastMainPromptPath(project: ProductDesignProject): boolean {
  return (
    normalizeWorkflowPath(project.meta?.mainWorkflowPath) === "prompt" ||
    normalizeWorkflowPath(project.settings.mainImageGenMode === "copy" ? null : project.settings.mainImageGenMode) ===
      "prompt"
  );
}

export function isFastMainPath(project: ProductDesignProject): boolean {
  return isFastMainPromptPath(project);
}

/** 助手流程（用户已点选「助手流程 · Step by step」） */
export function isInteractiveMainWorkflow(project: ProductDesignProject): boolean {
  if (isFastMainPath(project)) return false;
  return project.meta?.mainWorkflowPath === "interactive";
}

/** 参考图快速路径（非 Step-by-step） */
export function isReferenceImagePath(project: ProductDesignProject): boolean {
  return isFastMainPath(project);
}

export function getImageGenPlan(
  project: ProductDesignProject,
  target: "main" | "detail",
): ImageGenPlan | null {
  return project.design?.imageGenPlans?.[target] ?? null;
}

export function imageGenPlanConfirmed(
  project: ProductDesignProject,
  target: "main" | "detail",
): boolean {
  const plan = getImageGenPlan(project, target);
  return plan?.status === "confirmed" && plan.items.length > 0;
}

/** 已有可编辑 Prompt 槽位（draft 即可，无需 confirmed） */
export function hasGenPromptSlots(
  project: ProductDesignProject,
  target: "main" | "detail",
): boolean {
  const plan = getImageGenPlan(project, target);
  if (plan && plan.items.length > 0) return true;
  const design = project.design;
  if (!design) return false;
  const slots = target === "main" ? design.mainImages : design.detailPages;
  return slots.length > 0;
}

export function showMainPromptPlanWorkspace(project: ProductDesignProject): boolean {
  if (!hasProductRef(project.references)) return false;
  if (isReferenceImagePath(project)) {
    return Boolean(project.meta?.platformConfirmed ?? project.platform);
  }
  const design = project.design;
  return Boolean(design?.mainImages.length);
}

export function showDetailPromptPlanWorkspace(project: ProductDesignProject): boolean {
  if (!hasProductRef(project.references)) return false;
  if (
    project.settings.detailPageGenMode === "reference-prompt" ||
    project.settings.detailPageGenMode === "reference-decompose"
  ) {
    return Boolean(project.meta?.detailWorkflowPath);
  }
  return Boolean(project.design?.detailPages.length);
}

/** 快速主图路径：平台尚未确认 */
export function isFastMainSetupPending(project: ProductDesignProject): boolean {
  return isFastMainPath(project) && !project.meta?.platformConfirmed;
}

/** 详情 · 产品图 + 参考图 + Prompt（含存量 reference-decompose） */
export function isFastDetailPromptPath(project: ProductDesignProject): boolean {
  return (
    normalizeWorkflowPath(project.meta?.detailWorkflowPath) === "prompt" ||
    normalizeWorkflowPath(
      project.settings.detailPageGenMode === "copy" ? null : project.settings.detailPageGenMode,
    ) === "prompt"
  );
}

export function isFastDetailPath(project: ProductDesignProject): boolean {
  return isFastDetailPromptPath(project);
}

/** 详情页 · 参考图 + 自定义 Prompt：尚未拆解出槽位 */
export function isFastDetailSetupPending(project: ProductDesignProject): boolean {
  return isFastDetailPromptPath(project) && !hasGenPromptSlots(project, "detail");
}

export function shouldSkipBrief(project: ProductDesignProject): boolean {
  // 详情产线单独判定：主图走过 Prompt 分支不应连带跳过详情助手流程的采集
  if (resolveActiveTrack(project) === "detail") {
    return project.meta?.detailWorkflowPath !== "interactive";
  }
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

export function bootstrapFastDetailDesignPatch(detailCount: number): Partial<ProductDesign> {
  const pages: ProductDesignDetailPage[] = [];
  for (let i = 1; i <= detailCount; i++) {
    pages.push({
      index: i,
      purpose: `详情第 ${i} 屏`,
      title: `详情 ${i}`,
      body: [],
      keyInfo: "",
      closingLine: "",
      layoutHint: "",
    });
  }
  return { detailPages: pages, detailOutline: [] };
}

export function defaultDetailPageRefPrompt(project: ProductDesignProject): string {
  const refs = buildProductDesignPromptMentionRefs(project, "detail");
  const styleRefs = refs.filter((r) => r.role === "detail-style");
  const productRefs = refs.filter((r) => r.role === "product");
  const styleTags = styleRefs.map((r) => `@图片${r.index}`).join("");
  const productTags = productRefs.map((r) => `@图片${r.index}`).join("");
  const count = project.resolved.detailPageCount;
  if (styleRefs.length === 0) {
    return `我的商品是${productTags || "@图片1"}，请参考${project.platform}平台详情页规范，生成 ${count} 屏连贯的详情页海报（每屏一屏一主题），保持商品款式一致。`;
  }
  return `详情页整体风格参考${styleTags}，请学习其版式、模块节奏与视觉层次；商品为${productTags}。请生成 ${count} 屏风格一致的详情页各屏海报。`;
}

export function resolveProductDesignStepStates(
  project: ProductDesignProject,
): Record<ProductDesignStepId, StepVisual> {
  const design = project.design;
  const fastMain = isFastMainPath(project);
  const briefDone = shouldSkipBrief(project) || briefComplete(project.brief);
  const analysisDone =
    fastMain ? briefDone : hasValidAnalysis(resolveAnalysisForDisplay(project));
  const marketingPlansDisplay = resolveMarketingPlansForDisplay(project);
  const planSelected = design?.selectedPlanNo != null;
  const hasMarketingPlans = marketingPlansDisplay.length > 0;
  const hasBuyingReasons =
    (design?.buyingReasons.length ?? 0) > 0 ||
    hasBuyingReasonBriefContent(design?.buyingReasonBrief);
  const hasMainCopy = (design?.mainImages.length ?? 0) > 0;

  const done: Record<ProductDesignStepId, boolean> = {
    brief: briefDone,
    analysis: analysisDone,
    marketing: fastMain ? briefDone : hasMarketingPlans && planSelected,
    reasons: fastMain ? briefDone : planSelected && hasBuyingReasons,
    "main-copy": fastMain
      ? hasMainCopy
      : planSelected && hasBuyingReasons && hasMainCopy,
    "main-image": Boolean(
      hasMainCopy && design?.mainImages.every((m) => m.imageUrl),
    ),
    "detail-outline": (design?.detailOutline.length ?? 0) > 0,
    "detail-copy": (design?.detailPages.length ?? 0) > 0,
    "detail-image": Boolean(
      design?.detailPages.length && design.detailPages.every((d) => d.imageUrl),
    ),
  };

  // active 只在当前产线内推进，避免详情产线一直卡在「主图文案」
  const trackSteps = stepsForTrack(resolveActiveTrack(project));
  const active =
    trackSteps.find((id) => !done[id]) ?? trackSteps[trackSteps.length - 1]!;

  const out = {} as Record<ProductDesignStepId, StepVisual>;
  for (const step of PRODUCT_DESIGN_STEPS) {
    out[step.id] = done[step.id] ? "done" : step.id === active ? "active" : "pending";
  }
  return out;
}

export function resolveSetupPhase(project: ProductDesignProject): SetupPhase {
  const meta = project.meta ?? {};
  if (!hasProductRef(project.references)) return "product";

  if (resolveActiveTrack(project) === "detail") {
    if (!meta.detailWorkflowPath) return "workflow-choice";
    if (!meta.platformConfirmed) return "platform";
    if (meta.detailWorkflowPath === "interactive" && !meta.countsConfirmed) {
      return "platform";
    }
    return "done";
  }

  // 主图产线的门禁只看主图自己的字段，避免详情产线先确认屏数后主图跳过选择
  if (!meta.mainWorkflowPath) return "workflow-choice";
  if (!meta.platformConfirmed) return "platform";
  if (isFastMainPath(project)) return "done";
  // Step-by-step：会话区选平台 → 主图张数
  if (!meta.mainCountConfirmed) return "platform";
  return "done";
}

/** 策略层（Step0–3）是否已完整产出，可供详情产线复用 */
export function isStrategyLayerReady(project: ProductDesignProject): boolean {
  const design = project.design;
  if (!design) return false;
  if (!briefComplete(project.brief)) return false;
  if (!hasValidAnalysis(resolveAnalysisForDisplay(project))) return false;
  if (design.selectedPlanNo == null) return false;
  return (
    (design.buyingReasons?.length ?? 0) > 0 ||
    hasBuyingReasonBriefContent(design.buyingReasonBrief)
  );
}

/** 详情产线：策略层已就绪但用户尚未决定沿用还是重采 */
export function needsStrategyReuseDecision(project: ProductDesignProject): boolean {
  if (resolveActiveTrack(project) !== "detail") return false;
  if (project.meta?.detailWorkflowPath !== "interactive") return false;
  if (project.meta?.strategyReuse) return false;
  return isStrategyLayerReady(project);
}

/** 助手流程：Step7 前须确认详情屏数 */
export function needsDetailCountConfirmation(project: ProductDesignProject): boolean {
  if (project.meta?.countsConfirmed) return false;

  // 详情产线：确认平台后即可定屏数，不依赖主图是否出完
  if (resolveActiveTrack(project) === "detail") {
    if (project.meta?.detailWorkflowPath !== "interactive") return false;
    return Boolean(project.meta?.platformConfirmed);
  }

  if (isFastMainPath(project)) return false;
  if (project.meta?.mainWorkflowPath && project.meta.mainWorkflowPath !== "interactive") {
    return false;
  }
  if (!project.meta?.mainCountConfirmed) return false;
  const design = project.design;
  if (!design?.mainImages.length) return false;
  const allMainImagesDone = design.mainImages.every((m) => m.imageUrl);
  if (!allMainImagesDone) return false;
  return !project.meta?.detailWorkflowPath;
}

export function readBriefSuggestions(project: ProductDesignProject): BriefSuggestions {
  // 手动输入模式不展示 AI 候选项（也不会触发视觉调用）
  if (project.meta?.briefInferMode === "manual") return {};
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

/** 助手流程：会话区采集 Brief（Step0）；Step1 起仅在中间区编辑 */
export function needsBriefCollection(project: ProductDesignProject): boolean {
  if (shouldSkipBrief(project)) return false;
  if (briefComplete(project.brief)) return false;
  if (!hasProductRef(project.references)) return false;
  if (!isInteractiveTrackWorkflow(project)) return false;

  if (resolveActiveTrack(project) === "detail") {
    if (!project.meta?.countsConfirmed) return false;
    // 策略层可复用时先让用户决定沿用还是重采
    if (needsStrategyReuseDecision(project)) return false;
  } else if (!project.meta?.mainCountConfirmed) {
    return false;
  }

  // Step1+ 已启动：不在会话区重复采集，改在中间工作区编辑
  if (hasValidAnalysis(resolveAnalysisForDisplay(project))) return false;
  if (resolveMarketingPlansForDisplay(project).length > 0) return false;
  return true;
}

/** Step0 读图推断：用户尚未选择「AI 拆解 / 手动输入」 */
export function needsBriefInferModeChoice(project: ProductDesignProject): boolean {
  if (!needsBriefCollection(project)) return false;
  if (project.meta?.briefInferMode) return false;
  return BRIEF_FIELDS.some((f) => f.aiInferrable && !briefFieldFilled(project.brief, f.key));
}

/** Step0：用户已选 AI 拆解，候选项仍在拉取 */
export function isBriefSuggestionsPending(project: ProductDesignProject): boolean {
  if (!needsBriefCollection(project)) return false;
  if (project.meta?.briefInferMode !== "ai") return false;
  const field = nextBriefField(project.brief);
  if (!field?.aiInferrable) return false;
  return !project.meta?.briefSuggestionsLoaded;
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

/** 主图区「本次生成」张数选项（与平台上架 min–max 解耦） */
export const MAIN_IMAGE_BATCH_COUNT_CHOICES = [6, 7, 8, 9] as const;

export function resolveMainImageBatchCount(settingsCount?: number): number {
  if (
    typeof settingsCount === "number" &&
    (MAIN_IMAGE_BATCH_COUNT_CHOICES as readonly number[]).includes(settingsCount)
  ) {
    return settingsCount;
  }
  return 8;
}

export function parseCountChoice(text: string, prefix: string): number | null {
  if (!text.startsWith(prefix)) return null;
  const n = Number.parseInt(text.slice(prefix.length).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const NEXT_STEP_CHOICE = "下一步";
export const REVISE_CHOICE = "修改当前步";
export const CUSTOM_INPUT_CHOICE = "自己输入";
export const INTERACTIVE_WORKFLOW_CHOICE = "主图 · 助手流程（Step by step）";
export const MAIN_REF_PROMPT_WORKFLOW_CHOICE = "主图 · 参考图 + Prompt";
export const DETAIL_INTERACTIVE_CHOICE = "详情页 · 助手流程（Step by step）";
export const DETAIL_REF_PROMPT_WORKFLOW_CHOICE = "详情页 · 参考图 + Prompt";
/** 信息采集多选字段的主操作（与流水线「下一步」文案一致） */
export const CONFIRM_BRIEF_MULTI_CHOICE = NEXT_STEP_CHOICE;
export const CONFIRM_TRUST_BADGE_CHOICE = NEXT_STEP_CHOICE;
export const NO_TRUST_BADGE_CHOICE = "暂无背书";
export const REGENERATE_MARKETING_PLANS_CHOICE = "重新生成三套方案";
/** Step0：读图推断由用户显式触发（AI 调用计费） */
export const BRIEF_AI_INFER_CHOICE = "AI 拆解产品图（消耗 1 次视觉模型调用）";
export const BRIEF_MANUAL_INPUT_CHOICE = "手动输入";
/** 详情产线：策略层已就绪时的复用确认 */
export const REUSE_STRATEGY_CHOICE = "沿用已有策略";
export const RECOLLECT_STRATEGY_CHOICE = "先去中间区修改策略层";

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

/** AI 推断的单选 Brief 项（产品名、目标人群等） */
export function isBriefAiSuggestionChoice(
  project: ProductDesignProject,
  text: string,
): boolean {
  const field = nextBriefField(project.brief);
  if (!field?.aiInferrable || field.multiSelect) return false;
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

export function choicesForBriefField(
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

/** 聊天已推进到张数/屏数确认，但 meta 尚未落库时的兜底（须匹配「请用户此刻点选」的文案，勿匹配流程说明里的顺带提及） */
function inferPendingCountStepFromChat(
  project: ProductDesignProject,
): "main" | "detail" | null {
  if (project.meta?.countsConfirmed) return null;
  const last = [...project.chatHistory].reverse().find((m) => m.role === "assistant");
  if (!last?.content) return null;
  const c = last.content;
  if (/详情页屏数|详情页定为|请确认详情|详情页建议|请点选下方详情/.test(c)) return "detail";
  if (project.meta?.mainCountConfirmed) return "detail";
  if (/请点选下方主图张数|请确认主图张数|主图定为\s*\d/.test(c) && !/详情页屏数/.test(c)) {
    return "main";
  }
  return null;
}

/** 会话已确认平台、meta 尚未回写时（optimistic / 父组件 reload 间隙） */
export function isPlatformConfirmedForChoices(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): boolean {
  if (!isInteractiveTrackWorkflow(project)) return false;
  if (project.meta?.platformConfirmed) return true;
  const lastAssistant = [...project.chatHistory]
    .reverse()
    .find((m) => m.role === "assistant");
  if (lastAssistant && /已选择【.+】/.test(lastAssistant.content)) return true;
  const lastUser = [...project.chatHistory].reverse().find((m) => m.role === "user");
  if (lastUser && parsePlatformChoice(lastUser.content, specs)) {
    if (inferPendingCountStepFromChat(project) === "main") return true;
  }
  return false;
}

function mainCountChoiceLabels(spec: EcomPlatformSpec): string[] {
  return countChoices(spec.mainImage.min, spec.mainImage.max, spec.mainImage.recommended).map(
    (n) => `${MAIN_COUNT_CHOICE_PREFIX}${n} 张`,
  );
}

function isMarketingPlanSelectionPhase(project: ProductDesignProject): boolean {
  const design = project.design;
  if (!design || resolveMarketingPlansForDisplay(project).length === 0) return false;
  if (design.selectedPlanNo == null) return true;
  return (
    !(design.buyingReasons?.length ?? 0) &&
    !hasBuyingReasonBriefContent(design.buyingReasonBrief)
  );
}

function marketingPlanChoices(project: ProductDesignProject): string[] {
  const plans = resolveMarketingPlansForDisplay(project);
  if (plans.length === 0 || !isMarketingPlanSelectionPhase(project)) return [];
  const planLabels = plans.map((p) => marketingPlanChoiceLabel(p.no));
  // 方案一经选定即锁定，不提供换选；内容仍可在中间区编辑
  if (project.design?.selectedPlanNo != null) {
    return [NEXT_STEP_CHOICE, REVISE_CHOICE];
  }
  return [...planLabels, REGENERATE_MARKETING_PLANS_CHOICE, REVISE_CHOICE];
}

/** 助手区 Choice Chips：信息采集 / 方案点选 / 下一步导航 */
export function inferAssistantChoices(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): string[] {
  if (project.meta?.reviseMode) {
    return [...REVISE_DIMENSION_CHOICES, NEXT_STEP_CHOICE];
  }

  if (!hasProductRef(project.references)) {
    return [];
  }

  const phase = resolveSetupPhase(project);
  const track = resolveActiveTrack(project);
  const detailTrack = track === "detail";

  if (phase === "workflow-choice") {
    return detailTrack
      ? [DETAIL_INTERACTIVE_CHOICE, DETAIL_REF_PROMPT_WORKFLOW_CHOICE]
      : [INTERACTIVE_WORKFLOW_CHOICE, MAIN_REF_PROMPT_WORKFLOW_CHOICE];
  }

  const spec = specs.find((s) => s.code === project.platform);
  const chatCountStep = inferPendingCountStepFromChat(project);
  const platformConfirmed = isPlatformConfirmedForChoices(project, specs);
  const stepByStep = isInteractiveTrackWorkflow(project);

  if (stepByStep && !project.meta?.platformConfirmed && !platformConfirmed) {
    return specs.map((s) => platformChoiceLabel(s));
  }

  if (
    stepByStep &&
    !detailTrack &&
    spec &&
    !project.meta?.mainCountConfirmed &&
    chatCountStep !== "detail" &&
    platformConfirmed
  ) {
    return mainCountChoiceLabels(spec);
  }

  if (needsDetailCountConfirmation(project) && spec) {
    return countChoices(
      spec.detailPage.min,
      spec.detailPage.max,
      spec.detailPage.recommended,
    ).map((n) => `${DETAIL_COUNT_CHOICE_PREFIX}${n} 屏`);
  }

  if (needsStrategyReuseDecision(project)) {
    return [REUSE_STRATEGY_CHOICE, RECOLLECT_STRATEGY_CHOICE];
  }

  if (needsBriefInferModeChoice(project)) {
    return [BRIEF_AI_INFER_CHOICE, BRIEF_MANUAL_INPUT_CHOICE];
  }

  if (needsBriefCollection(project)) {
    const field = nextBriefField(project.brief);
    if (field) return choicesForBriefField(project, field);
  }

  // 主图完成后不在会话区引导跨工作台：入口只放在中间工作区的卡片上
  const planChoices = marketingPlanChoices(project);
  if (planChoices.length > 0) return planChoices;

  if (isFastMainSetupPending(project)) return [];
  if (!shouldSkipBrief(project) && !briefComplete(project.brief)) return [];
  if (phase !== "done" && !detailTrack && !project.meta?.mainCountConfirmed) return [];

  return [NEXT_STEP_CHOICE, REVISE_CHOICE];
}

/** @deprecated 请用 inferAssistantChoices */
export function inferAssistantNavChoices(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): string[] {
  return inferAssistantChoices(project, specs);
}

/** @deprecated 助手请用 inferAssistantNavChoices；保留供测试/兼容 */
export function inferProductDesignChoices(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): string[] {
  return inferAssistantNavChoices(project, specs);
}

/** 当前步骤的提示语，展示在选项上方 */
export function choicePrompt(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): string {
  const phase = resolveSetupPhase(project);
  const interactive = isInteractiveTrackWorkflow(project);
  const detailTrack = resolveActiveTrack(project) === "detail";

  if (phase === "product") {
    return "请先在中间工作区上传至少 1 张产品实拍图（必传）；参考图可选，可先上传或跳过。";
  }
  if (phase === "workflow-choice") {
    return detailTrack
      ? "产品图已就绪。请点选下方详情页制作方式（详情参考图可在中间工作区上传，可选）。"
      : "产品图已就绪。请点选下方主图制作方式（主图风格参考可在中间工作区上传，可选）。";
  }
  if (needsStrategyReuseDecision(project)) {
    return "检测到本项目已完成 Step0–3 策略层（信息采集、平台拆解、营销方案、购买理由）。详情页可直接沿用，也可先去中间工作区修改后再继续。";
  }
  if (needsBriefInferModeChoice(project)) {
    return "开始信息采集。可让 AI 读产品图推断产品名、目标人群、痛点与核心优势（消耗 1 次视觉模型调用），也可全部手动输入。";
  }
  if (!detailTrack && isFastMainSetupPending(project)) {
    return "请在中间工作区选择平台、确认主图张数，并编辑 Prompt 后开始出图。";
  }
  if (needsBriefCollection(project)) {
    const field = nextBriefField(project.brief);
    return field
      ? `${field.prompt}（完成后结论同步到中间工作区，可铅笔修改）`
      : "请点选下方选项完成信息采集（完成后结论同步到中间工作区，可铅笔修改）。";
  }
  if (isFastDetailSetupPending(project)) {
    return "请在中间工作区确认详情屏数、编辑自定义 Prompt，并上传详情参考图后出图。";
  }

  const spec = specs.find((s) => s.code === project.platform);
  const chatCountStep = inferPendingCountStepFromChat(project);
  const platformConfirmed = isPlatformConfirmedForChoices(project, specs);
  const stepByStep = isInteractiveTrackWorkflow(project);

  if (
    stepByStep &&
    !detailTrack &&
    spec &&
    !project.meta?.mainCountConfirmed &&
    chatCountStep !== "detail" &&
    platformConfirmed
  ) {
    return `请点选下方主图张数（${spec.label} 建议 ${spec.mainImage.recommended} 张）。`;
  }
  if (stepByStep && !project.meta?.platformConfirmed && !platformConfirmed) {
    return "请点选下方上架平台。";
  }
  if (needsDetailCountConfirmation(project)) {
    return interactive
      ? `请点选下方详情页屏数（${spec?.label ?? "当前平台"} 建议 ${spec?.detailPage.recommended ?? 8} 屏）。`
      : `请在中间工作区确认详情页屏数（${spec?.label ?? "当前平台"} 建议 ${spec?.detailPage.recommended ?? 8} 屏）。`;
  }

  if (project.meta?.reviseMode) {
    return "请选择要修改的维度（点选即可，无需输入）：";
  }

  const field = nextBriefField(project.brief);
  if (field && !shouldSkipBrief(project) && !needsBriefCollection(project)) {
    return interactive
      ? `请点选或填写：${field.label}`
      : `请在中间工作区填写：${field.label}`;
  }

  if (
    resolveMarketingPlansForDisplay(project).length > 0 &&
    project.design?.selectedPlanNo == null
  ) {
    return "请点选下方营销方案（方案 1 / 2 / 3）；选定后中间工作区展示已选方案并可编辑。都不合适可点「重新生成三套方案」。";
  }
  if (
    resolveMarketingPlansForDisplay(project).length > 0 &&
    project.design?.selectedPlanNo != null &&
    isMarketingPlanSelectionPhase(project)
  ) {
    return "方案已选定（不可换选），可在中间工作区编辑方案内容。确认后点「下一步」进入 Step3。";
  }

  const hint = nextStepChoiceHint(project);
  if (hint) return hint;

  return "请选择（无需输入）：";
}

/** 用户点「下一步」时，根据当前 design 进度生成明确的 LLM 指令（对齐 core_agent_prompt 9 步） */
export function buildProductDesignNextStepCommand(
  project: ProductDesignProject,
): { prompt: string; focusStep: ProductDesignStepId } | null {
  const detailTrack = resolveActiveTrack(project) === "detail";
  const design = project.design;
  const mainCount = project.resolved.mainImageCount;
  const detailCount = project.resolved.detailPageCount;

  // Prompt 分支：本产线只在中间工作区推进，不跨轨、不采集 Brief
  if (design && !detailTrack && isFastMainPath(project)) {
    if (!design.mainImages.length) {
      return {
        prompt: "【Prompt 主图】请在中间工作区确认 Prompt 计划与参考图，点击生成主图。",
        focusStep: "main-image",
      };
    }
    return {
      prompt: design.mainImages.every((m) => m.imageUrl)
        ? "【Prompt 主图】主图已全部生成。要做详情页，可在中间工作区点「去做详情页」把策略层带过去。"
        : "【Prompt 主图】请继续在中间工作区生成未完成的主图。",
      focusStep: "main-image",
    };
  }

  if (design && detailTrack && isFastDetailPath(project)) {
    if (!design.detailPages.length) {
      return {
        prompt: "【Prompt 详情】请在中间工作区确认 Prompt 计划与参考图，点击生成详情屏。",
        focusStep: "detail-image",
      };
    }
    return {
      prompt: design.detailPages.every((d) => d.imageUrl)
        ? "【Prompt 详情】详情屏已全部生成。如需调整，可在中间工作区直接编辑 Prompt 后重出。"
        : "【Prompt 详情】请继续在中间工作区生成未完成的详情屏。",
      focusStep: "detail-image",
    };
  }

  if (detailTrack) {
    if (!project.meta?.countsConfirmed) return null;
    if (needsStrategyReuseDecision(project)) return null;
  } else if (!project.meta?.mainCountConfirmed) {
    return null;
  }
  if (
    !shouldSkipBrief(project) &&
    !briefComplete(project.brief) &&
    !hasValidAnalysis(resolveAnalysisForDisplay(project))
  ) {
    return null;
  }

  const analysisDisplay = resolveAnalysisForDisplay(project);
  const marketingPlansDisplay = resolveMarketingPlansForDisplay(project);

  if (!hasValidAnalysis(analysisDisplay)) {
    return {
      prompt: "【下一步】请执行 Step1：平台合规与产品深度拆解，输出完整 Step1 报告。",
      focusStep: "analysis",
    };
  }

  if (marketingPlansDisplay.length === 0) {
    return {
      prompt:
        "【下一步】请执行 Step2：输出三套差异化营销方案（须 Markdown 表格 + 末尾 product-design JSON 补丁）。",
      focusStep: "marketing",
    };
  }

  if (design?.selectedPlanNo == null) {
    return null;
  }

  const step3Done =
    hasBuyingReasonBriefContent(design.buyingReasonBrief) ||
    (design.buyingReasons?.length ?? 0) > 0;

  if (!step3Done) {
    return {
      prompt: `【下一步】已选定方案 ${design.selectedPlanNo}。请执行 Step3：将卖点转化为用户购买理由。`,
      focusStep: "reasons",
    };
  }

  // Step4 与 Step5 是主图产线专属，到出图为止；不自动跨到详情产线
  if (!detailTrack) {
    if ((design.mainImages?.length ?? 0) === 0) {
      return {
        prompt: `【下一步】请执行 Step4：生成 ${mainCount} 张主图分层定稿文案（每张职责不同，须输出 mainImages 共 ${mainCount} 条）。`,
        focusStep: "main-copy",
      };
    }
    if (!design.mainImages.every((m) => m.imageUrl)) {
      return {
        prompt:
          "【下一步】主图文案已定稿。请在中间工作区确认 Prompt 计划后出图；如需先改某张文案请说明张号。",
        focusStep: "main-image",
      };
    }
    return {
      prompt:
        "【下一步】主图产线已全部完成。如需调整某一环节，请点「修改当前步」或在中间工作区直接编辑。",
      focusStep: "main-image",
    };
  }

  if ((design.detailOutline?.length ?? 0) === 0) {
    if (!project.meta?.countsConfirmed) return null;
    return {
      prompt: `【下一步】请执行 Step7：${detailCount} 屏详情页销售逻辑框架（详情页架构规划）。只输出结构大纲，不写逐屏正文；须输出 detailOutline 共 ${detailCount} 条。`,
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
        "【下一步】详情页文案已定稿。请在中间工作区为各屏出图；如需先改某一屏文案请说明屏号。",
      focusStep: "detail-image",
    };
  }

  return {
    prompt:
      "【下一步】9 步流水线已全部完成。如需调整某一环节，请点「修改当前步」或在中间工作区直接编辑。",
    focusStep: "detail-image",
  };
}

/** 「下一步」按钮上方的情境提示 */
export function nextStepChoiceHint(project: ProductDesignProject): string | null {
  const design = project.design;
  const interactive = isInteractiveTrackWorkflow(project);
  const detailTrack = resolveActiveTrack(project) === "detail";
  if (needsBriefCollection(project)) {
    return interactive
      ? "请先点选下方选项完成信息采集，再继续；结论会同步到中间工作区供修改。"
      : "请先在中间工作区完成信息采集，再点「下一步」。";
  }
  if (!design) return "确认当前步无误后，点「下一步」继续 9 步流水线。";

  if (
    hasValidAnalysis(resolveAnalysisForDisplay(project)) &&
    resolveMarketingPlansForDisplay(project).length > 0 &&
    design.selectedPlanNo != null &&
    isMarketingPlanSelectionPhase(project)
  ) {
    return "方案已选定（不可换选），可在中间工作区编辑方案内容。确认后点「下一步」。";
  }

  if (
    hasValidAnalysis(resolveAnalysisForDisplay(project)) &&
    resolveMarketingPlansForDisplay(project).length > 0 &&
    design.selectedPlanNo == null
  ) {
    return interactive
      ? "请点选下方营销方案；内容可在中间工作区编辑。都不合适可点「重新生成三套方案」。"
      : "请点选下方营销方案；内容可在中间工作区编辑。都不合适可点「重新生成三套方案」。";
  }

  if (
    hasValidAnalysis(resolveAnalysisForDisplay(project)) &&
    resolveMarketingPlansForDisplay(project).length === 0
  ) {
    return "Step1 已完成。点「下一步」生成三套营销方案。";
  }

  if (detailTrack) {
    if (design.detailOutline.length === 0) {
      return "策略层已就绪。点「下一步」执行 Step7 详情页架构规划。";
    }
  } else if (design.mainImages.length > 0) {
    return design.mainImages.every((m) => m.imageUrl)
      ? "主图已全部生成。本工作台到此结束；要做详情页，可在中间工作区点「去做详情页」把策略层带过去。"
      : "主图文案已定稿。主图出图在中间工作区进行。";
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
      return "pdt-setup-brief";
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
