"use client";

import { Loader2, Send, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SeedVideoAssistantChoiceCards } from "@/components/seed-video/seed-video-assistant-choice-cards";
import type { StoryboardSettingsValue } from "@/components/storyboard/storyboard-settings-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomAssistantPanelHeader } from "@/components/layout/ecom-assistant-panel-header";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_CHOICE_SHELL_CLASS,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
  ECOM_ASSISTANT_USER_MESSAGE_BUBBLE_BASE,
} from "@/lib/ecom-assistant-chat-styles";
import {
  getStoryboardProject,
  streamStoryboardChat,
  syncStoryboardSheet,
  updateStoryboardProject,
} from "@/lib/ecom-storyboard-api";
import { FashionAssistantDeliverableView } from "@/components/fashion/fashion-assistant-deliverable-view";
import { FashionStoryboardResultBlock } from "@/components/fashion/fashion-deliverable-tables";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import {
  FASHION_DIMENSION_STEPS,
  buildFashionDimensionMessageLabels,
  buildFashionDimensionsFromChat,
  fashionDimensionPrompt,
  fashionDimensionStepProgress,
  mergeFashionDimensionSources,
} from "@/lib/fashion-dimensions";
import {
  extractFashionDeliverableFromText,
  isFashionInternalLlmTrigger,
  stripFashionDeliverableFence,
} from "@/lib/fashion-deliverable-parse";
import { extractMediaFilesFromClipboard } from "@/lib/image-upload-utils";
import type { FashionDeliverable } from "@/lib/fashion-types";
import { isFashionDeliverable } from "@/lib/fashion-types";
import {
  FASHION_AI_SELLPOINTS_CHOICE,
  FASHION_WELCOME,
  buildFashionProductRefAutoAdvance,
  applyFashionMetaAuthorityToDeliverable,
  buildFashionStoryboardPickChoices,
  buildFashionWorkflowChoiceMessageLabels,
  currentFashionDimensionStep,
  fashionAssistantPlaceholder,
  fashionBusyStatusForLlmTrigger,
  fashionBusyStatusForUserMessage,
  fashionLlmFailureAssistantMessage,
  fashionMetaAfterLlmFailure,
  fashionNeedsProductRefAutoAdvance,
  fashionReviseDimensionChoiceLabel,
  fashionWorkflowPatchForChoice,
  FASHION_REVISE_DIMENSION_PREFIX,
  inferFashionChoices,
  inferFashionPhaseFromState,
  isAwaitingFashionCustomDimensionInput,
  isAwaitingFashionOutputMode,
  isAwaitingFashionSellpoints,
  isAwaitingFashionStoryboardConfirm,
  isAwaitingFashionStoryboardPick,
  isAwaitingFashionVoiceoverPick,
  isFashionDimensionCollecting,
  isFashionDimensionRevisionAllowed,
  isFashionPendingStoryboardGeneration,
  isFashionStoryboardConfirmUserMessage,
  isLegacyStoryboardProject,
  parseFashionVersionKeyFromUserMessage,
  resolveFashionDeliverable,
} from "@/lib/fashion-workflow";
import type {
  StoryboardChatMessage,
  StoryboardGatewayModel,
  StoryboardProject,
} from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  project: StoryboardProject;
  chatModels: StoryboardGatewayModel[];
  settings: StoryboardSettingsValue;
  onOpenSettings?: () => void;
  onStreamingChange?: (streaming: boolean) => void;
  onDeliverableReady?: (updated?: StoryboardProject) => void | Promise<void>;
  onRequestGenerateAllImages?: () => void;
  onRequestGenerateFullVideo?: () => void;
  onRequestMergePanelVideos?: () => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
};

export function FashionAssistantPanel({
  project,
  chatModels,
  settings,
  onOpenSettings,
  onStreamingChange,
  onDeliverableReady,
  onRequestGenerateAllImages,
  onRequestGenerateFullVideo,
  onRequestMergePanelVideos,
  onAlert,
  composerWide = false,
  onComposerWideChange,
}: Props) {
  const projectId = project.id;
  const legacyReadonly = isLegacyStoryboardProject(project);
  const [messages, setMessages] = useState<StoryboardChatMessage[]>(
    project.chatHistory.length
      ? project.chatHistory
      : [{ id: "welcome", role: "assistant", content: FASHION_WELCOME, createdAt: new Date().toISOString() }],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [workflowOverride, setWorkflowOverride] = useState<Record<string, unknown>>({});
  const [deliverableOverride, setDeliverableOverride] = useState<FashionDeliverable | null>(null);
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState<{ title: string; detail: string } | null>(null);
  const [refAutoAdvancing, setRefAutoAdvancing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const productAutoAckRef = useRef<string | null>(null);
  const metaRepairRef = useRef<string | null>(null);
  const isBusy = streaming || pendingChoice != null || refAutoAdvancing;

  useEffect(() => {
    setWorkflowOverride({});
    setDeliverableOverride(null);
    setPendingChoice(null);
    setBusyStatus(null);
    productAutoAckRef.current = null;
  }, [projectId]);

  useEffect(() => {
    if (streaming || pendingChoice) return;
    if (deliverableOverride && isFashionDeliverable(project.meta?.deliverable)) {
      setDeliverableOverride(null);
    }
  }, [project.meta?.deliverable, streaming, pendingChoice, deliverableOverride]);

  useEffect(() => {
    if (legacyReadonly || streaming || pendingChoice) return;
    const productRef = project.references.find((r) => r.role === "product");
    if (!productRef) {
      productAutoAckRef.current = null;
      return;
    }
    if (!fashionNeedsProductRefAutoAdvance(project)) {
      productAutoAckRef.current = productRef.id;
      return;
    }
    const runKey = `${productRef.id}:${project.references.filter((r) => r.role === "product").length}`;
    if (productAutoAckRef.current === runKey) return;
    productAutoAckRef.current = runKey;

    const advance = buildFashionProductRefAutoAdvance(project);
    setRefAutoAdvancing(true);
    setBusyStatus({ title: "检测产品图", detail: "已识别产品图，正在进入七维参数采集…" });
    void (async () => {
      try {
        const updated = await updateStoryboardProject(projectId, {
          chatHistory: advance.chatHistory ?? project.chatHistory,
          meta: {
            ...project.meta,
            workflow: {
              ...(project.meta?.workflow ?? {}),
              ...advance.workflow,
            },
          },
        });
        if (advance.chatHistory) setMessages(advance.chatHistory);
        setWorkflowOverride(advance.workflow);
        await onDeliverableReady?.(updated);
      } catch {
        productAutoAckRef.current = null;
      } finally {
        setRefAutoAdvancing(false);
        setBusyStatus(null);
      }
    })();
  }, [
    legacyReadonly,
    streaming,
    pendingChoice,
    project.references,
    project.meta?.workflow?.fashionPhase,
    project.chatHistory,
    projectId,
    onDeliverableReady,
    project.meta,
  ]);

  useEffect(() => {
    if (!streaming && project.chatHistory.length) setMessages(project.chatHistory);
  }, [project.chatHistory, streaming]);

  useEffect(() => {
    if (legacyReadonly || isBusy) return;
    const history = messages.filter(
      (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
    );
    const hasMetaDeliverable = isFashionDeliverable(project.meta?.deliverable);
    const hasChatDeliverable = history.some(
      (m) => m.role === "assistant" && extractFashionDeliverableFromText(m.content),
    );
    if (!hasMetaDeliverable && !hasChatDeliverable) return;

    const resolved = resolveFashionDeliverable({ ...project, chatHistory: history });
    if (!resolved) return;
    const metaOk = hasMetaDeliverable;
    const inferredPhase = inferFashionPhaseFromState({
      ...project,
      chatHistory: history,
      meta: { ...project.meta, deliverable: resolved },
    });
    const wfPhase = (project.meta?.workflow as { fashionPhase?: string } | undefined)
      ?.fashionPhase;
    const phaseRank: Record<string, number> = {
      product_ref: 0,
      dimensions: 1,
      sellpoints: 2,
      voiceover_pick: 3,
      storyboard_pick: 4,
      storyboard_confirm: 5,
      ops_pack: 6,
      output_mode: 7,
      produce: 8,
      done: 9,
    };
    const canAdvancePhase =
      !wfPhase || (phaseRank[inferredPhase] ?? 0) > (phaseRank[wfPhase] ?? 0);
    const phaseDeliverableReady =
      inferredPhase !== "voiceover_pick" ||
      (resolved.voiceovers?.length ?? 0) > 0;
    const needsRepair =
      !metaOk ||
      (wfPhase === "voiceover_pick" && resolved.selectedVoiceoverId) ||
      (canAdvancePhase && phaseDeliverableReady && inferredPhase !== wfPhase) ||
      (inferredPhase === "storyboard_pick" &&
        isFashionDeliverable(project.meta?.deliverable) &&
        Boolean((project.meta!.deliverable as FashionDeliverable).selectedVersion) &&
        !resolved.opsPack &&
        !resolved.selectedVersion);
    if (!needsRepair) return;
    const repairKey = `${projectId}:${history.length}:${resolved.selectedVoiceoverId ?? ""}:${Object.keys(resolved.storyboardVersions ?? {}).length}:${resolved.selectedVersion ?? ""}:${inferredPhase}`;
    if (metaRepairRef.current === repairKey) return;
    metaRepairRef.current = repairKey;
    const nextPhase =
      canAdvancePhase || !wfPhase
        ? inferredPhase
        : (wfPhase as typeof inferredPhase);
    void (async () => {
      try {
        const metaDeliverable = isFashionDeliverable(project.meta?.deliverable)
          ? (project.meta!.deliverable as FashionDeliverable)
          : null;
        const authoritative = applyFashionMetaAuthorityToDeliverable(resolved, project);
        const updated = await updateStoryboardProject(projectId, {
          meta: {
            ...project.meta,
            deliverable: {
              ...authoritative,
              dimensions: mergeFashionDimensionSources(
                authoritative.dimensions,
                metaDeliverable?.dimensions,
                buildFashionDimensionsFromChat(history),
              ) as FashionDeliverable["dimensions"],
            },
            workflow: {
              ...(project.meta?.workflow ?? {}),
              vertical: "fashion_apparel",
              fashionPhase: nextPhase,
            },
          },
        });
        await onDeliverableReady?.(updated);
      } catch {
        metaRepairRef.current = null;
      }
    })();
  }, [
    legacyReadonly,
    isBusy,
    messages,
    project,
    projectId,
    onDeliverableReady,
  ]);

  useEffect(() => {
    onStreamingChange?.(isBusy);
  }, [isBusy, onStreamingChange]);

  const effectiveProject = useMemo<StoryboardProject>(() => {
    const resolvedDeliverable =
      deliverableOverride ??
      resolveFashionDeliverable({
        ...project,
        chatHistory: messages.filter(
          (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
        ),
      }) ??
      project.meta?.deliverable;
    return {
      ...project,
      chatHistory: messages.filter(
        (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
      ),
      meta: {
        ...project.meta,
        deliverable: resolvedDeliverable,
        workflow: {
          ...(project.meta?.workflow ?? {}),
          vertical: "fashion_apparel",
          ...workflowOverride,
        },
      },
    };
  }, [project, messages, workflowOverride, deliverableOverride]);

  const choices = useMemo(() => {
    if (legacyReadonly) return [];
    const primary = inferFashionChoices(effectiveProject);
    if (primary.length > 0) return primary;
    if (isAwaitingFashionStoryboardPick(effectiveProject)) {
      return buildFashionStoryboardPickChoices(effectiveProject);
    }
    return [];
  }, [effectiveProject, legacyReadonly]);

  const awaitingStoryboardPick = isAwaitingFashionStoryboardPick(effectiveProject);
  const awaitingStoryboardConfirm = isAwaitingFashionStoryboardConfirm(effectiveProject);
  const canReviseDimensions = isFashionDimensionRevisionAllowed(effectiveProject);

  const displayMessages = useMemo(
    () =>
      messages.filter(
        (m) =>
          !(m.role === "user" && isFashionInternalLlmTrigger(m.content)) &&
          !(
            m.role === "user" &&
            m.content.trim().startsWith(FASHION_REVISE_DIMENSION_PREFIX)
          ),
      ),
    [messages],
  );

  const dimensionMessageLabels = useMemo(
    () => buildFashionDimensionMessageLabels(displayMessages),
    [displayMessages],
  );

  const workflowChoiceLabels = useMemo(
    () => buildFashionWorkflowChoiceMessageLabels(displayMessages),
    [displayMessages],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [displayMessages.length, streamText, pendingChoice, streaming, busyStatus]);

  const persistMessages = useCallback(
    async (next: StoryboardChatMessage[]) => {
      setMessages(next);
      await updateStoryboardProject(projectId, { chatHistory: next });
    },
    [projectId],
  );

  const runStream = useCallback(
    async (
      history: StoryboardChatMessage[],
      userContent: string,
      hideUserBubble = false,
      skipStreamingToggle = false,
    ) => {
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}${hideUserBubble ? "-internal" : ""}`,
        role: "user",
        content: userContent,
        createdAt: new Date().toISOString(),
      };
      const base = [...history, userMsg];
      if (!hideUserBubble) setMessages(base);
      else setMessages(history);

      if (!skipStreamingToggle) {
        setStreaming(true);
        setStreamText("");
      }
      try {
        const acc = await streamStoryboardChat({
          projectId,
          modelKey: settings.chatModelKey,
          messages: base.filter((m) => m.id !== "welcome" && !m.id.startsWith("err-")),
          onChunk: (chunk) => {
            setStreamText(chunk);
          },
        });
        const assistantMsg: StoryboardChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: acc.trim(),
          createdAt: new Date().toISOString(),
        };
        const cleaned = hideUserBubble ? [...history, assistantMsg] : [...base, assistantMsg];
        await persistMessages(cleaned);
        await onDeliverableReady?.();
      } catch (e) {
        await onAlert({
          title: "助手请求失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
        throw e;
      } finally {
        setStreaming(false);
        setStreamText("");
      }
    },
    [projectId, settings.chatModelKey, persistMessages, onDeliverableReady, onAlert],
  );

  const handleChoice = useCallback(
    async (message: string) => {
      if (legacyReadonly || isBusy) return;

      setPendingChoice(message);
      setBusyStatus(fashionBusyStatusForUserMessage(message));

      const history = messages.filter((m) => m.id !== "welcome" && m.id !== "streaming");
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      const next = [...history, userMsg];
      setMessages(next);

      try {
        const preMeta = {
          deliverable: project.meta?.deliverable,
          workflow: { ...(project.meta?.workflow ?? {}) } as Record<string, unknown>,
        };
        const patchResult = fashionWorkflowPatchForChoice(effectiveProject, message);
        if (patchResult) {
          const { llmTrigger, syncSheet, ...metaPatch } = patchResult;

          if (metaPatch.workflow) {
            setWorkflowOverride((prev) => ({
              ...prev,
              ...(metaPatch.workflow as Record<string, unknown>),
            }));
          }
          if (metaPatch.deliverable) {
            setDeliverableOverride(metaPatch.deliverable as FashionDeliverable);
          }

          if (llmTrigger && typeof llmTrigger === "string") {
            setBusyStatus(fashionBusyStatusForLlmTrigger(llmTrigger));
            setStreaming(true);
            setStreamText("");
          }

          let patchedProject: StoryboardProject | undefined;

          if (metaPatch.deliverable || metaPatch.workflow) {
            const nextWorkflow = {
              ...(project.meta?.workflow ?? {}),
              vertical: "fashion_apparel" as const,
              ...(metaPatch.workflow as Record<string, unknown>),
            };
            patchedProject = await updateStoryboardProject(projectId, {
              chatHistory: next,
              meta: {
                ...project.meta,
                ...(metaPatch.deliverable
                  ? { deliverable: metaPatch.deliverable as NonNullable<StoryboardProject["meta"]>["deliverable"] }
                  : {}),
                workflow: nextWorkflow,
              },
            });
            if (metaPatch.workflow) {
              setWorkflowOverride((patchedProject.meta?.workflow ?? nextWorkflow) as Record<string, unknown>);
            }
            if (metaPatch.deliverable && isFashionDeliverable(patchedProject.meta?.deliverable)) {
              setDeliverableOverride(patchedProject.meta!.deliverable as FashionDeliverable);
            }
          } else {
            await persistMessages(next);
          }

          if (llmTrigger && typeof llmTrigger === "string") {
            try {
              await runStream(next, llmTrigger, true, true);
              await onDeliverableReady?.();
            } catch {
              const failureMsg: StoryboardChatMessage = {
                id: `err-${Date.now()}`,
                role: "assistant",
                content: fashionLlmFailureAssistantMessage(llmTrigger),
                createdAt: new Date().toISOString(),
              };
              const failedHistory = [...next, failureMsg];
              setMessages(failedHistory);
              setWorkflowOverride({});
              setDeliverableOverride(null);
              const rollback = fashionMetaAfterLlmFailure(llmTrigger, preMeta, metaPatch);
              const rolled = await updateStoryboardProject(projectId, {
                chatHistory: failedHistory,
                meta: {
                  ...project.meta,
                  ...(rollback.deliverable != null ? { deliverable: rollback.deliverable } : {}),
                  workflow: rollback.workflow,
                },
              });
              await onDeliverableReady?.(rolled);
            }
            return;
          }

          if (syncSheet) {
            setBusyStatus({
              title: "正在同步分镜表",
              detail: "正在将定稿分镜写入左侧工作台…",
            });
            try {
              const refreshed = await syncStoryboardSheet(projectId);
              await onDeliverableReady?.(refreshed);
              if (
                resolveFashionDeliverable(refreshed)?.outputMode === "direct_video" &&
                refreshed.sheet
              ) {
                onRequestGenerateAllImages?.();
              }
            } catch (e) {
              const detail = e instanceof Error ? e.message : "分镜表同步失败";
              if (patchedProject) {
                const prevDeliverable = isFashionDeliverable(patchedProject.meta?.deliverable)
                  ? (patchedProject.meta!.deliverable as FashionDeliverable)
                  : null;
                const rolled = await updateStoryboardProject(projectId, {
                  meta: {
                    ...patchedProject.meta,
                    deliverable: prevDeliverable
                      ? { ...prevDeliverable, outputMode: null }
                      : patchedProject.meta?.deliverable,
                    workflow: {
                      ...(patchedProject.meta?.workflow ?? {}),
                      fashionPhase: "output_mode",
                    },
                  },
                });
                setDeliverableOverride(null);
                setWorkflowOverride(
                  (rolled.meta?.workflow ?? {}) as Record<string, unknown>,
                );
                await onDeliverableReady?.(rolled);
              }
              await onAlert({
                title: "故事版同步失败",
                message: `${detail}。已回到「选择成片方式」，请重试；若仍失败，请重新确认分镜后再选故事版。`,
                variant: "error",
              });
            }
            return;
          }
          await onDeliverableReady?.(patchedProject);
          return;
        }

        setStreaming(true);
        setStreamText("");
        setBusyStatus({ title: "思考中", detail: "助手正在理解您的补充说明…" });
        await runStream(next, message, false, true);
      } finally {
        setPendingChoice(null);
        setBusyStatus(null);
      }
    },
    [
      legacyReadonly,
      isBusy,
      messages,
      effectiveProject,
      project.meta,
      projectId,
      workflowOverride,
      persistMessages,
      runStream,
      onDeliverableReady,
      onRequestGenerateAllImages,
      onAlert,
    ],
  );

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isBusy || legacyReadonly) return;
    setInput("");
    await handleChoice(trimmed);
  }, [input, isBusy, legacyReadonly, handleChoice]);

  const deliverable = resolveFashionDeliverable(effectiveProject);
  const inProduce =
    effectiveProject.meta?.workflow?.fashionPhase === "produce" && deliverable?.outputMode;
  const awaitingCustomDimension = isAwaitingFashionCustomDimensionInput(effectiveProject);
  const isDimensionCollecting = isFashionDimensionCollecting(effectiveProject);
  const currentDimStep = currentFashionDimensionStep(effectiveProject);
  const currentDimStepDef = FASHION_DIMENSION_STEPS[currentDimStep];
  const dimStepProgress = fashionDimensionStepProgress(currentDimStep);
  const showDimensionStepPrompt =
    !legacyReadonly && isDimensionCollecting && !isBusy && Boolean(currentDimStepDef);
  const customDimensionHint = useMemo(() => {
    if (!awaitingCustomDimension) return "";
    const step = FASHION_DIMENSION_STEPS[currentDimStep];
    return step ? `请在下方输入${step.label}（2 字以上）` : "请在下方输入自定义内容";
  }, [awaitingCustomDimension, currentDimStep]);
  const showSellpointGeneratePrompt =
    !legacyReadonly &&
    isAwaitingFashionSellpoints(effectiveProject) &&
    !deliverable?.sellpoints?.length &&
    !isBusy;
  const awaitingOutputMode = isAwaitingFashionOutputMode(effectiveProject);
  const awaitingVoiceoverPick = isAwaitingFashionVoiceoverPick(effectiveProject);
  const pendingStoryboardGen = isFashionPendingStoryboardGeneration(effectiveProject);
  const sellpointChoiceSubtitle = awaitingStoryboardPick
    ? "已生成分镜方案，请点选 A–E 版继续；不足 5 套可选「重新生成分镜」"
    : awaitingStoryboardConfirm
      ? "左侧 12.1 分镜表可编辑并保存，确认后生成运营包"
    : awaitingOutputMode
      ? "运营素材已就绪，请选择成片交付方式（路径 A / 路径 B）"
    : pendingStoryboardGen
      ? "口播已选定，请生成 A–E 分镜脚本后继续"
    : awaitingVoiceoverPick
      ? "请点选一套口播文案，系统将自动生成 A–E 分镜方案"
    : deliverable?.sellpoints?.length && !deliverable.sellpointsLocked
      ? "确认定稿，或重新生成卖点"
    : isDimensionCollecting && currentDimStepDef
      ? awaitingCustomDimension
        ? customDimensionHint
        : `${dimStepProgress} · 七维参数采集 · ${
            currentDimStepDef.freeText
              ? "在下方输入框填写后发送"
              : "点选上方选项，或选「自定义」后在下方输入"
          }`
    : awaitingCustomDimension
      ? customDimensionHint
      : "点选上方选项，或选「自定义」后在下方输入";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfbfd]">
      <EcomAssistantPanelHeader
        title="服装专业版助手"
        subtitle="V4.4 · 七维 → 卖点 → 口播 → 分镜"
        composerWide={composerWide}
        onComposerWideChange={onComposerWideChange}
        trailing={
          onOpenSettings ? (
            <EcomButtonSecondary type="button" className="px-2" onClick={onOpenSettings}>
              <Settings2 className="h-4 w-4" />
            </EcomButtonSecondary>
          ) : undefined
        }
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {legacyReadonly ? (
          <div className={cn(ECOM_ASSISTANT_BUBBLE_CLASS, "mb-3")}>
            此为旧版微剧故事版项目，仅支持只读浏览。请新建「服装专业版」项目继续创作。
          </div>
        ) : null}

        {displayMessages.map((m, index) => {
          const brief = m.role === "assistant" ? stripFashionDeliverableFence(m.content) : m.content;
          const parsedFromMessage = extractFashionDeliverableFromText(m.content);
          const isLastAssistant =
            m.role === "assistant" && index === displayMessages.findLastIndex((x) => x.role === "assistant");
          const dimMeta = m.role === "user" ? dimensionMessageLabels.get(m.id) : undefined;
          const choiceMeta = m.role === "user" ? workflowChoiceLabels.get(m.id) : undefined;
          const userStoryboardKey =
            m.role === "user" && deliverable
              ? isFashionStoryboardConfirmUserMessage(m.content)
                ? deliverable.selectedVersion
                : parseFashionVersionKeyFromUserMessage(m.content)
              : null;
          const userStoryboardVersion =
            userStoryboardKey && deliverable
              ? deliverable.storyboardVersions?.[userStoryboardKey]
              : undefined;
          const messageDeliverable = deliverable;
          const showDeliverableView =
            m.role === "assistant" &&
            (Boolean(parsedFromMessage?.sellpoints?.length) ||
              Boolean(
                parsedFromMessage?.storyboardVersions &&
                  Object.keys(parsedFromMessage.storyboardVersions).length,
              ) ||
              Boolean(stripFashionDeliverableFence(m.content).trim()) ||
              (isLastAssistant &&
                Boolean(
                  deliverable?.sellpoints?.length ||
                    deliverable?.storyboardVersions ||
                    deliverable?.voiceovers?.length,
                )));
          return (
            <div
              key={m.id}
              className={cn(
                "mb-3 flex w-full flex-col",
                m.role === "user" ? "items-end" : "items-start",
              )}
            >
              {choiceMeta ? (
                <div className="mb-1 max-w-[95%] text-right">
                  <p className="text-[11px] font-semibold text-[#1d1d1f]">{choiceMeta.label}</p>
                  <p className="text-[10px] text-[#86868b]">{choiceMeta.detail}</p>
                </div>
              ) : dimMeta ? (
                <div className="mb-1 max-w-[95%] text-right">
                  {canReviseDimensions ? (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-[#0071e3] underline decoration-[#0071e3]/45 underline-offset-2 hover:decoration-[#0071e3] disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() =>
                        void handleChoice(fashionReviseDimensionChoiceLabel(dimMeta.stepIndex))
                      }
                    >
                      {dimMeta.label}
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-[#0071e3]">{dimMeta.label}</span>
                  )}
                </div>
              ) : null}
              <div
                className={cn(
                  m.role === "user"
                    ? ECOM_ASSISTANT_USER_MESSAGE_BUBBLE_BASE
                    : ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
                  m.role === "user" ? ECOM_ASSISTANT_USER_BUBBLE_CLASS : ECOM_ASSISTANT_BUBBLE_CLASS,
                )}
              >
                {m.role === "assistant" ? (
                  showDeliverableView ? (
                    <FashionAssistantDeliverableView
                      content={m.content}
                      projectDeliverable={messageDeliverable}
                      showStoryboardPickHint={awaitingStoryboardPick && isLastAssistant}
                      showStoryboardConfirmHint={awaitingStoryboardConfirm && isLastAssistant}
                      showBrief={isLastAssistant}
                    />
                  ) : brief ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{brief}</p>
                  ) : m.id === "streaming" ? (
                    <p className="text-sm text-[#86868b]">正在生成…</p>
                  ) : null
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
              {userStoryboardKey && userStoryboardVersion?.panels?.length ? (
                <div
                  className={cn(
                    "mt-2 max-w-[95%]",
                    m.role === "user" ? "ml-auto" : "mr-auto",
                  )}
                >
                  <FashionStoryboardResultBlock
                    versionKey={userStoryboardKey}
                    title={userStoryboardVersion.title}
                    panels={userStoryboardVersion.panels}
                    sellpoints={deliverable?.sellpoints}
                    locked={
                      isFashionStoryboardConfirmUserMessage(m.content) ||
                      Boolean(deliverable?.storyboardLocked)
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}

        {streaming && streamText ? (
          <div
            className={cn(
              ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
              ECOM_ASSISTANT_BUBBLE_CLASS,
              "mb-3 mr-auto max-w-[95%]",
            )}
          >
            {extractFashionDeliverableFromText(streamText) ? (
              <FashionAssistantDeliverableView
                content={streamText}
                projectDeliverable={deliverable}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1d1d1f]">
                {stripFashionDeliverableFence(streamText) || "正在生成…"}
              </p>
            )}
          </div>
        ) : null}

        {isBusy && busyStatus ? (
          <StoryboardTaskStatus
            active
            title={streaming && streamText ? "生成中" : busyStatus.title}
            detail={
              streaming
                ? streamText
                  ? "内容流式输出中，完成后自动进入下一步…"
                  : `${busyStatus.detail}（正在连接 AI…）`
                : busyStatus.detail
            }
            className="mx-0 mb-3"
          />
        ) : null}

        {showDimensionStepPrompt ? (
          <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
            <div className="rounded-2xl border border-[#0071e3]/25 bg-[#f0f6ff] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1d1d1f]">
                    {currentDimStepDef!.label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#6e6e73]">
                    {fashionDimensionPrompt(currentDimStep)}
                  </p>
                  {currentDimStepDef!.freeText ? (
                    <p className="mt-2 text-xs text-[#86868b]">
                      此步骤无选项卡片，请直接在下方输入框填写场景描述后发送。
                    </p>
                  ) : awaitingCustomDimension ? (
                    <p className="mt-2 text-xs text-[#86868b]">{customDimensionHint}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium text-[#0071e3]">
                  {dimStepProgress}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {showSellpointGeneratePrompt ? (
          <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
            <div className="rounded-2xl border border-[#e8e8ed] bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#1d1d1f]">七维参数已确认</p>
              <p className="mt-1 text-xs text-[#6e6e73]">
                点击下方按钮由 AI 生成 5–8 条分层卖点；也可在输入框自行描述后发送。
              </p>
              <EcomButtonPrimary
                type="button"
                className="mt-4 w-full"
                disabled={isBusy}
                onClick={() => void handleChoice(FASHION_AI_SELLPOINTS_CHOICE)}
              >
                {pendingChoice === FASHION_AI_SELLPOINTS_CHOICE ? (
                  <>
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                    正在生成…
                  </>
                ) : (
                  "AI 自动生成卖点"
                )}
              </EcomButtonPrimary>
            </div>
          </div>
        ) : null}

        {!legacyReadonly && choices.length > 0 && !isBusy ? (
          <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
            <SeedVideoAssistantChoiceCards
              title={
                awaitingStoryboardPick
                  ? "选择分镜方案"
                  : awaitingStoryboardConfirm
                    ? "确认定稿分镜"
                  : awaitingOutputMode
                    ? "选择成片方式"
                    : pendingStoryboardGen
                      ? "生成分镜方案"
                    : awaitingVoiceoverPick
                      ? "选择口播文案"
                    : isDimensionCollecting && currentDimStepDef
                      ? currentDimStepDef.freeText
                        ? `填写${currentDimStepDef.label}`
                        : `请选择${currentDimStepDef.label}`
                      : "请选择"
              }
              subtitle={sellpointChoiceSubtitle}
              choices={choices.map((c) => ({
                id: c.id,
                label: c.title,
                title: c.title,
                message: c.message,
                description: c.description,
                recommended: c.recommended,
              }))}
              disabled={isBusy}
              selectedMessage={pendingChoice}
              onSelect={(message) => void handleChoice(message)}
            />
          </div>
        ) : null}

        {!legacyReadonly && pendingChoice && isBusy && choices.length === 0 ? (
          <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
            <SeedVideoAssistantChoiceCards
              title="处理中"
              subtitle="请稍候，完成后将自动展示下一步选项"
              choices={[
                {
                  id: "pending",
                  label: pendingChoice,
                  title: pendingChoice,
                  message: pendingChoice,
                },
              ]}
              disabled
              selectedMessage={pendingChoice}
            />
          </div>
        ) : null}

        {inProduce && !isBusy ? (
          <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
            <p className="text-sm text-[#1d1d1f]">
              {deliverable?.outputMode === "direct_video"
                ? "故事版已定稿。请在中栏「故事版 · 成片工作区」逐镜或一键生成分镜图，完成后可生成整图视频或分镜合成。"
                : "分镜已定稿，可生成分镜图与导出交付。"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <EcomButtonPrimary type="button" onClick={() => onRequestGenerateAllImages?.()}>
                生成分镜图
              </EcomButtonPrimary>
              {deliverable?.outputMode === "direct_video" ? (
                <>
                  <EcomButtonSecondary type="button" onClick={() => onRequestGenerateFullVideo?.()}>
                    整图视频
                  </EcomButtonSecondary>
                  <EcomButtonSecondary type="button" onClick={() => onRequestMergePanelVideos?.()}>
                    分镜合成
                  </EcomButtonSecondary>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[#e8e8ed] bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={fashionAssistantPlaceholder(effectiveProject)}
            disabled={legacyReadonly || isBusy}
            rows={2}
            className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-[#d2d2d7] px-3 py-2 text-sm outline-none focus:border-[#0071e3] disabled:bg-[#f5f5f7]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            onPaste={(e) => {
              if (extractMediaFilesFromClipboard(e).length > 0) {
                e.preventDefault();
              }
            }}
          />
          {onOpenSettings ? (
            <EcomButtonSecondary type="button" className="shrink-0 px-2" onClick={onOpenSettings}>
              <Settings2 className="h-4 w-4" />
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonPrimary
            type="button"
            className="shrink-0"
            disabled={legacyReadonly || isBusy || !input.trim()}
            onClick={() => void handleSend()}
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </EcomButtonPrimary>
        </div>
      </div>
    </div>
  );
}
