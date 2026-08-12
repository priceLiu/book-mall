"use client";

import { Loader2, PanelRightClose, PanelRightOpen, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { STORYBOARD_ASSISTANT_CHOICE_CLASS } from "@/components/storyboard/storyboard-assistant-choices";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  streamProductDesignChat,
  suggestProductDesignBrief,
  syncProductDesign,
  updateProductDesignProject,
  getProductDesignProject,
} from "@/lib/ecom-product-design-api";
import type {
  EcomPlatformSpec,
  ProductDesignBrief,
  ProductDesignChatMessage,
  ProductDesignProject,
} from "@/lib/product-design-types";
import {
  ANALYZE_DETAIL_DECOMPOSE_CHOICE,
  bootstrapFastMainDesignPatch,
  buildProductDesignNextStepCommand,
  choicePrompt,
  CONFIRM_BRIEF_MULTI_CHOICE,
  CONFIRM_TRUST_BADGE_CHOICE,
  CUSTOM_INPUT_CHOICE,
  defaultMainImageRefPrompt,
  DETAIL_COUNT_CHOICE_PREFIX,
  DETAIL_DECOMPOSE_CHOICE,
  DETAIL_INTERACTIVE_CHOICE,
  formatBriefMultiValue,
  ENTER_DETAIL_PAGE_CHOICE,
  GENERATE_DETAIL_IMAGES_CHOICE,
  GENERATE_MAIN_IMAGES_CHOICE,
  hasDetailStyleRef,
  inferProductDesignChoices,
  INTERACTIVE_WORKFLOW_CHOICE,
  isBriefMultiToggleOption,
  isFastMainPath,
  isPrimaryBriefAction,
  isReviseDimensionChoice,
  isTrustBadgeOption,
  MAIN_COUNT_CHOICE_PREFIX,
  MAIN_REF_PROMPT_WORKFLOW_CHOICE,
  NO_TRUST_BADGE_CHOICE,
  nextBriefField,
  parseCountChoice,
  parseMarketingPlanChoice,
  parseMarketingPlansFromMarkdown,
  parsePlatformChoice,
  productDesignAssistantAnchorId,
  inferAssistantMessageStep,
  PRODUCT_DESIGN_STEPS,
  REVISE_CHOICE,
  REVISE_DIMENSION_CHOICES,
  NEXT_STEP_CHOICE,
  REGENERATE_MARKETING_PLANS_CHOICE,
  SKIP_STYLE_REF_CHOICE,
  type ProductDesignStepId,
} from "@/lib/product-design-workflow";
import { hasProductRef } from "@/lib/product-design-ref-rules";
import { toAssistantChatContent } from "@/lib/product-design-assistant-display";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

const WELCOME: ProductDesignChatMessage = {
  id: "welcome",
  role: "assistant",
  content: `你好，我是【电商商品视觉全链路设计 Agent】。

我会按 9 步产出一整套「主图 + 详情页」的定稿文案与配图。

**请先上传产品实拍主图（必传）** → 可选上传风格参考图 → 选择上架平台 → 点选产品信息，尽量无需打字。`,
  createdAt: new Date().toISOString(),
};

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
  enterDetailPageToken?: number;
  analyzeDetailDecomposeToken?: number;
  mainWorkflowChoice?: "interactive" | "reference-prompt" | null;
  mainWorkflowChoiceToken?: number;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  focusStepId?: ProductDesignStepId | null;
  onFocusStep?: (stepId: ProductDesignStepId) => void;
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
  enterDetailPageToken = 0,
  analyzeDetailDecomposeToken = 0,
  mainWorkflowChoice = null,
  mainWorkflowChoiceToken = 0,
  composerWide = false,
  onComposerWideChange,
  focusStepId = null,
  onFocusStep,
}: Props) {
  const projectId = project.id;
  const chatHistory = project.chatHistory;
  const [messages, setMessages] = useState<ProductDesignChatMessage[]>(
    chatHistory.length ? chatHistory : [WELCOME],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [suggestingBrief, setSuggestingBrief] = useState(false);
  const [briefMultiDraft, setBriefMultiDraft] = useState<string[]>([]);
  const [customInputField, setCustomInputField] = useState<string | null>(null);
  const [optimisticMeta, setOptimisticMeta] = useState<Record<string, unknown> | null>(null);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    setMessages(chatHistory.length ? chatHistory : [WELCOME]);
    setInput("");
    setBriefMultiDraft([]);
    setCustomInputField(null);
    setOptimisticMeta(null);
  }, [projectId]);

  useEffect(() => {
    if (!optimisticMeta) return;
    const merged = { ...(project.meta ?? {}), ...optimisticMeta };
    let matched = true;
    for (const [k, v] of Object.entries(optimisticMeta)) {
      if (project.meta?.[k] !== v) {
        matched = false;
        break;
      }
    }
    if (matched) setOptimisticMeta(null);
  }, [project.meta, optimisticMeta]);

  useEffect(() => {
    if (streaming) return;
    if (chatHistory.length) setMessages(chatHistory);
    else setMessages([WELCOME]);
  }, [chatHistory, streaming]);

  useEffect(() => {
    onStreamingChange?.(streaming);
  }, [streaming, onStreamingChange]);

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

  const effectiveProject = useMemo<ProductDesignProject>(
    () => ({
      ...project,
      meta: optimisticMeta ? { ...(project.meta ?? {}), ...optimisticMeta } : project.meta,
      chatHistory: messages.filter(
        (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
      ),
    }),
    [project, messages, optimisticMeta],
  );

  const choices =
    streaming || suggestingBrief || choiceBusy
      ? []
      : inferProductDesignChoices(effectiveProject, specs);
  const marketingChoices = choices.filter((c) => parseMarketingPlanChoice(c) != null);
  const navChoices = choices.filter((c) => parseMarketingPlanChoice(c) == null);
  const prompt = choicePrompt(effectiveProject, specs);
  const pendingField = nextBriefField(project.brief);
  const setupDone =
    hasProductRef(project.references) && Boolean(project.meta?.countsConfirmed);

  const briefCustomActive =
    pendingField != null &&
    customInputField === pendingField.key &&
    (pendingField.freeText || pendingField.aiInferrable);

  useEffect(() => {
    setBriefMultiDraft([]);
  }, [pendingField?.key]);

  useEffect(() => {
    if (!setupDone || !pendingField?.aiInferrable) return;
    if (project.meta?.briefSuggestionsLoaded) return;
    let cancelled = false;
    setSuggestingBrief(true);
    void suggestProductDesignBrief(projectId, { modelKey: visionModelKey })
      .then(async () => {
        if (!cancelled) await onProjectChange();
      })
      .catch(() => {
        /* 推断失败时仍可用自己输入 */
      })
      .finally(() => {
        if (!cancelled) setSuggestingBrief(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    setupDone,
    pendingField?.key,
    pendingField?.aiInferrable,
    project.meta?.briefSuggestionsLoaded,
    projectId,
    visionModelKey,
    onProjectChange,
  ]);

  const appendLocal = useCallback(
    async (
      userText: string,
      assistantText: string,
      patch?: Parameters<typeof updateProductDesignProject>[1],
    ) => {
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
      setMessages(next);
      if (patch?.meta) {
        setOptimisticMeta((prev) => ({ ...(prev ?? {}), ...patch.meta }));
      }
      await updateProductDesignProject(projectId, { ...patch, chatHistory: next });
      await onProjectChange();
      return next;
    },
    [messages, projectId, onProjectChange],
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
      setCustomInputField(null);
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

  const submitBriefValue = useCallback(
    async (value: string) => {
      const field = nextBriefField(project.brief);
      if (!field) return;
      let stored: string | string[] = value.trim();
      if (field.multiSelect) {
        const items = value
          .split(/\n+/)
          .map((s) => s.trim())
          .filter(Boolean);
        stored = items.length ? items : [value.trim()];
      }
      const label = formatBriefMultiValue(stored);
      const brief: ProductDesignBrief = { [field.key]: stored };
      const remaining = nextBriefField({ ...project.brief, ...brief });
      const reply = remaining
        ? `已记录${field.label}：${label}\n${remaining.prompt}`
        : `已记录${field.label}：${label}\n信息齐了，我这就开始 Step1 平台合规与产品深度拆解。`;
      setInput("");
      setCustomInputField(null);
      setBriefMultiDraft([]);
      const next = await appendLocal(label, reply, { brief });
      if (!remaining) {
        const spec = specs.find((s) => s.code === project.platform);
        await runLlm(
          `参数已确认 | 平台：${spec?.label ?? project.platform}。请执行 Step1 平台合规与产品深度拆解。`,
          next,
        );
      }
    },
    [project.brief, project.platform, specs, appendLocal, runLlm],
  );

  const submitBriefMulti = useCallback(
    async (selected: string[]) => {
      if (!selected.length) return;
      const field = nextBriefField(project.brief);
      if (!field?.multiSelect) return;

      let stored: string[] = selected;
      if (field.key === "hasTrustBadge") {
        stored = selected.includes(NO_TRUST_BADGE_CHOICE) || selected.includes("暂无背书")
          ? [NO_TRUST_BADGE_CHOICE]
          : selected;
      }

      const brief: ProductDesignBrief = { [field.key]: stored };
      const remaining = nextBriefField({ ...project.brief, ...brief });
      const label = formatBriefMultiValue(stored);
      const reply = remaining
        ? `已记录${field.label}：${label}\n${remaining.prompt}`
        : `已记录${field.label}：${label}\n信息齐了，我这就开始 Step1 平台合规与产品深度拆解。`;
      setBriefMultiDraft([]);
      const next = await appendLocal(`${field.label}：${label}`, reply, { brief });
      if (!remaining) {
        const spec = specs.find((s) => s.code === project.platform);
        await runLlm(
          `参数已确认 | 平台：${spec?.label ?? project.platform}。请执行 Step1 平台合规与产品深度拆解。`,
          next,
        );
      }
    },
    [project.brief, project.platform, specs, appendLocal, runLlm],
  );

  async function ensureMarketingPlansInProject(): Promise<ProductDesignProject> {
    if ((project.design?.marketingPlans.length ?? 0) > 0) return project;
    try {
      const synced = await syncProductDesign(projectId);
      if ((synced.design?.marketingPlans.length ?? 0) > 0) {
        await onProjectChange();
        return synced;
      }
    } catch {
      /* fallback parse */
    }
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.id !== "welcome");
    if (lastAssistant?.content) {
      const plans = parseMarketingPlansFromMarkdown(lastAssistant.content);
      if (plans.length) {
        await updateProductDesignProject(projectId, { designPatch: { marketingPlans: plans } });
        await onProjectChange();
        return {
          ...project,
          design: {
            marketingPlans: plans,
            buyingReasons: project.design?.buyingReasons ?? [],
            mainImages: project.design?.mainImages ?? [],
            detailOutline: project.design?.detailOutline ?? [],
            detailPages: project.design?.detailPages ?? [],
            analysis: project.design?.analysis,
            selectedPlanNo: project.design?.selectedPlanNo,
            visualBrief: project.design?.visualBrief,
          },
        };
      }
    }
    return project;
  }

  const enterDetailRef = useRef(enterDetailPageToken);
  const analyzeDetailRef = useRef(analyzeDetailDecomposeToken);
  const mainWorkflowChoiceRef = useRef(mainWorkflowChoiceToken);

  async function handleChoice(text: string) {
    if (choiceBusy) return;
    setChoiceBusy(true);
    try {
      await handleChoiceInner(text);
    } finally {
      setChoiceBusy(false);
    }
  }

  async function handleChoiceInner(text: string) {
    if (text === SKIP_STYLE_REF_CHOICE) {
      await appendLocal(text, "好的，请选择上架平台：", {
        meta: { setupPhase: "platform", styleRefSkipped: true, mainWorkflowPath: "interactive" },
      });
      return;
    }

    if (text === INTERACTIVE_WORKFLOW_CHOICE) {
      await appendLocal(text, "好的，请选择上架平台：", {
        meta: { mainWorkflowPath: "interactive", setupPhase: "platform" },
        settings: { mainImageGenMode: "copy" },
      });
      return;
    }

    if (text === MAIN_REF_PROMPT_WORKFLOW_CHOICE) {
      await appendLocal(text, "好的，请选择上架平台与主图张数：", {
        meta: { mainWorkflowPath: "reference-prompt", setupPhase: "platform" },
        settings: { mainImageGenMode: "reference-prompt" },
      });
      return;
    }

    if (text === DETAIL_INTERACTIVE_CHOICE) {
      await appendLocal(text, "将进入 Step7 详情页架构规划。", {
        meta: { detailWorkflowPath: "interactive" },
        settings: { detailPageGenMode: "copy" },
      });
      onFocusStep?.("detail-outline");
      const cmd = buildProductDesignNextStepCommand({
        ...project,
        meta: { ...project.meta, detailWorkflowPath: "interactive" },
      });
      if (cmd) await runLlm(cmd.prompt);
      return;
    }

    if (text === DETAIL_DECOMPOSE_CHOICE) {
      await appendLocal(
        text,
        "请在中间工作区上传详情页参考长图（detail-style），然后点「分析并拆解详情页」。",
        {
          meta: { detailWorkflowPath: "reference-decompose" },
          settings: { detailPageGenMode: "reference-decompose" },
        },
      );
      onFocusStep?.("detail-image");
      return;
    }

    if (text === ANALYZE_DETAIL_DECOMPOSE_CHOICE) {
      if (!hasDetailStyleRef(project.references)) {
        await appendLocal(text, "请先在中间工作区上传详情页参考长图（detail-style），再点「分析并拆解详情页」。", {});
        return;
      }
      await runLlm(
        `【详情页拆解模式】请阅读已上传的详情页风格参考图（detail-style），结合产品信息与已生成主图，拆解为 ${project.resolved.detailPageCount} 屏：先输出 detailOutline（每屏 mission / doubtResolved / titleDirection / tag），再输出 detailPages（每屏 title / body / purpose / layoutHint）。须包含 product-design JSON 补丁。`,
      );
      return;
    }

    if (text === ENTER_DETAIL_PAGE_CHOICE && !project.meta?.detailWorkflowPath) {
      await appendLocal(text, "请选择详情页制作方式：", {});
      return;
    }

    if (text === CUSTOM_INPUT_CHOICE && pendingField) {
      setCustomInputField(pendingField.key);
      return;
    }

    if (text === CONFIRM_TRUST_BADGE_CHOICE || text === CONFIRM_BRIEF_MULTI_CHOICE) {
      await submitBriefMulti(briefMultiDraft);
      return;
    }

    if (text === NO_TRUST_BADGE_CHOICE && pendingField?.key === "hasTrustBadge") {
      await submitBriefMulti([NO_TRUST_BADGE_CHOICE]);
      return;
    }

    if (isTrustBadgeOption(text) && pendingField?.key === "hasTrustBadge") {
      setBriefMultiDraft((prev) => {
        const withoutNone = prev.filter((x) => x !== NO_TRUST_BADGE_CHOICE && x !== "暂无背书");
        return withoutNone.includes(text)
          ? withoutNone.filter((x) => x !== text)
          : [...withoutNone, text];
      });
      return;
    }

    if (isBriefMultiToggleOption(effectiveProject, text) && pendingField?.multiSelect) {
      setBriefMultiDraft((prev) =>
        prev.includes(text) ? prev.filter((x) => x !== text) : [...prev, text],
      );
      return;
    }

    if (text === REGENERATE_MARKETING_PLANS_CHOICE) {
      await updateProductDesignProject(projectId, {
        designPatch: { marketingPlans: [], selectedPlanNo: undefined },
      });
      await onProjectChange();
      await runLlm(
        "三套营销方案都不合适。请结合当前 Step1 拆解与用户产品信息，重新生成 Step2 三套差异化营销方案（须输出 product-design JSON 或 Markdown 表格）。",
      );
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

    if (text === NEXT_STEP_CHOICE || text === ENTER_DETAIL_PAGE_CHOICE) {
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
    }

    if (isReviseDimensionChoice(text)) {
      await updateProductDesignProject(projectId, { meta: { reviseMode: false } });
      await onProjectChange();
      await runLlm(REVISE_PROMPTS[text as (typeof REVISE_DIMENSION_CHOICES)[number]]);
      return;
    }

    if (!hasProductRef(project.references)) return;

    if (text === GENERATE_MAIN_IMAGES_CHOICE) {
      onRequestGenerateMainImages?.();
      return;
    }
    if (text === GENERATE_DETAIL_IMAGES_CHOICE) {
      onRequestGenerateDetailImages?.();
      return;
    }

    const spec = parsePlatformChoice(text, specs);
    if (spec) {
      await appendLocal(
        text,
        `已选择【${spec.label}】。\n${spec.note}\n\n${spec.label} 主图建议 ${spec.mainImage.recommended} 张，请确认张数：`,
        {
          platform: spec.code,
          settings: {
            mainImageCount: spec.mainImage.recommended,
            detailPageCount: spec.detailPage.recommended,
            mainImageRatio: spec.mainImage.ratio,
            detailPageRatio: spec.detailPage.ratio,
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
      const current = specs.find((s) => s.code === project.platform);
      if (isFastMainPath(project)) {
        const detailCount = current?.detailPage.recommended ?? 8;
        const draftProject: ProductDesignProject = {
          ...project,
          settings: {
            ...project.settings,
            mainImageCount: mainCount,
            detailPageCount: detailCount,
            mainImageGenMode: "reference-prompt",
          },
          resolved: {
            ...project.resolved,
            mainImageCount: mainCount,
            detailPageCount: detailCount,
          },
        };
        const customPrompt = defaultMainImageRefPrompt(draftProject);
        await appendLocal(
          text,
          `主图 ${mainCount} 张。已跳过 Step1–4，请在中间工作区确认 Prompt 并出主图。`,
          {
            settings: {
              mainImageCount: mainCount,
              detailPageCount: detailCount,
              mainImageGenMode: "reference-prompt",
              mainImageCustomPrompt: customPrompt,
            },
            meta: {
              mainCountConfirmed: true,
              countsConfirmed: true,
              setupPhase: "done",
              briefSkipped: true,
            },
            designPatch: bootstrapFastMainDesignPatch(mainCount),
          },
        );
        onFocusStep?.("main-image");
        await onProjectChange();
        return;
      }
      await appendLocal(
        text,
        `主图定为 ${mainCount} 张。\n请确认详情页屏数（建议 ${current?.detailPage.recommended ?? 8} 屏）：`,
        { settings: { mainImageCount: mainCount }, meta: { mainCountConfirmed: true } },
      );
      return;
    }

    const detailCount = parseCountChoice(text, DETAIL_COUNT_CHOICE_PREFIX);
    if (detailCount != null) {
      const field = nextBriefField(project.brief);
      await appendLocal(
        text,
        `详情页定为 ${detailCount} 屏。\n${field?.prompt ?? "接下来开始产品拆解。"}`,
        {
          settings: { detailPageCount: detailCount },
          meta: { countsConfirmed: true },
        },
      );
      return;
    }

    const field = nextBriefField(project.brief);
    if (field?.options?.includes(text) && !field.multiSelect) {
      await submitBriefValue(text);
      return;
    }

    if (field?.aiInferrable && !field.multiSelect) {
      const suggestions =
        (project.meta?.briefSuggestions as Record<string, string[]> | undefined)?.[
          field.key
        ] ?? [];
      if (suggestions.includes(text)) {
        await submitBriefValue(text);
        return;
      }
    }

    const planNo = parseMarketingPlanChoice(text);
    if (planNo != null) {
      const hydrated = await ensureMarketingPlansInProject();
      const plan = hydrated.design?.marketingPlans.find((p) => p.no === planNo);
      if (plan) {
        await appendLocal(
          text,
          `已选定【方案 ${planNo} · ${plan.name}】。\n接下来我会按此方案产出购买理由；你也可在右侧直接改文案。\n点击【下一步】继续 Step3。`,
          { designPatch: { marketingPlans: hydrated.design!.marketingPlans, selectedPlanNo: planNo } },
        );
        return;
      }
    }

    await runLlm(text);
  }

  useEffect(() => {
    if (enterDetailPageToken === enterDetailRef.current) return;
    enterDetailRef.current = enterDetailPageToken;
    if (enterDetailPageToken > 0) {
      void handleChoice(ENTER_DETAIL_PAGE_CHOICE);
    }
  }, [enterDetailPageToken]);

  useEffect(() => {
    if (analyzeDetailDecomposeToken === analyzeDetailRef.current) return;
    analyzeDetailRef.current = analyzeDetailDecomposeToken;
    if (analyzeDetailDecomposeToken > 0) {
      void handleChoice(ANALYZE_DETAIL_DECOMPOSE_CHOICE);
    }
  }, [analyzeDetailDecomposeToken]);

  useEffect(() => {
    if (mainWorkflowChoiceToken === mainWorkflowChoiceRef.current) return;
    mainWorkflowChoiceRef.current = mainWorkflowChoiceToken;
    if (mainWorkflowChoiceToken <= 0 || !mainWorkflowChoice) return;
    void handleChoice(
      mainWorkflowChoice === "interactive"
        ? INTERACTIVE_WORKFLOW_CHOICE
        : MAIN_REF_PROMPT_WORKFLOW_CHOICE,
    );
  }, [mainWorkflowChoiceToken, mainWorkflowChoice]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    if (pendingField && setupDone && briefCustomActive) {
      void submitBriefValue(text);
      return;
    }
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

  const lastAssistantId = [...displayMessages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  const assistantStepAnchorIndex = useMemo(() => {
    const last = new Map<ProductDesignStepId, number>();
    displayMessages.forEach((m, i) => {
      const step = inferAssistantMessageStep(m, i);
      if (step) last.set(step, i);
    });
    return last;
  }, [displayMessages]);

  const inputDisabled =
    streaming ||
    suggestingBrief ||
    (!setupDone && !briefCustomActive) ||
    Boolean(
      pendingField &&
        !briefCustomActive &&
        (pendingField.options || pendingField.aiInferrable || pendingField.multiSelect),
    );

  const showThinking = streaming || suggestingBrief || choiceBusy;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ecom-assistant-surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bg)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#1d1d1f]">创作助手</p>
          <p className="text-[10px] text-[#6e6e73]">
            {chatModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? "助手模型"}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="ecom-scrollbar-overlay min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-scroll overscroll-y-contain px-4 py-4 [overflow-anchor:none]"
      >
        {displayMessages.map((m, index) => {
          const body =
            m.role === "assistant"
              ? m.id === "streaming"
                ? toAssistantChatContent(m.content) || m.content
                : toAssistantChatContent(m.content) || m.content
              : m.content;
          const isLastAssistant = m.role === "assistant" && m.id === lastAssistantId;
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
                "max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto border border-[var(--ecom-assistant-bubble-user-border)] bg-[var(--ecom-assistant-bubble-user-bg)] text-[#1d1d1f]"
                  : "bg-[var(--ecom-assistant-bubble-bot-bg)] text-[#1d1d1f] shadow-sm ring-1 ring-[var(--ecom-assistant-bubble-bot-ring)]",
              )}
            >
              {m.role === "assistant" ? (
                <StoryboardMarkdownBlock markdown={body} />
              ) : (
                <p className="whitespace-pre-wrap font-sans">{body}</p>
              )}
              {isLastAssistant && (marketingChoices.length > 0 || navChoices.length > 0) ? (
                <div className="mt-3 border-t border-[var(--ecom-assistant-border)] pt-3">
                  <p className="mb-2 text-[11px] text-[#6e6e73]">{prompt}</p>
                  {marketingChoices.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {marketingChoices.map((c) => (
                        <EcomButtonPrimary
                          key={c}
                          size="sm"
                          type="button"
                          disabled={streaming || suggestingBrief || choiceBusy}
                          className="!max-w-none shrink-0"
                          onClick={() => void handleChoice(c)}
                        >
                          {c}
                        </EcomButtonPrimary>
                      ))}
                    </div>
                  ) : null}
                  {navChoices.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {navChoices.map((c) => {
                      const isMultiToggle =
                        (pendingField?.multiSelect &&
                          (isTrustBadgeOption(c) || isBriefMultiToggleOption(effectiveProject, c))) ||
                        false;
                      const selected = isMultiToggle && briefMultiDraft.includes(c);
                      if (
                        isPrimaryBriefAction(c) ||
                        c === ENTER_DETAIL_PAGE_CHOICE ||
                        c === GENERATE_MAIN_IMAGES_CHOICE ||
                        c === GENERATE_DETAIL_IMAGES_CHOICE
                      ) {
                        return (
                          <EcomButtonPrimary
                            key={c}
                            size="sm"
                            type="button"
                            disabled={streaming || suggestingBrief || choiceBusy}
                            className="!max-w-none shrink-0"
                            onClick={() => void handleChoice(c)}
                          >
                            {c}
                          </EcomButtonPrimary>
                        );
                      }
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={streaming || suggestingBrief || choiceBusy}
                          className={cn(
                            STORYBOARD_ASSISTANT_CHOICE_CLASS,
                            selected &&
                              "border-[var(--ecom-chrome-accent)] bg-[var(--ecom-content-selected-bg)] text-[#1d1d1f]",
                          )}
                          onClick={() => void handleChoice(c)}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--ecom-assistant-border)] p-4">
        <StoryboardTaskStatus
          active={showThinking}
          title={choiceBusy ? "处理选择" : suggestingBrief ? "推断选项中" : "思考中"}
          detail={
            choiceBusy
              ? "正在保存你的选择并进入下一步…"
              : suggestingBrief
                ? "正在根据产品主图推断候选项…"
                : "助手正在输出本步内容，完成后自动同步到右侧工作区…"
          }
        />

        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-[#6e6e73] transition hover:bg-[var(--ecom-chrome-hover)] hover:text-[#1d1d1f]"
            title={composerWide ? "收窄助手栏" : "展宽助手栏"}
            onClick={() => onComposerWideChange?.(!composerWide)}
          >
            {composerWide ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
            {composerWide ? "收窄" : "展宽"}
          </button>
        </div>
        <textarea
          className="mb-3 min-h-[7.5rem] w-full resize-y rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
          rows={6}
          placeholder={
            suggestingBrief
              ? "正在根据主图推断选项，请稍候…"
              : !setupDone
                ? "请先完成上方上传与平台选择…"
                : briefCustomActive
                  ? (pendingField?.placeholder ?? "请输入…")
                  : pendingField
                    ? "请点选上方选项；需要自定义时再点「自己输入」"
                    : "补充说明或让我修改某一步…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={inputDisabled}
          onFocus={() => onComposerWideChange?.(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <EcomButtonPrimary
          size="sm"
          type="button"
          className="w-full"
          disabled={inputDisabled || !input.trim()}
          onClick={handleSend}
        >
          {streaming ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Send className="h-4 w-4 shrink-0" />
          )}
          发送
        </EcomButtonPrimary>
      </div>
    </div>
  );
}
