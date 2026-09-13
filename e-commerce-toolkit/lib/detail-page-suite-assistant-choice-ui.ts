import {
  buildFashionDimensionMessageLabels,
  FASHION_DIMENSION_STEPS,
  FASHION_OUTPUT_LANGUAGES,
  fashionDimensionPrompt,
  type FashionDimensionMessageLabel,
} from "@/lib/fashion-dimensions";
import type {
  DetailPageSuiteChatMessage,
  DetailPageSuitePhase,
  DetailPageSuiteProject,
  DetailPageSuiteTemplate,
} from "@/lib/detail-page-suite-types";

export const SUITE_PRODUCT_REF_ACK = "已上传产品图";
export const SUITE_PRODUCT_REF_SKIP = "暂不上传，稍后补图";
import { SUITE_PLATFORM_OPTIONS } from "@/lib/detail-page-suite-types";
import type { SeedVideoAssistantChoice } from "@/lib/seed-video-workflow";

export type SuiteHistoricalChoiceBlock = {
  title: string;
  selectedMessage: string;
  cards: SeedVideoAssistantChoice[];
};

export type SuiteLiveChoiceStep = {
  title: string;
  subtitle: string;
  progress?: string;
  choices: SeedVideoAssistantChoice[];
};

function slugId(value: string): string {
  return value.replace(/\s+/g, "-").slice(0, 48);
}

function cardsFromLabels(labels: readonly string[]): SeedVideoAssistantChoice[] {
  return labels.map((label) => ({
    id: slugId(label),
    label,
    title: label,
    message: label,
  }));
}

function dimensionStepOptions(stepIndex: number): readonly string[] {
  const step = FASHION_DIMENSION_STEPS[stepIndex];
  if (!step) return [];
  if (step.key === "platform") return SUITE_PLATFORM_OPTIONS.map((p) => p.label);
  if (step.key === "outputLanguage") return [...FASHION_OUTPUT_LANGUAGES];
  if (step.freeText) return ["都市通勤", "周末露营", "职场通勤"];
  return step.options ?? [];
}

/** 用户点选消息 → 只读卡片回放（对齐模特图 / 故事版） */
export function buildSuiteHistoricalChoiceBlock(opts: {
  userMessage: string;
  dimMeta?: FashionDimensionMessageLabel;
  templates?: DetailPageSuiteTemplate[];
}): SuiteHistoricalChoiceBlock | null {
  const trimmed = opts.userMessage.trim();
  if (!trimmed) return null;

  if (trimmed === SUITE_PRODUCT_REF_ACK || trimmed === SUITE_PRODUCT_REF_SKIP) {
    return {
      title: "已选 · 产品图",
      selectedMessage: trimmed,
      cards: cardsFromLabels([SUITE_PRODUCT_REF_ACK, SUITE_PRODUCT_REF_SKIP]),
    };
  }

  if (opts.dimMeta) {
    const step = FASHION_DIMENSION_STEPS[opts.dimMeta.stepIndex];
    if (!step) return null;
    const options = dimensionStepOptions(opts.dimMeta.stepIndex);
    const cards = cardsFromLabels(options);
    if (step.freeText && !options.includes(trimmed as (typeof options)[number])) {
      cards.push({
        id: slugId(trimmed),
        label: trimmed,
        title: trimmed,
        message: trimmed,
        description: "自定义填写",
      });
    }
    return {
      title: `已选 · ${step.label}`,
      selectedMessage: trimmed,
      cards,
    };
  }

  const sellpointActions = ["AI识图抽卖点", "AI润色卖点", "确认卖点清单"];
  if (sellpointActions.includes(trimmed)) {
    const cards = cardsFromLabels(sellpointActions);
    return { title: "已选 · 卖点", selectedMessage: trimmed, cards };
  }

  if (trimmed.startsWith("手填卖点")) {
    const lines = trimmed.split("\n").slice(1).filter(Boolean);
    return {
      title: "已选 · 手填卖点",
      selectedMessage: trimmed,
      cards: [
        {
          id: "manual-sellpoints",
          label: "手填卖点",
          title: "手填卖点",
          message: trimmed,
          description: lines.length ? lines.join("；") : "已提交手填内容",
        },
      ],
    };
  }

  if (trimmed.startsWith("选择模板·")) {
    const id = trimmed.slice("选择模板·".length);
    const tpl = opts.templates?.find((t) => t.id === id);
    return {
      title: "已选 · 套图模板",
      selectedMessage: trimmed,
      cards: [
        {
          id,
          label: tpl?.templateName ?? id,
          title: tpl?.templateName ?? id,
          message: trimmed,
        },
      ],
    };
  }

  if (trimmed === "确认模块配置") {
    return {
      title: "已选 · 大模块",
      selectedMessage: trimmed,
      cards: cardsFromLabels(["确认模块配置"]),
    };
  }

  if (trimmed.startsWith("自定义模块·")) {
    const name = trimmed.slice("自定义模块·".length);
    return {
      title: "已选 · 自定义大模块",
      selectedMessage: trimmed,
      cards: [{ id: slugId(name), label: name, title: name, message: trimmed }],
    };
  }

  if (trimmed === "随机抽取未满模块" || trimmed === "确认子维度") {
    return {
      title: "已选 · 子维度",
      selectedMessage: trimmed,
      cards: cardsFromLabels(["随机抽取未满模块", "确认子维度"]),
    };
  }

  if (trimmed === "生成全部提示词") {
    return {
      title: "已选 · 提示词",
      selectedMessage: trimmed,
      cards: cardsFromLabels(["生成全部提示词"]),
    };
  }

  if (trimmed === "生成全部图片") {
    return {
      title: "已选 · 出图",
      selectedMessage: trimmed,
      cards: cardsFromLabels(["生成全部图片"]),
    };
  }

  return null;
}

function cards(labels: readonly string[]): SeedVideoAssistantChoice[] {
  return cardsFromLabels(labels);
}

/** 当前步骤待选卡片 + 进度头文案 */
export function resolveSuiteLiveChoiceStep(opts: {
  phase: DetailPageSuitePhase;
  dimStep: number;
  templates: DetailPageSuiteTemplate[];
  hasProductRefs: boolean;
  hasSellPoints: boolean;
}): SuiteLiveChoiceStep | null {
  const { phase, dimStep, templates, hasProductRefs, hasSellPoints } = opts;

  if (phase === "product_ref") {
    return {
      title: "产品图",
      subtitle: hasProductRefs
        ? "已检测到中栏产品图，上传完成后将自动进入七维；也可点「暂不上传」跳过。"
        : "可上传多张，也可跳过。上传后可用 AI 识图抽卖点。",
      choices: cards([SUITE_PRODUCT_REF_ACK, SUITE_PRODUCT_REF_SKIP]),
    };
  }

  if (phase === "dimensions") {
    const step = FASHION_DIMENSION_STEPS[dimStep];
    if (!step) return null;
    const progress = `${dimStep + 1}/7`;
    if (step.key === "platform") {
      return {
        title: fashionDimensionPrompt(dimStep),
        subtitle: "第一期全部平台可用，模板为淘宝种子副本，可在后台改。",
        progress,
        choices: cards(SUITE_PLATFORM_OPTIONS.map((p) => p.label)),
      };
    }
    if (step.key === "outputLanguage") {
      return {
        title: fashionDimensionPrompt(dimStep),
        subtitle: step.label,
        progress,
        choices: cards(FASHION_OUTPUT_LANGUAGES),
      };
    }
    if (step.freeText) {
      return {
        title: fashionDimensionPrompt(dimStep),
        subtitle: "输入场景后在下方发送，或点选快捷示例",
        progress,
        choices: cards(["都市通勤", "周末露营", "职场通勤"]),
      };
    }
    return {
      title: fashionDimensionPrompt(dimStep),
      subtitle: step.label,
      progress,
      choices: cards(step.options ?? []),
    };
  }

  if (phase === "sellpoints") {
    const labels = ["确认卖点清单"];
    if (hasProductRefs) labels.unshift("AI识图抽卖点");
    if (hasSellPoints) labels.unshift("AI润色卖点");
    return {
      title: "卖点",
      subtitle: hasProductRefs
        ? "手填、识图或确认清单"
        : "无产品图时只能手填卖点；上传后可识图。",
      choices: cards(labels),
    };
  }

  if (phase === "template") {
    return {
      title: "套图模板",
      subtitle: "按当前平台加载系统副本或我的模板",
      choices: templates.map((t) => ({
        id: t.id,
        label: t.templateName,
        title: t.templateName,
        message: `选择模板·${t.id}`,
      })),
    };
  }

  if (phase === "modules") {
    return {
      title: "大模块",
      subtitle: "在中栏开关模块与张数；自定义模块请在下方输入后发送。",
      choices: cards(["确认模块配置"]),
    };
  }

  if (phase === "subdims") {
    return {
      title: "子维度",
      subtitle: "手选 / 随机 / 自增后确认",
      choices: cards(["随机抽取未满模块", "确认子维度"]),
    };
  }

  if (phase === "prompts") {
    return {
      title: "提示词",
      subtitle: "按开启模块生成 JSON 提示词，可改后再出图",
      choices: cards(["生成全部提示词"]),
    };
  }

  if (phase === "images") {
    return {
      title: "出图",
      subtitle: "可选模型后生成；可一次出满上限内全部张数",
      choices: cards(["生成全部图片"]),
    };
  }

  return null;
}

export function buildSuiteDimensionMessageLabels(
  messages: DetailPageSuiteChatMessage[],
) {
  return buildFashionDimensionMessageLabels(messages);
}

/** 当前步骤卡片选中态：优先 optimistic，其次按项目状态推断 */
export function shouldDetailPageSuiteAutoAdvanceProductRef(
  project: DetailPageSuiteProject,
): boolean {
  const phase = project.meta?.phase ?? "product_ref";
  return phase === "product_ref" && project.references.length > 0;
}

/** 上传产品图后自动写入会话并进入七维（幂等） */
export function buildDetailPageSuiteProductRefAutoAdvance(
  project: DetailPageSuiteProject,
): {
  chatHistory: DetailPageSuiteChatMessage[];
  meta: NonNullable<DetailPageSuiteProject["meta"]>;
} | null {
  if (!shouldDetailPageSuiteAutoAdvanceProductRef(project)) return null;

  const base = project.chatHistory;
  const hasUserAck = base.some(
    (m) => m.role === "user" && m.content.trim() === SUITE_PRODUCT_REF_ACK,
  );
  const assistantHint = "已检测到产品图，接下来请选择七维参数。";
  const hasAssistantHint = base.some(
    (m) => m.role === "assistant" && m.content.includes("七维"),
  );

  let chatHistory = base;
  if (!hasUserAck) {
    chatHistory = [
      ...chatHistory,
      {
        id: `user-auto-ref-${Date.now()}`,
        role: "user" as const,
        content: SUITE_PRODUCT_REF_ACK,
        createdAt: new Date().toISOString(),
      },
    ];
  }
  if (!hasAssistantHint) {
    chatHistory = [
      ...chatHistory,
      {
        id: `assistant-auto-ref-${Date.now()}`,
        role: "assistant" as const,
        content: assistantHint,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return {
    chatHistory,
    meta: { ...(project.meta ?? {}), phase: "dimensions", dimensionStep: 0 },
  };
}

export function resolveSuiteAssistantSelectedMessage(
  project: DetailPageSuiteProject,
): string | null {
  const phase = project.meta?.phase ?? "product_ref";

  if (phase === "product_ref") {
    if (project.references.length > 0) return SUITE_PRODUCT_REF_ACK;
    for (let i = project.chatHistory.length - 1; i >= 0; i--) {
      const m = project.chatHistory[i];
      if (m?.role !== "user") continue;
      const t = m.content.trim();
      if (t === SUITE_PRODUCT_REF_ACK || t === SUITE_PRODUCT_REF_SKIP) return t;
    }
    return null;
  }

  const live = resolveSuiteLiveChoiceStep({
    phase,
    dimStep: project.meta?.dimensionStep ?? 0,
    templates: [],
    hasProductRefs: project.references.length > 0,
    hasSellPoints: (project.brief?.sellPoints?.length ?? 0) > 0,
  });
  if (!live?.choices.length) return null;
  const choiceSet = new Set(live.choices.map((c) => c.message.trim()));
  for (let i = project.chatHistory.length - 1; i >= 0; i--) {
    const m = project.chatHistory[i];
    if (m?.role === "user" && choiceSet.has(m.content.trim())) {
      return m.content.trim();
    }
  }
  return null;
}
