import type { FashionDimensionMessageLabel } from "@/lib/fashion-dimensions";
import { buildFashionDimensionsFromChat } from "@/lib/fashion-dimensions";
import {
  FASHION_AI_POLISH_SELLPOINTS,
  FASHION_AI_SELLPOINTS_CHOICE,
  FASHION_CUSTOM_DIMENSION_CHOICE,
  FASHION_LOCK_SELLPOINTS,
  FASHION_REGENERATE_SELLPOINTS,
  FASHION_REGENERATE_STORY_THEATER,
  FASHION_USER_SELLPOINTS_CHOICE,
  buildFashionStoryboardPickChoices,
  buildProductionModeChoices,
  buildStoryTheaterVersionChoices,
  buildStoryTopicChoices,
  getSellpointInputMode,
  inferFashionChoices,
  isStoryTheaterConfirmUserMessage,
  resolveProVerticalDeliverable,
  type FashionChoice,
  type FashionWorkflowChoiceMessageLabel,
} from "@/lib/fashion-workflow";
import { getProjectVertical } from "@/lib/pro-vertical/project-vertical";
import {
  buildProDimensionsFromChat,
  getDimensionSteps,
  mergeProDimensionSources,
  resolveDimensionStepOptions,
} from "@/lib/pro-vertical/dimensions";
import {
  PRO_CATEGORY_OPTIONS,
  PRO_CATEGORY_PICK_PREFIX,
  parseProCategoryPick,
  proCategoryChoiceLabel,
} from "@/lib/pro-vertical/categories";
import {
  PRODUCTION_MODE_SCRIPT,
  PRODUCTION_MODE_STORY,
  isStoryTheaterDeliverable,
  parseStoryTheaterVersionChoice,
  parseStoryTopicChoice,
} from "@/lib/story-theater-workflow";
import type { SeedVideoAssistantChoice } from "@/lib/seed-video-workflow";
import type { StoryboardChatMessage, StoryboardProject } from "@/lib/storyboard-types";

export type FashionHistoricalChoiceBlock = {
  title: string;
  selectedMessage: string;
  cards: SeedVideoAssistantChoice[];
};

function slugId(text: string): string {
  return text.replace(/\s+/g, "-").slice(0, 48);
}

function singleCard(message: string): SeedVideoAssistantChoice[] {
  const trimmed = message.trim();
  return [
    {
      id: slugId(trimmed),
      label: trimmed,
      title: trimmed,
      message: trimmed,
    },
  ];
}

function projectAtHistory(
  project: StoryboardProject,
  priorMessages: StoryboardChatMessage[],
): StoryboardProject {
  return {
    ...project,
    chatHistory: priorMessages,
    references: project.references ?? [],
  };
}

function mapFashionChoice(c: FashionChoice): SeedVideoAssistantChoice {
  return {
    id: c.id,
    label: c.title,
    title: c.title,
    message: c.message,
    description: c.description,
    recommended: c.recommended,
  };
}

function choiceListMatchesUserMessage(
  choices: SeedVideoAssistantChoice[],
  trimmed: string,
): boolean {
  return choices.some(
    (c) => c.message === trimmed || c.title === trimmed || c.label === trimmed,
  );
}

function sellpointModeHistoricalCards(): SeedVideoAssistantChoice[] {
  return [
    mapFashionChoice({
      id: "user-sellpoints",
      title: FASHION_USER_SELLPOINTS_CHOICE,
      description: "自带卖点：输入关键词/短句，或在左侧表格填写",
      message: FASHION_USER_SELLPOINTS_CHOICE,
      recommended: true,
    }),
    mapFashionChoice({
      id: "ai-sellpoints",
      title: FASHION_AI_SELLPOINTS_CHOICE,
      description: "根据七维参数自动生成 5–8 条分层卖点",
      message: FASHION_AI_SELLPOINTS_CHOICE,
    }),
  ];
}

function sellpointLockHistoricalCards(
  project: StoryboardProject,
  priorMessages: StoryboardChatMessage[],
): SeedVideoAssistantChoice[] {
  const atPoint = projectAtHistory(project, priorMessages);
  const d = resolveProVerticalDeliverable(project);
  const lockDescription = isStoryTheaterDeliverable(d)
    ? "跳过润色，直接定稿并选择故事主题"
    : getSellpointInputMode(atPoint) === "user"
      ? "跳过润色，直接定稿并进入下一步"
      : "跳过润色，直接定稿并生成口播";

  if (getSellpointInputMode(atPoint) === "user") {
    return [
      mapFashionChoice({
        id: "polish-sellpoints",
        title: FASHION_AI_POLISH_SELLPOINTS,
        description: "可选：清洗、分层、精炼您的卖点（保持原意）",
        message: FASHION_AI_POLISH_SELLPOINTS,
      }),
      mapFashionChoice({
        id: "lock-sellpoints",
        title: FASHION_LOCK_SELLPOINTS,
        description: lockDescription,
        message: FASHION_LOCK_SELLPOINTS,
        recommended: true,
      }),
    ];
  }

  return [
    mapFashionChoice({
      id: "lock-sellpoints",
      title: FASHION_LOCK_SELLPOINTS,
      description: lockDescription,
      message: FASHION_LOCK_SELLPOINTS,
      recommended: true,
    }),
    mapFashionChoice({
      id: "regen-sellpoints",
      title: FASHION_REGENERATE_SELLPOINTS,
      message: FASHION_REGENERATE_SELLPOINTS,
    }),
  ];
}

function workflowHistoricalTitle(
  trimmed: string,
  choiceMeta?: FashionWorkflowChoiceMessageLabel,
): string {
  if (trimmed === FASHION_LOCK_SELLPOINTS) return "卖点定稿";
  if (trimmed === FASHION_AI_POLISH_SELLPOINTS) return "卖点润色";
  if (
    trimmed === FASHION_USER_SELLPOINTS_CHOICE ||
    trimmed === FASHION_AI_SELLPOINTS_CHOICE
  ) {
    return "卖点录入";
  }
  if (trimmed === FASHION_REGENERATE_SELLPOINTS) return "卖点生成";
  if (parseStoryTopicChoice(trimmed)) return "故事主题";
  if (trimmed === PRODUCTION_MODE_SCRIPT || trimmed === PRODUCTION_MODE_STORY) return "产出模式";
  if (parseStoryTheaterVersionChoice(trimmed)) return "故事版";
  return choiceMeta?.label ?? "已选方案";
}

function inferHistoricalChoiceCards(
  project: StoryboardProject,
  priorMessages: StoryboardChatMessage[],
  trimmed: string,
): SeedVideoAssistantChoice[] | null {
  const atPoint = projectAtHistory(project, priorMessages);

  if (
    trimmed === FASHION_USER_SELLPOINTS_CHOICE ||
    trimmed === FASHION_AI_SELLPOINTS_CHOICE
  ) {
    return sellpointModeHistoricalCards();
  }

  if (trimmed === FASHION_AI_POLISH_SELLPOINTS || trimmed === FASHION_LOCK_SELLPOINTS) {
    return sellpointLockHistoricalCards(project, priorMessages);
  }

  if (trimmed === FASHION_REGENERATE_SELLPOINTS) {
    return [
      mapFashionChoice({
        id: "regen-sellpoints",
        title: FASHION_REGENERATE_SELLPOINTS,
        description: "上次卖点生成未完成或失败，点此重新生成 5–8 条分层卖点",
        message: FASHION_REGENERATE_SELLPOINTS,
        recommended: true,
      }),
      mapFashionChoice({
        id: "user-sellpoints-switch",
        title: FASHION_USER_SELLPOINTS_CHOICE,
        description: "改为手动输入卖点",
        message: FASHION_USER_SELLPOINTS_CHOICE,
      }),
    ];
  }

  if (trimmed === FASHION_REGENERATE_STORY_THEATER) {
    return [
      mapFashionChoice({
        id: "regen-story-theater",
        title: FASHION_REGENERATE_STORY_THEATER,
        description: "上次故事版生成未完成或失败，点此重新生成 T1–T5 剧情分镜",
        message: FASHION_REGENERATE_STORY_THEATER,
        recommended: true,
      }),
    ];
  }

  if (trimmed === PRODUCTION_MODE_SCRIPT || trimmed === PRODUCTION_MODE_STORY) {
    return buildProductionModeChoices().map(mapFashionChoice);
  }

  const storyTopicTitle = parseStoryTopicChoice(trimmed);
  if (storyTopicTitle) {
    const d = resolveProVerticalDeliverable(project);
    const candidates = d?.storyTopicCandidates ?? [];
    if (candidates.length > 0) {
      return buildStoryTopicChoices(candidates).map(mapFashionChoice);
    }
    if (d?.selectedStoryTopic?.title === storyTopicTitle) {
      return buildStoryTopicChoices([d.selectedStoryTopic]).map(mapFashionChoice);
    }
  }

  const storyTheaterKey = parseStoryTheaterVersionChoice(trimmed);
  if (storyTheaterKey) {
    const d = resolveProVerticalDeliverable(atPoint);
    const cards = buildStoryTheaterVersionChoices(d).map(mapFashionChoice);
    if (cards.length > 0) return cards;
  }

  if (isStoryTheaterConfirmUserMessage(trimmed)) {
    const confirmCards = inferFashionChoices(atPoint).map(mapFashionChoice);
    if (confirmCards.length > 0) return confirmCards;
  }

  if (/^选择分镜\s*[A-E]版/.test(trimmed)) {
    const storyboard = buildFashionStoryboardPickChoices(atPoint).map(mapFashionChoice);
    if (storyboard.length > 0) return storyboard;
  }

  const inferred = inferFashionChoices(atPoint).map(mapFashionChoice);
  if (inferred.length > 0 && choiceListMatchesUserMessage(inferred, trimmed)) {
    return inferred;
  }

  return null;
}

function buildDimensionHistoricalBlock(opts: {
  userMessage: string;
  dimMeta: FashionDimensionMessageLabel;
  project: StoryboardProject;
  priorMessages: StoryboardChatMessage[];
}): FashionHistoricalChoiceBlock | null {
  const trimmed = opts.userMessage.trim();
  if (!trimmed) return null;

  const vertical = getProjectVertical(opts.project) ?? "fashion_apparel";
  const steps = getDimensionSteps(vertical);
  const step = steps[opts.dimMeta.stepIndex];
  if (!step) return null;

  const inferredCards = inferHistoricalChoiceCards(opts.project, opts.priorMessages, trimmed);
  if (inferredCards?.length) {
    return {
      title: step.label,
      selectedMessage: trimmed,
      cards: inferredCards,
    };
  }

  if (step.freeText) {
    return {
      title: step.label,
      selectedMessage: trimmed,
      cards: singleCard(trimmed),
    };
  }

  const fromChat =
    vertical === "fashion_apparel"
      ? buildFashionDimensionsFromChat(opts.priorMessages)
      : buildProDimensionsFromChat(vertical, opts.priorMessages);
  const dimensions = mergeProDimensionSources(vertical, fromChat);
  const options =
    (step.options?.length ?? 0) > 0
      ? step.options!
      : resolveDimensionStepOptions(vertical, step, dimensions);

  const cards: SeedVideoAssistantChoice[] = [
    ...options.map((opt) => ({
      id: `dim-${step.key}-${slugId(opt)}`,
      label: opt,
      title: opt,
      message: opt,
    })),
    {
      id: `dim-${step.key}-custom`,
      label: FASHION_CUSTOM_DIMENSION_CHOICE,
      title: FASHION_CUSTOM_DIMENSION_CHOICE,
      message: FASHION_CUSTOM_DIMENSION_CHOICE,
      description: "不在列表中时，在下方输入框填写后发送",
    },
  ];

  const isListed = options.includes(trimmed);
  const isCustomPick = trimmed === FASHION_CUSTOM_DIMENSION_CHOICE;
  if (!isListed && !isCustomPick) {
    cards.push({
      id: `dim-${step.key}-value`,
      label: trimmed,
      title: trimmed,
      message: trimmed,
      description: "自定义填写",
    });
  }

  return {
    title: step.label,
    selectedMessage: trimmed,
    cards,
  };
}

function buildWorkflowHistoricalBlock(opts: {
  userMessage: string;
  choiceMeta?: FashionWorkflowChoiceMessageLabel;
  project: StoryboardProject;
  priorMessages: StoryboardChatMessage[];
}): FashionHistoricalChoiceBlock | null {
  const trimmed = opts.userMessage.trim();
  if (!trimmed) return null;

  const categoryPick = trimmed.startsWith(PRO_CATEGORY_PICK_PREFIX);
  if (categoryPick) {
    return {
      title: "选择大类品类",
      selectedMessage: trimmed,
      cards: PRO_CATEGORY_OPTIONS.map((cat) => ({
        id: `pro-cat-${cat.id}`,
        label: cat.label,
        title: cat.label,
        message: proCategoryChoiceLabel(cat.label),
        description: cat.description,
        recommended: cat.id === "fashion",
      })),
    };
  }

  const inferredCards = inferHistoricalChoiceCards(opts.project, opts.priorMessages, trimmed);
  if (inferredCards?.length) {
    return {
      title: workflowHistoricalTitle(trimmed, opts.choiceMeta),
      selectedMessage: trimmed,
      cards: inferredCards,
    };
  }

  if (opts.choiceMeta) {
    return {
      title: opts.choiceMeta.label,
      selectedMessage: trimmed,
      cards: [
        {
          id: slugId(trimmed),
          label: trimmed,
          title: trimmed,
          message: trimmed,
          description: opts.choiceMeta.detail,
        },
      ],
    };
  }

  return null;
}

/** 七维 / workflow 用户点选 · 左侧只读卡片回放（对齐服装模特图助手） */
export function buildFashionHistoricalChoiceBlock(opts: {
  userMessage: string;
  project: StoryboardProject;
  dimMeta?: FashionDimensionMessageLabel;
  choiceMeta?: FashionWorkflowChoiceMessageLabel;
  priorMessages: StoryboardChatMessage[];
}): FashionHistoricalChoiceBlock | null {
  const trimmed = opts.userMessage.trim();
  if (parseProCategoryPick(trimmed)) {
    return buildWorkflowHistoricalBlock({
      userMessage: opts.userMessage,
      choiceMeta: opts.choiceMeta,
      project: opts.project,
      priorMessages: opts.priorMessages,
    });
  }
  if (opts.dimMeta) {
    return buildDimensionHistoricalBlock({
      userMessage: opts.userMessage,
      dimMeta: opts.dimMeta,
      project: opts.project,
      priorMessages: opts.priorMessages,
    });
  }
  return buildWorkflowHistoricalBlock({
    userMessage: opts.userMessage,
    choiceMeta: opts.choiceMeta,
    project: opts.project,
    priorMessages: opts.priorMessages,
  });
}
