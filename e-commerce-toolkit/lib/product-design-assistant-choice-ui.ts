import type { SeedVideoAssistantChoice } from "@/lib/seed-video-workflow";
import type { EcomPlatformSpec, ProductDesignChatMessage, ProductDesignProject } from "@/lib/product-design-types";
import {
  BRIEF_AI_INFER_CHOICE,
  BRIEF_FIELDS,
  BRIEF_MANUAL_INPUT_CHOICE,
  choicesForBriefField,
  countChoices,
  DETAIL_COUNT_CHOICE_PREFIX,
  DETAIL_INTERACTIVE_CHOICE,
  DETAIL_REF_PROMPT_WORKFLOW_CHOICE,
  inferAssistantChoices,
  INTERACTIVE_WORKFLOW_CHOICE,
  MAIN_COUNT_CHOICE_PREFIX,
  MAIN_REF_PROMPT_WORKFLOW_CHOICE,
  marketingPlanChoiceLabel,
  parseCountChoice,
  parseMarketingPlanChoice,
  parsePlatformChoice,
  PLATFORM_CHOICE_PREFIX,
  PRODUCT_DESIGN_MAIN_STYLE_UPLOAD_ACK,
  RECOLLECT_STRATEGY_CHOICE,
  REUSE_STRATEGY_CHOICE,
  resolveActiveTrack,
  resolveSetupPhase,
  REVISE_CHOICE,
  REVISE_DIMENSION_CHOICES,
  NEXT_STEP_CHOICE,
  REGENERATE_MARKETING_PLANS_CHOICE,
  choicePrompt,
  isReviseDimensionChoice,
} from "@/lib/product-design-workflow";
import { resolveMarketingPlansForDisplay } from "@/lib/product-design-marketing-parse";

export type ProductDesignAssistantChoiceStep = {
  title: string;
  subtitle: string;
  progress: string;
};

export type ProductDesignHistoricalChoiceBlock = {
  title: string;
  selectedMessage: string;
  cards: SeedVideoAssistantChoice[];
};

/** 旧版 assistant 气泡内嵌「· 选项」→ 只读卡片归档 */
export type ProductDesignArchivedAssistantChoiceBlock = {
  title: string;
  subtitle: string;
  cards: SeedVideoAssistantChoice[];
  selectedMessage: string | null;
};

function slugId(text: string): string {
  return text.replace(/\s+/g, "-").slice(0, 48);
}

function mainCountChoiceLabels(spec: EcomPlatformSpec): string[] {
  return countChoices(spec.mainImage.min, spec.mainImage.max, spec.mainImage.recommended).map(
    (n) => `${MAIN_COUNT_CHOICE_PREFIX}${n} 张`,
  );
}

function detailCountChoiceLabels(spec: EcomPlatformSpec): string[] {
  return countChoices(spec.detailPage.min, spec.detailPage.max, spec.detailPage.recommended).map(
    (n) => `${DETAIL_COUNT_CHOICE_PREFIX}${n} 屏`,
  );
}

function marketingPlanHistoryLabels(project: ProductDesignProject): string[] {
  const plans = resolveMarketingPlansForDisplay(project);
  const planLabels = plans.map((p) => marketingPlanChoiceLabel(p.no));
  if (planLabels.length === 0) return [];
  if (project.design?.selectedPlanNo != null) {
    return [NEXT_STEP_CHOICE, REVISE_CHOICE];
  }
  return [...planLabels, REGENERATE_MARKETING_PLANS_CHOICE, REVISE_CHOICE];
}

function findBriefFieldForMessage(
  project: ProductDesignProject,
  trimmed: string,
): (typeof BRIEF_FIELDS)[number] | null {
  for (const field of BRIEF_FIELDS) {
    const opts = choicesForBriefField(project, field);
    if (opts.includes(trimmed)) return field;
  }
  return null;
}

function resolveHistoricalChoiceMessages(
  trimmed: string,
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): string[] | null {
  if (trimmed === INTERACTIVE_WORKFLOW_CHOICE || trimmed === MAIN_REF_PROMPT_WORKFLOW_CHOICE) {
    return [INTERACTIVE_WORKFLOW_CHOICE, MAIN_REF_PROMPT_WORKFLOW_CHOICE];
  }
  if (trimmed === DETAIL_INTERACTIVE_CHOICE || trimmed === DETAIL_REF_PROMPT_WORKFLOW_CHOICE) {
    return [DETAIL_INTERACTIVE_CHOICE, DETAIL_REF_PROMPT_WORKFLOW_CHOICE];
  }
  if (parsePlatformChoice(trimmed, specs)) {
    return specs.map((s) => `${PLATFORM_CHOICE_PREFIX}${s.label}`);
  }
  if (parseCountChoice(trimmed, MAIN_COUNT_CHOICE_PREFIX) != null) {
    const spec = specs.find((s) => s.code === project.platform);
    return spec ? mainCountChoiceLabels(spec) : [trimmed];
  }
  if (parseCountChoice(trimmed, DETAIL_COUNT_CHOICE_PREFIX) != null) {
    const spec = specs.find((s) => s.code === project.platform);
    return spec ? detailCountChoiceLabels(spec) : [trimmed];
  }
  if (trimmed === REUSE_STRATEGY_CHOICE || trimmed === RECOLLECT_STRATEGY_CHOICE) {
    return [REUSE_STRATEGY_CHOICE, RECOLLECT_STRATEGY_CHOICE];
  }
  if (trimmed === BRIEF_AI_INFER_CHOICE || trimmed === BRIEF_MANUAL_INPUT_CHOICE) {
    return [BRIEF_AI_INFER_CHOICE, BRIEF_MANUAL_INPUT_CHOICE];
  }
  if (parseMarketingPlanChoice(trimmed) != null || trimmed === REGENERATE_MARKETING_PLANS_CHOICE) {
    const group = marketingPlanHistoryLabels(project);
    return group.length > 0 ? group : [trimmed];
  }
  if (isReviseDimensionChoice(trimmed)) {
    return [...REVISE_DIMENSION_CHOICES, NEXT_STEP_CHOICE];
  }
  if (trimmed === NEXT_STEP_CHOICE || trimmed === REVISE_CHOICE) {
    if (project.meta?.reviseMode) {
      return [...REVISE_DIMENSION_CHOICES, NEXT_STEP_CHOICE];
    }
    const plans = marketingPlanHistoryLabels(project);
    if (plans.includes(trimmed)) return plans;
    return [NEXT_STEP_CHOICE, REVISE_CHOICE];
  }
  const briefField = findBriefFieldForMessage(project, trimmed);
  if (briefField) {
    return choicesForBriefField(project, briefField);
  }
  const live = inferAssistantChoices(project, specs);
  if (live.includes(trimmed)) {
    return live;
  }
  return null;
}

export function historicalBlockTitle(
  trimmed: string,
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): string {
  if (trimmed === INTERACTIVE_WORKFLOW_CHOICE || trimmed === MAIN_REF_PROMPT_WORKFLOW_CHOICE) {
    return "已选 · 主图制作方式";
  }
  if (trimmed === DETAIL_INTERACTIVE_CHOICE || trimmed === DETAIL_REF_PROMPT_WORKFLOW_CHOICE) {
    return "已选 · 详情页制作方式";
  }
  if (parsePlatformChoice(trimmed, specs)) return "已选 · 上架平台";
  if (parseCountChoice(trimmed, MAIN_COUNT_CHOICE_PREFIX) != null) return "已选 · 主图张数";
  if (parseCountChoice(trimmed, DETAIL_COUNT_CHOICE_PREFIX) != null) return "已选 · 详情屏数";
  if (trimmed === REUSE_STRATEGY_CHOICE || trimmed === RECOLLECT_STRATEGY_CHOICE) {
    return "已选 · 策略层";
  }
  if (trimmed === BRIEF_AI_INFER_CHOICE || trimmed === BRIEF_MANUAL_INPUT_CHOICE) {
    return "已选 · 信息采集方式";
  }
  if (parseMarketingPlanChoice(trimmed) != null || trimmed === REGENERATE_MARKETING_PLANS_CHOICE) {
    return "已选 · 营销方案";
  }
  if (isReviseDimensionChoice(trimmed) || project.meta?.reviseMode) {
    return "已选 · 修改维度";
  }
  const briefField = findBriefFieldForMessage(project, trimmed);
  if (briefField) return `已选 · ${briefField.label}`;
  return "已选方案";
}

function cardFromMessage(message: string): SeedVideoAssistantChoice {
  let title = message;
  if (message.startsWith(PLATFORM_CHOICE_PREFIX)) {
    title = message.slice(PLATFORM_CHOICE_PREFIX.length).trim() || message;
  }
  return {
    id: slugId(message),
    label: message,
    title,
    message,
  };
}

export function buildProductDesignAssistantChoiceCards(
  _project: ProductDesignProject,
  choiceMessages: string[],
): SeedVideoAssistantChoice[] {
  return choiceMessages.map((message) => cardFromMessage(message));
}

export function inferProductDesignAssistantChoiceCards(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): SeedVideoAssistantChoice[] {
  return buildProductDesignAssistantChoiceCards(project, inferAssistantChoices(project, specs));
}

export function resolveProductDesignAssistantChoiceStep(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): ProductDesignAssistantChoiceStep | null {
  const choices = inferAssistantChoices(project, specs);
  if (choices.length === 0) return null;
  const subtitle = choicePrompt(project, specs);
  const phase = resolveSetupPhase(project);
  const detailTrack = resolveActiveTrack(project) === "detail";

  if (phase === "workflow-choice") {
    return {
      title: detailTrack ? "选择详情页制作方式" : "选择主图制作方式",
      subtitle,
      progress: "准备",
    };
  }
  if (parsePlatformChoice(choices[0] ?? "", specs) || choices[0]?.startsWith(PLATFORM_CHOICE_PREFIX)) {
    return { title: "选择上架平台", subtitle, progress: "平台" };
  }
  if (choices[0]?.startsWith(MAIN_COUNT_CHOICE_PREFIX)) {
    return { title: "确认主图张数", subtitle, progress: "张数" };
  }
  if (choices[0]?.startsWith(DETAIL_COUNT_CHOICE_PREFIX)) {
    return { title: "确认详情屏数", subtitle, progress: "屏数" };
  }
  if (choices.includes(REUSE_STRATEGY_CHOICE)) {
    return { title: "策略层复用", subtitle, progress: "策略" };
  }
  if (choices.includes(BRIEF_AI_INFER_CHOICE)) {
    return { title: "信息采集方式", subtitle, progress: "Step0" };
  }
  const field = findBriefFieldForMessage(project, choices[0] ?? "");
  if (field || choices.some((c) => findBriefFieldForMessage(project, c))) {
    const f = field ?? findBriefFieldForMessage(project, choices[0]!);
    return {
      title: f ? `信息采集 · ${f.label}` : "信息采集",
      subtitle,
      progress: "Step0",
    };
  }
  if (choices.some((c) => parseMarketingPlanChoice(c) != null)) {
    return { title: "选择营销方案", subtitle, progress: "Step2" };
  }
  if (project.meta?.reviseMode || choices.some((c) => isReviseDimensionChoice(c))) {
    return { title: "修改当前步", subtitle, progress: "修订" };
  }
  return { title: "继续流程", subtitle, progress: "进行中" };
}

export function resolveProductDesignAssistantSelectedMessage(
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
  messages: ProductDesignChatMessage[],
): string | null {
  const choiceMessages = inferAssistantChoices(project, specs);
  if (choiceMessages.length === 0) return null;
  const choiceSet = new Set(choiceMessages);
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && choiceSet.has(m.content.trim())) {
      return m.content.trim();
    }
  }
  return null;
}

export function buildProductDesignHistoricalChoiceBlock(
  userMessage: string,
  project: ProductDesignProject,
  specs: EcomPlatformSpec[],
): ProductDesignHistoricalChoiceBlock | null {
  const trimmed = userMessage.trim();
  if (!trimmed) return null;
  const group = resolveHistoricalChoiceMessages(trimmed, project, specs);
  if (!group) return null;
  return {
    title: historicalBlockTitle(trimmed, project, specs),
    selectedMessage: trimmed,
    cards: buildProductDesignAssistantChoiceCards(project, group),
  };
}

/** 解析 assistant 消息里「· 选项1 · 选项2」旧格式（新消息不再写入选项正文） */
export function parseProductDesignAssistantEmbeddedChoices(
  content: string,
): { choiceMessages: string[]; leadText: string } | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const workflowPairs: [string, string][] = [
    [INTERACTIVE_WORKFLOW_CHOICE, MAIN_REF_PROMPT_WORKFLOW_CHOICE],
    [DETAIL_INTERACTIVE_CHOICE, DETAIL_REF_PROMPT_WORKFLOW_CHOICE],
  ];
  for (const pair of workflowPairs) {
    if (pair.every((c) => trimmed.includes(c))) {
      const leadLines = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^[·•\-]\s/.test(l));
      return {
        choiceMessages: [...pair],
        leadText: leadLines[0] ?? "请点选下方选项",
      };
    }
  }

  if (/请点选下方主图制作方式/u.test(trimmed)) {
    return {
      choiceMessages: [INTERACTIVE_WORKFLOW_CHOICE, MAIN_REF_PROMPT_WORKFLOW_CHOICE],
      leadText: trimmed.split("\n")[0]?.trim() || trimmed,
    };
  }
  if (/请点选下方详情页制作方式/u.test(trimmed)) {
    return {
      choiceMessages: [DETAIL_INTERACTIVE_CHOICE, DETAIL_REF_PROMPT_WORKFLOW_CHOICE],
      leadText: trimmed.split("\n")[0]?.trim() || trimmed,
    };
  }

  const bullets: string[] = [];
  for (const line of trimmed.split("\n")) {
    const m = /^[·•\-]\s*(.+)$/.exec(line.trim());
    if (m?.[1]) bullets.push(m[1].trim());
  }
  if (bullets.length >= 2) {
    const leadLines = trimmed
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^[·•\-]\s/.test(l));
    return {
      choiceMessages: bullets,
      leadText: leadLines[0] ?? "请点选下方选项",
    };
  }
  return null;
}

function archivedTitleForChoiceMessages(choiceMessages: string[]): string {
  if (
    choiceMessages.includes(INTERACTIVE_WORKFLOW_CHOICE) ||
    choiceMessages.includes(MAIN_REF_PROMPT_WORKFLOW_CHOICE)
  ) {
    return "选择主图制作方式";
  }
  if (
    choiceMessages.includes(DETAIL_INTERACTIVE_CHOICE) ||
    choiceMessages.includes(DETAIL_REF_PROMPT_WORKFLOW_CHOICE)
  ) {
    return "选择详情页制作方式";
  }
  if (choiceMessages.some((c) => c.startsWith(PLATFORM_CHOICE_PREFIX))) {
    return "选择上架平台";
  }
  if (choiceMessages.some((c) => c.startsWith(MAIN_COUNT_CHOICE_PREFIX))) {
    return "确认主图张数";
  }
  if (choiceMessages.some((c) => c.startsWith(DETAIL_COUNT_CHOICE_PREFIX))) {
    return "确认详情屏数";
  }
  if (
    choiceMessages.includes(REUSE_STRATEGY_CHOICE) ||
    choiceMessages.includes(RECOLLECT_STRATEGY_CHOICE)
  ) {
    return "策略层复用";
  }
  if (
    choiceMessages.includes(BRIEF_AI_INFER_CHOICE) ||
    choiceMessages.includes(BRIEF_MANUAL_INPUT_CHOICE)
  ) {
    return "信息采集方式";
  }
  return "请选择";
}

/** 在该 assistant 提示之后，用户是否已点选工作流选项之一 */
export function resolveProductDesignSelectionAfterAssistantPrompt(
  messages: ProductDesignChatMessage[],
  assistantIndex: number,
  choiceMessages: string[],
): string | null {
  const choiceSet = new Set(choiceMessages);
  for (let j = assistantIndex + 1; j < messages.length; j++) {
    const m = messages[j];
    if (m.role === "user") {
      const t = m.content.trim();
      if (choiceSet.has(t)) return t;
    }
  }
  return null;
}

function isSupersededWorkflowChoiceAssistant(
  messages: ProductDesignChatMessage[],
  assistantIndex: number,
): boolean {
  for (let j = assistantIndex + 1; j < messages.length; j++) {
    const m = messages[j];
    if (m.role === "assistant" && parseProductDesignAssistantEmbeddedChoices(m.content)) {
      return true;
    }
  }
  return false;
}

export function buildProductDesignArchivedAssistantChoiceBlock(
  assistantContent: string,
  messages: ProductDesignChatMessage[],
  messageIndex: number,
): ProductDesignArchivedAssistantChoiceBlock | null {
  const parsed = parseProductDesignAssistantEmbeddedChoices(assistantContent);
  if (!parsed) return null;
  const selectedMessage = resolveProductDesignSelectionAfterAssistantPrompt(
    messages,
    messageIndex,
    parsed.choiceMessages,
  );
  if (selectedMessage) return null;
  if (isSupersededWorkflowChoiceAssistant(messages, messageIndex)) return null;
  return {
    title: archivedTitleForChoiceMessages(parsed.choiceMessages),
    subtitle: parsed.leadText,
    cards: buildProductDesignAssistantChoiceCards({} as ProductDesignProject, parsed.choiceMessages),
    selectedMessage: null,
  };
}
