"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomAssistantCollapsibleLayout } from "@/components/layout/ecom-assistant-collapsible-layout";
import { EcomAssistantPanelHeader } from "@/components/layout/ecom-assistant-panel-header";
import { EcomAssistantSendButton } from "@/components/layout/ecom-assistant-send-button";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { STORYBOARD_ASSISTANT_CHOICE_CLASS } from "@/components/storyboard/storyboard-assistant-choices";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  streamProductDesignChat,
  syncProductDesign,
  suggestProductDesignBrief,
  updateProductDesignProject,
  getProductDesignProject,
} from "@/lib/ecom-product-design-api";
import {
  buildProductDesignNextStepCommand,
  choicePrompt,
  CONFIRM_BRIEF_MULTI_CHOICE,
  CONFIRM_TRUST_BADGE_CHOICE,
  CUSTOM_INPUT_CHOICE,
  DETAIL_COUNT_CHOICE_PREFIX,
  DETAIL_INTERACTIVE_CHOICE,
  DETAIL_REF_PROMPT_WORKFLOW_CHOICE,
  inferAssistantChoices,
  inferAssistantMessageStep,
  isBriefSuggestionsPending,
  INTERACTIVE_WORKFLOW_CHOICE,
  isBriefMultiToggleOption,
  isBriefAiSuggestionChoice,
  isPrimaryBriefAction,
  isTrustBadgeOption,
  MAIN_COUNT_CHOICE_PREFIX,
  MAIN_REF_PROMPT_WORKFLOW_CHOICE,
  marketingPlanChoiceLabel,
  needsBriefCollection,
  nextBriefField,
  nextStepChoiceHint,
  NO_TRUST_BADGE_CHOICE,
  parseCountChoice,
  parseMarketingPlanChoice,
  parsePlatformChoice,
  productDesignAssistantAnchorId,
  resolveProductDesignStepStates,
  stepsForTrack,
  PRODUCT_DESIGN_STEPS,
  REGENERATE_MARKETING_PLANS_CHOICE,
  BRIEF_AI_INFER_CHOICE,
  BRIEF_MANUAL_INPUT_CHOICE,
  REUSE_STRATEGY_CHOICE,
  RECOLLECT_STRATEGY_CHOICE,
  workflowPathToGenMode,
  REVISE_CHOICE,
  REVISE_DIMENSION_CHOICES,
  NEXT_STEP_CHOICE,
  resolveActiveTrack,
  type DetailWorkflowPath,
  type MainWorkflowPath,
  type ProductDesignStepId,
  type ProductionTrack,
} from "@/lib/product-design-workflow";
import { resolveMarketingPlansForDisplay } from "@/lib/product-design-marketing-parse";
import { toAssistantChatContent } from "@/lib/product-design-assistant-display";
import type {
  EcomPlatformSpec,
  ProductDesignBrief,
  ProductDesignChatMessage,
  ProductDesignProject,
} from "@/lib/product-design-types";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_CHOICE_SHELL_CLASS,
  ECOM_ASSISTANT_COMPOSER_SHELL_BASE,
  ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
} from "@/lib/ecom-assistant-chat-styles";
import { cn } from "@/lib/utils";

type ProjectPatch = Parameters<typeof updateProductDesignProject>[1];

type OptimisticProjectPatch = {
  platform?: string;
  settings?: ProductDesignProject["settings"];
  brief?: ProductDesignBrief;
  meta?: Record<string, unknown>;
};

function mergeOptimisticPatch(
  prev: OptimisticProjectPatch | null,
  patch: ProjectPatch,
  project: ProductDesignProject,
): OptimisticProjectPatch {
  return {
    platform: patch.platform ?? prev?.platform,
    settings: patch.settings
      ? { ...(prev?.settings ?? project.settings), ...patch.settings }
      : prev?.settings,
    brief: patch.brief
      ? ({ ...(prev?.brief ?? project.brief ?? {}), ...patch.brief } as ProductDesignBrief)
      : prev?.brief,
    meta: patch.meta ? { ...(prev?.meta ?? {}), ...patch.meta } : prev?.meta,
  };
}

function optimisticPatchSynced(
  project: ProductDesignProject,
  optimistic: OptimisticProjectPatch,
): boolean {
  if (optimistic.platform !== undefined && project.platform !== optimistic.platform) {
    return false;
  }
  if (optimistic.settings) {
    for (const [k, v] of Object.entries(optimistic.settings)) {
      if (project.settings?.[k as keyof ProductDesignProject["settings"]] !== v) {
        return false;
      }
    }
  }
  if (optimistic.brief) {
    for (const [k, v] of Object.entries(optimistic.brief)) {
      if (project.brief?.[k as keyof ProductDesignBrief] !== v) {
        return false;
      }
    }
  }
  if (optimistic.meta) {
    for (const [k, v] of Object.entries(optimistic.meta)) {
      if (project.meta?.[k] !== v) return false;
    }
  }
  return true;
}

function welcomeMessage(track: ProductionTrack): ProductDesignChatMessage {
  const scope =
    track === "detail"
      ? "本工作台只做 **产品详情页**。若已在「电商产品主图创作」做过同一款产品，可点顶部「从主图项目导入」带入 Step0–3 的策略层，不必重填。"
      : "本工作台只做 **产品主图**。主图出齐后，中间工作区会出现入口，一键把策略层带去「电商产品详情页创作」。";
  return {
    id: "welcome",
    role: "assistant",
    content: `你好，我是【电商商品视觉全链路设计 Agent】。

${scope}可选择 **助手流程（Step by step）** 或 **参考图 + Prompt**。

**本栏**：过程、结论与全部点选交互（制作方式、平台/张数、信息采集、方案、下一步 / 修改当前步）。  
**中间工作区**：上传产品图与参考图（参考可选）、展示结论供铅笔修改、出图与 Prompt 计划。

请先在中间工作区上传 **产品实拍图（必传）**；上传完成后在本栏点选制作方式。`,
    createdAt: new Date().toISOString(),
  };
}

const REVISE_PROMPTS: Record<(typeof REVISE_DIMENSION_CHOICES)[number], string> = {
  "修改：核心目标人群": "请根据当前 Step1 拆解，重新分析并更新【核心目标人群】相关结论，输出完整 Step1 报告。",
  "修改：痛点与优势": "请根据当前 Step1 拆解，重新分析并更新【表层痛点、深层需求、差异化竞争力】，输出完整 Step1 报告。",
  "修改：视觉调性": "请根据当前 Step1 拆解，重新分析并更新【视觉调性建议】，输出完整 Step1 报告。",
  "修改：平台策略侧重": "请根据当前 Step1 拆解，重新分析并更新【平台浏览习惯与策略侧重】，输出完整 Step1 报告。",
};

type Props = {
  project: ProductDesignProject;
  specs: EcomPlatformSpec[];
  chatModels: StoryboardGatewayModel[];
  chatModelKey: string;
  visionModelKey?: string;
  onProjectChange: () => void | Promise<void>;
  onStreamingChange?: (streaming: boolean) => void;
  onRequestGenerateMainImages?: () => void;
  onRequestGenerateDetailImages?: () => void;
  startStep1Token?: number;
  startDetailOutlineToken?: number;
  regenerateMarketingPlansToken?: number;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  focusStepId?: ProductDesignStepId | null;
  onFocusStep?: (stepId: ProductDesignStepId) => void;
  onChooseDetailWorkflow?: (mode: DetailWorkflowPath) => void;
  onBriefComplete?: () => void;
  onRegenerateMarketingPlans?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function ProductDesignAssistantPanel({
  project,
  specs,
  chatModels,
  chatModelKey,
  visionModelKey,
  onProjectChange,
  onStreamingChange,
  onRequestGenerateMainImages,
  onRequestGenerateDetailImages,
  startStep1Token = 0,
  startDetailOutlineToken = 0,
  regenerateMarketingPlansToken = 0,
  composerWide = false,
  onComposerWideChange,
  focusStepId = null,
  onFocusStep,
  onChooseDetailWorkflow,
  onBriefComplete,
  onRegenerateMarketingPlans,
  collapsed = false,
  onCollapsedChange,
}: Props) {
  const projectId = project.id;
  const chatHistory = project.chatHistory;
  const track = resolveActiveTrack(project);
  const [messages, setMessages] = useState<ProductDesignChatMessage[]>(
    chatHistory.length ? chatHistory : [welcomeMessage(track)],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [optimisticPatch, setOptimisticPatch] = useState<OptimisticProjectPatch | null>(null);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [briefSuggesting, setBriefSuggesting] = useState(false);
  const [briefMultiDraft, setBriefMultiDraft] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // 只在切换项目时重置输入与乐观态；消息本身由下方 chatHistory 副作用负责填充
  useEffect(() => {
    setInput("");
    setOptimisticPatch(null);
  }, [projectId]);

  useEffect(() => {
    if (!optimisticPatch) return;
    if (optimisticPatchSynced(project, optimisticPatch)) {
      setOptimisticPatch(null);
    }
  }, [project, optimisticPatch]);

  useEffect(() => {
    if (streaming) return;
    if (chatHistory.length) setMessages(chatHistory);
    else setMessages([welcomeMessage(track)]);
  }, [chatHistory, streaming, track]);

  useEffect(() => {
    onStreamingChange?.(streaming || briefSuggesting);
  }, [streaming, briefSuggesting, onStreamingChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: streaming ? "auto" : "smooth" });
  }, [messages, streamText, streaming]);

  useEffect(() => {
    if (!focusStepId) return;
    const root = scrollRef.current;
    if (!root) return;
    stickToBottomRef.current = false;
    const order = PRODUCT_DESIGN_STEPS.map((s) => s.id);
    const start = order.indexOf(focusStepId);
    let target: HTMLElement | null = null;
    for (let i = start; i >= 0; i--) {
      const el = root.querySelector<HTMLElement>(
        `#${productDesignAssistantAnchorId(order[i]!)}`,
      );
      if (el) {
        target = el;
        break;
      }
    }
    target ??= root.querySelector<HTMLElement>(
      `#${productDesignAssistantAnchorId("brief")}`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusStepId, messages, streamText, streaming]);

  useEffect(() => {
    setBriefMultiDraft([]);
  }, [projectId, nextBriefField(project.brief)?.key]);

  useEffect(() => {
    if (!needsBriefCollection(project)) setBriefSuggesting(false);
  }, [project]);

  const effectiveProject = useMemo<ProductDesignProject>(
    () => ({
      ...project,
      platform: optimisticPatch?.platform ?? project.platform,
      settings: { ...project.settings, ...optimisticPatch?.settings },
      brief: optimisticPatch?.brief ?? project.brief,
      meta: optimisticPatch?.meta
        ? { ...(project.meta ?? {}), ...optimisticPatch.meta }
        : project.meta,
      chatHistory: messages.filter(
        (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
      ),
    }),
    [project, messages, optimisticPatch],
  );

  const briefInferBusy =
    briefSuggesting || isBriefSuggestionsPending(effectiveProject);
  const choices =
    streaming || choiceBusy || briefInferBusy
      ? []
      : inferAssistantChoices(effectiveProject, specs);
  const prompt = choicePrompt(effectiveProject, specs);
  const pendingBriefField = nextBriefField(effectiveProject.brief);

  const appendLocal = useCallback(
    async (userText: string, assistantText: string, patch?: ProjectPatch) => {
      const now = new Date().toISOString();
      const next: ProductDesignChatMessage[] = [
        ...messages.filter((m) => m.id !== "welcome"),
        { id: `user-${Date.now()}`, role: "user", content: userText, createdAt: now },
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: assistantText,
          createdAt: now,
        },
      ];
      if (patch) {
        setOptimisticPatch((prev) => mergeOptimisticPatch(prev, patch, project));
      }
      setMessages(next);
      await updateProductDesignProject(projectId, { ...patch, chatHistory: next });
      await onProjectChange();
      return next;
    },
    [messages, project, projectId, onProjectChange],
  );

  const saveBriefFromChat = useCallback(
    async (stored: string | string[]) => {
      const field = nextBriefField(effectiveProject.brief);
      if (!field) return;
      const briefPatch = { [field.key]: stored } as ProductDesignBrief;
      const mergedBrief = {
        ...(effectiveProject.brief ?? {}),
        ...briefPatch,
      } as ProductDesignBrief;
      setBriefMultiDraft([]);
      if (!nextBriefField(mergedBrief)) {
        onBriefComplete?.();
        await appendLocal(
          Array.isArray(stored) ? stored.join("、") : stored,
          "信息采集已完成。结论已同步到中间工作区，可随时修改；确认无误后点 **下一步** 开始平台拆解。",
          { brief: briefPatch },
        );
        return;
      }
      const nextField = nextBriefField(mergedBrief)!;
      await appendLocal(
        Array.isArray(stored) ? stored.join("、") : stored,
        `${nextField.prompt}\n\n（已填项会同步到中间工作区，可用铅笔修改）`,
        { brief: briefPatch },
      );
    },
    [appendLocal, effectiveProject.brief, onBriefComplete],
  );

  const runLlm = useCallback(
    async (text: string, historyBase?: ProductDesignChatMessage[]) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const prior = historyBase ?? messages;
      const base: ProductDesignChatMessage[] = [
        ...prior.filter((m) => m.id !== "welcome"),
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmed,
          createdAt: new Date().toISOString(),
        },
      ];
      setInput("");
      setMessages(base);
      stickToBottomRef.current = true;
      setStreaming(true);
      setStreamText("");

      try {
        const full = await streamProductDesignChat({
          projectId,
          messages: base,
          modelKey: chatModelKey,
          onChunk: setStreamText,
        });
        setMessages([
          ...base,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: toAssistantChatContent(full) || full,
            createdAt: new Date().toISOString(),
          },
        ]);
        setStreamText("");
        await onProjectChange();
        try {
          await syncProductDesign(projectId);
          await onProjectChange();
        } catch {
          /* 结构化解析失败时保留聊天内容 */
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : "发送失败";
        setMessages([
          ...base,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: `请求失败：${err}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        setStreamText("");
      } finally {
        setStreaming(false);
      }
    },
    [streaming, messages, projectId, chatModelKey, onProjectChange],
  );

  async function handleChooseMainWorkflowFromChat(mode: MainWorkflowPath) {
    const isInteractive = mode === "interactive";
    const userText = isInteractive
      ? INTERACTIVE_WORKFLOW_CHOICE
      : MAIN_REF_PROMPT_WORKFLOW_CHOICE;
    const assistantText = isInteractive
      ? "好的，请点选下方上架平台。确认平台后再选主图数量，并完成信息采集；结论会同步到中间工作区供修改。"
      : "请在中间工作区选择平台、填写 Prompt（参考图可选），进入 Prompt 计划后拆解并确认。";
    await appendLocal(userText, assistantText, {
      meta: {
        mainWorkflowPath: mode,
        setupPhase: "platform",
        platformConfirmed: false,
        mainCountConfirmed: false,
        countsConfirmed: false,
      },
      settings: { mainImageGenMode: workflowPathToGenMode(mode) },
    });
    if (!isInteractive) onFocusStep?.("main-image");
  }

  /** Step0 读图推断：仅在用户点选「AI 拆解」后才发起视觉调用 */
  async function handleBriefInferModeChoice(mode: "ai" | "manual") {
    const field = nextBriefField(effectiveProject.brief);
    if (mode === "manual") {
      await appendLocal(
        BRIEF_MANUAL_INPUT_CHOICE,
        field
          ? `好的，全部手动填写。${field.prompt}`
          : "好的，全部手动填写。",
        { meta: { briefInferMode: "manual" } },
      );
      return;
    }

    setBriefSuggesting(true);
    try {
      await appendLocal(
        BRIEF_AI_INFER_CHOICE,
        "正在读取产品图，推断产品名、目标人群、核心痛点与核心优势…",
        { meta: { briefInferMode: "ai" } },
      );
      await suggestProductDesignBrief(projectId, { modelKey: visionModelKey });
      await onProjectChange();
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `读图推断失败：${e instanceof Error ? e.message : String(e)}。可点「手动输入」继续。`,
          createdAt: new Date().toISOString(),
        },
      ]);
      await updateProductDesignProject(projectId, {
        meta: { briefInferMode: "manual" },
      });
      await onProjectChange();
    } finally {
      setBriefSuggesting(false);
    }
  }

  /** 详情产线：沿用主图阶段已产出的 Step0–3 策略层，或重新采集 */
  async function handleStrategyReuseChoice(reuse: boolean) {
    if (reuse) {
      await appendLocal(
        REUSE_STRATEGY_CHOICE,
        "已沿用现有策略层（信息采集、平台拆解、营销方案、购买理由）。点 **下一步** 开始 Step7 详情页架构规划。",
        { meta: { strategyReuse: "reuse" } },
      );
      return;
    }
    await appendLocal(
      RECOLLECT_STRATEGY_CHOICE,
      "好的。请在中间工作区用铅笔修改 Step0–3 的策略层内容（营销方案名不可改，其余字段均可编辑），改完回到本栏点 **下一步** 开始 Step7。",
      { meta: { strategyReuse: "edit" } },
    );
    onFocusStep?.("marketing");
  }

  async function handleChoiceInner(text: string) {
    if (text === INTERACTIVE_WORKFLOW_CHOICE) {
      await handleChooseMainWorkflowFromChat("interactive");
      return;
    }
    if (text === MAIN_REF_PROMPT_WORKFLOW_CHOICE) {
      await handleChooseMainWorkflowFromChat("prompt");
      return;
    }
    if (text === DETAIL_INTERACTIVE_CHOICE) {
      onChooseDetailWorkflow?.("interactive");
      return;
    }
    if (text === DETAIL_REF_PROMPT_WORKFLOW_CHOICE) {
      onChooseDetailWorkflow?.("prompt");
      return;
    }
    if (text === BRIEF_AI_INFER_CHOICE) {
      await handleBriefInferModeChoice("ai");
      return;
    }
    if (text === BRIEF_MANUAL_INPUT_CHOICE) {
      await handleBriefInferModeChoice("manual");
      return;
    }
    if (text === REUSE_STRATEGY_CHOICE || text === RECOLLECT_STRATEGY_CHOICE) {
      await handleStrategyReuseChoice(text === REUSE_STRATEGY_CHOICE);
      return;
    }

    const platformSpec = parsePlatformChoice(text, specs);
    if (platformSpec) {
      await appendLocal(
        text,
        `已选择【${platformSpec.label}】。请点选下方主图张数。`,
        {
          platform: platformSpec.code,
          settings: {
            mainImageCount: platformSpec.mainImage.recommended,
            detailPageCount: platformSpec.detailPage.recommended,
            mainImageRatio: platformSpec.mainImage.ratio,
            detailPageRatio: platformSpec.detailPage.ratio,
          },
          meta: {
            setupPhase: "done",
            platformConfirmed: true,
            mainCountConfirmed: false,
            countsConfirmed: false,
          },
        },
      );
      return;
    }

    const mainCount = parseCountChoice(text, MAIN_COUNT_CHOICE_PREFIX);
    if (mainCount != null) {
      const field = nextBriefField(effectiveProject.brief);
      await appendLocal(
        text,
        field
          ? `${field.prompt}\n\n（完成后结论同步到中间工作区，可铅笔修改）`
          : "参数已确认。点 **下一步** 开始平台拆解。",
        {
          settings: { mainImageCount: mainCount },
          meta: { mainCountConfirmed: true },
        },
      );
      return;
    }

    const detailCount = parseCountChoice(text, DETAIL_COUNT_CHOICE_PREFIX);
    if (detailCount != null) {
      await appendLocal(
        text,
        "详情屏数已确认。请点选下方详情页制作方式。",
        {
          settings: { detailPageCount: detailCount },
          meta: { countsConfirmed: true, setupPhase: "done" },
        },
      );
      return;
    }

    if (text === REGENERATE_MARKETING_PLANS_CHOICE) {
      onRegenerateMarketingPlans?.();
      return;
    }

    if (text === CUSTOM_INPUT_CHOICE) {
      await appendLocal(
        text,
        "请在下方输入框填写内容后发送；也可在中间工作区点「自己输入」。",
        {},
      );
      return;
    }

    if (pendingBriefField && isPrimaryBriefAction(text)) {
      const stored =
        pendingBriefField.key === "hasTrustBadge" &&
        briefMultiDraft.includes(NO_TRUST_BADGE_CHOICE)
          ? [NO_TRUST_BADGE_CHOICE]
          : briefMultiDraft;
      if (stored.length === 0) {
        await appendLocal(text, "请至少选择一项，或点「自己输入」。", {});
        return;
      }
      await saveBriefFromChat(stored);
      return;
    }

    if (pendingBriefField && isBriefMultiToggleOption(effectiveProject, text)) {
      setBriefMultiDraft((prev) =>
        prev.includes(text) ? prev.filter((x) => x !== text) : [...prev, text],
      );
      return;
    }

    if (pendingBriefField && isBriefAiSuggestionChoice(effectiveProject, text)) {
      await saveBriefFromChat(text);
      return;
    }

    if (
      pendingBriefField &&
      (pendingBriefField.options?.includes(text) ||
        isTrustBadgeOption(text) ||
        text === NO_TRUST_BADGE_CHOICE)
    ) {
      if (pendingBriefField.multiSelect) {
        setBriefMultiDraft((prev) =>
          prev.includes(text) ? prev.filter((x) => x !== text) : [...prev, text],
        );
        return;
      }
      await saveBriefFromChat(text);
      return;
    }

    if (text === REVISE_CHOICE) {
      await updateProductDesignProject(projectId, { meta: { reviseMode: true } });
      await appendLocal(
        text,
        "请选择要修改的维度（点选即可）：\n- 核心目标人群\n- 痛点与优势\n- 视觉调性\n- 平台策略侧重",
      );
      await onProjectChange();
      return;
    }

    if (text === NEXT_STEP_CHOICE && project.meta?.reviseMode) {
      await updateProductDesignProject(projectId, { meta: { reviseMode: false } });
      await onProjectChange();
      await runLlm(NEXT_STEP_CHOICE);
      return;
    }

    if (text === NEXT_STEP_CHOICE) {
      let projectForStep: ProductDesignProject = effectiveProject;
      try {
        await syncProductDesign(projectId);
        await onProjectChange();
        const refreshed = await getProductDesignProject(projectId);
        if (refreshed) projectForStep = refreshed;
      } catch {
        /* 解析失败时仍按已有 design 推断下一步 */
      }
      const cmd = buildProductDesignNextStepCommand(projectForStep);
      if (cmd) {
        onFocusStep?.(cmd.focusStep);
        await runLlm(cmd.prompt);
        return;
      }
      const hint =
        nextStepChoiceHint(projectForStep) ??
        "请先完成下方点选或必要操作，再点「下一步」。";
      await appendLocal(text, hint, {});
      if (needsBriefCollection(projectForStep)) {
        onFocusStep?.("brief");
      } else if (
        projectForStep.design?.mainImages.every((m) => m.imageUrl) &&
        !projectForStep.meta?.detailWorkflowPath
      ) {
        onFocusStep?.("main-image");
      }
      return;
    }

    if (isReviseDimensionChoice(text)) {
      await updateProductDesignProject(projectId, { meta: { reviseMode: false } });
      await onProjectChange();
      await runLlm(REVISE_PROMPTS[text as (typeof REVISE_DIMENSION_CHOICES)[number]]);
      return;
    }

    const planNo = parseMarketingPlanChoice(text);
    if (planNo != null) {
      // 方案一经选定即锁定，不接受改选
      if (project.design?.selectedPlanNo != null) {
        await appendLocal(
          text,
          `方案 ${project.design.selectedPlanNo} 已锁定，不能更换。方案内容可在中间工作区编辑；点【下一步】继续。`,
          {},
        );
        return;
      }
      const plans = resolveMarketingPlansForDisplay(project);
      const plan = plans.find((p) => p.no === planNo);
      if (plan) {
        await appendLocal(
          marketingPlanChoiceLabel(planNo),
          `已选定【方案 ${planNo} · ${plan.name}】（锁定，不可更换）。\n结论已同步到中间工作区，方案内容仍可编辑。\n点击【下一步】继续 Step3。`,
          { designPatch: { selectedPlanNo: planNo } },
        );
        return;
      }
    }

    await runLlm(text);
  }

  function isReviseDimensionChoice(
    text: string,
  ): text is (typeof REVISE_DIMENSION_CHOICES)[number] {
    return (REVISE_DIMENSION_CHOICES as readonly string[]).includes(text);
  }

  const startStep1Ref = useRef(startStep1Token);
  const startDetailOutlineRef = useRef(startDetailOutlineToken);
  const regenerateMarketingRef = useRef(regenerateMarketingPlansToken);

  async function handleChoice(text: string) {
    if (choiceBusy) return;
    setChoiceBusy(true);
    try {
      await handleChoiceInner(text);
    } finally {
      setChoiceBusy(false);
    }
  }

  useEffect(() => {
    if (startStep1Token === startStep1Ref.current) return;
    startStep1Ref.current = startStep1Token;
    if (startStep1Token <= 0) return;
    const spec = specs.find((s) => s.code === project.platform);
    void runLlm(
      `参数已确认 | 平台：${spec?.label ?? project.platform}。请执行 Step1 平台合规与产品深度拆解。`,
    );
  }, [startStep1Token]);

  useEffect(() => {
    if (startDetailOutlineToken === startDetailOutlineRef.current) return;
    startDetailOutlineRef.current = startDetailOutlineToken;
    if (startDetailOutlineToken <= 0) return;
    const detailCount = project.resolved.detailPageCount;
    void runLlm(
      `主图已全部生成完毕。【下一步】请执行 Step7：${detailCount} 屏详情页销售逻辑框架（详情页架构规划）。只输出结构大纲，不写逐屏正文；须输出 detailOutline 共 ${detailCount} 条。`,
    );
  }, [startDetailOutlineToken]);

  useEffect(() => {
    if (regenerateMarketingPlansToken === regenerateMarketingRef.current) return;
    regenerateMarketingRef.current = regenerateMarketingPlansToken;
    if (regenerateMarketingPlansToken <= 0) return;
    void (async () => {
      await updateProductDesignProject(projectId, {
        designPatch: { marketingPlans: [], selectedPlanNo: undefined },
      });
      await onProjectChange();
      await runLlm(
        "三套营销方案都不合适。请结合当前 Step1 拆解与用户产品信息，重新生成 Step2 三套差异化营销方案（须输出 product-design JSON 或 Markdown 表格）。",
      );
    })();
  }, [regenerateMarketingPlansToken]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    void runLlm(text);
  }

  const displayMessages: ProductDesignChatMessage[] = streaming
    ? [
        ...messages,
        {
          id: "streaming",
          role: "assistant",
          content: streamText || "…",
          createdAt: new Date().toISOString(),
        },
      ]
    : messages;

  const showChoiceBlock =
    (choices.length > 0 || briefInferBusy) && !streaming && !choiceBusy;

  const assistantStepAnchorIndex = useMemo(() => {
    const last = new Map<ProductDesignStepId, number>();
    displayMessages.forEach((m, i) => {
      const step = inferAssistantMessageStep(m, i);
      if (step) last.set(step, i);
    });
    return last;
  }, [displayMessages]);

  const inputDisabled = streaming || choiceBusy || briefInferBusy;
  const showThinking = streaming || choiceBusy;

  const assistantSubtitle = useMemo(() => {
    const trackSteps = stepsForTrack(track);
    const states = resolveProductDesignStepStates(effectiveProject);
    const activeStep =
      trackSteps.find((id) => states[id] === "active") ?? trackSteps[trackSteps.length - 1]!;
    const stepIndex = Math.max(1, trackSteps.indexOf(activeStep) + 1);
    const stepLabel =
      PRODUCT_DESIGN_STEPS.find((s) => s.id === activeStep)?.label ?? activeStep;
    const modelName =
      chatModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? "助手模型";
    return `第 ${stepIndex}/${trackSteps.length} 步 · ${stepLabel} · ${modelName}`;
  }, [track, effectiveProject, chatModels, chatModelKey]);

  const assistantTitle = track === "detail" ? "电商详情页助手" : "电商主图助手";

  const tryCollapse = useCallback(() => {
    if (inputDisabled) return;
    onCollapsedChange?.(true);
  }, [inputDisabled, onCollapsedChange]);

  const tryExpand = useCallback(() => {
    onCollapsedChange?.(false);
  }, [onCollapsedChange]);

  const renderComposer = (compact: boolean) => (
    <div
      className={cn(
        ECOM_ASSISTANT_COMPOSER_SHELL_BASE,
        !compact && ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER,
      )}
    >
      <div className="flex items-end gap-2">
        <textarea
          className="min-h-[2.5rem] flex-1 resize-y rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
          rows={compact ? 1 : 3}
          placeholder={
            showChoiceBlock && choices.length > 0
              ? "也可输入补充说明；点选上方选项可继续下一步…"
              : "补充说明或让我修改某一步…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={inputDisabled}
          onFocus={() => {
            if (compact) tryExpand();
            else onComposerWideChange?.(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <EcomAssistantSendButton
          disabled={inputDisabled || !input.trim()}
          busy={streaming}
          onClick={handleSend}
        />
      </div>
    </div>
  );

  return (
    <EcomAssistantCollapsibleLayout
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      collapseBlocked={inputDisabled}
      attentionBadge={showChoiceBlock && choices.length > 0}
      composer={renderComposer(false)}
      floatingComposer={renderComposer(true)}
    >
      <EcomAssistantPanelHeader
        title={assistantTitle}
        subtitle={assistantSubtitle}
        composerWide={composerWide}
        onComposerWideChange={onComposerWideChange}
        onCollapse={onCollapsedChange ? tryCollapse : undefined}
        collapseDisabled={inputDisabled}
      />
      <div
        ref={scrollRef}
        className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        <div className="space-y-3">
          {displayMessages.map((m, index) => {
            const body =
              m.role === "assistant"
                ? toAssistantChatContent(m.content) || m.content
                : m.content;
            const stepAnchor = inferAssistantMessageStep(m, index);
            const anchorId =
              stepAnchor && assistantStepAnchorIndex.get(stepAnchor) === index
                ? productDesignAssistantAnchorId(stepAnchor)
                : undefined;
            return (
              <div
                key={m.id}
                id={anchorId}
                className={cn(
                  "flex w-full flex-col",
                  m.role === "user" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
                    m.role === "user"
                      ? ECOM_ASSISTANT_USER_BUBBLE_CLASS
                      : ECOM_ASSISTANT_BUBBLE_CLASS,
                  )}
                >
                  {m.role === "assistant" ? (
                    <StoryboardMarkdownBlock markdown={body} />
                  ) : (
                    <p className="whitespace-pre-wrap">{body}</p>
                  )}
                </div>
              </div>
            );
          })}
          {showChoiceBlock ? (
            <div className="flex flex-col items-start">
              <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
                {briefInferBusy ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#6e6e73]">
                      正在根据产品图推断{pendingBriefField?.label ?? "候选项"}…
                    </p>
                    <div
                      className="ecom-upload-progress ecom-upload-progress-indeterminate"
                      role="progressbar"
                      aria-valuetext="推断中"
                    >
                      <span />
                    </div>
                    <p className="text-[10px] text-[#86868b]">
                      视觉模型分析中，通常需 10～30 秒；完成后会展示可点选候选项。
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-[11px] text-[#6e6e73]">{prompt}</p>
                    <div className="flex flex-wrap gap-2">
                      {choices.map((c) =>
                        c === NEXT_STEP_CHOICE ||
                        c === CONFIRM_BRIEF_MULTI_CHOICE ||
                        c === CONFIRM_TRUST_BADGE_CHOICE ? (
                          <EcomButtonPrimary
                            key={c}
                            size="sm"
                            type="button"
                            disabled={streaming || choiceBusy}
                            className="!max-w-none shrink-0"
                            onClick={() => void handleChoice(c)}
                          >
                            {c}
                          </EcomButtonPrimary>
                        ) : (
                          <button
                            key={c}
                            type="button"
                            disabled={streaming || choiceBusy}
                            className={cn(
                              STORYBOARD_ASSISTANT_CHOICE_CLASS,
                              pendingBriefField?.multiSelect &&
                                briefMultiDraft.includes(c) &&
                                "border-[var(--ecom-chrome-accent)] bg-[var(--ecom-content-selected-bg)]",
                            )}
                            onClick={() => void handleChoice(c)}
                          >
                            {c}
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
        {showThinking ? (
          <StoryboardTaskStatus
            active
            title={choiceBusy ? "处理选择" : "思考中"}
            detail={
              choiceBusy
                ? "正在进入下一步…"
                : "助手正在输出本步内容，完成后自动同步到中间工作区…"
            }
            className="mt-3"
          />
        ) : null}
      </div>
    </EcomAssistantCollapsibleLayout>
  );
}
