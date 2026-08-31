"use client";

import { Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StoryboardAssistantDeliverableView } from "@/components/storyboard/storyboard-assistant-deliverable-view";
import { StoryboardAssistantChoices } from "@/components/storyboard/storyboard-assistant-choices";
import { SeedVideoAssistantChoiceCards } from "@/components/seed-video/seed-video-assistant-choice-cards";
import {
  advanceParamStep,
  completeAutoMatchCategory,
  completeQuickGenerate,
  completeSellpointInput,
  buildStoryboardLlmUserMessage,
  CUSTOM_PARAMS_CHOICE,
  getStepPrompt,
  isAutoMatchCategoryChoice,
  isAwaitingCategory,
  isAwaitingSellpointInput,
  isCategoryChoiceLabel,
  isParamCollectChoice,
  isParamCollecting,
  isStoryboardPlanLlmTrigger,
  QUICK_GENERATE_CHOICE,
  REGENERATE_PLAN_CHOICE,
  selectProductCategory,
  startCustomParamCollectPatch,
} from "@/lib/storyboard-param-collect";
import {
  CUSTOM_SCENE_INPUT_CHOICE,
  isSceneAdjustLlmTrigger,
  SCENE_APPLY_AI_CHOICE,
  SCENE_APPLY_CUSTOM_CHOICE,
} from "@/lib/storyboard-scene-presets";
import {
  buildSchemePickChoiceCards,
  completeCustomSceneInput,
  completeSceneApplyAi,
  completeSceneApplyCustom,
  completeScenePresetChoice,
  hasStoryboardProductRef,
  inferAssistantChoices,
  isAwaitingCustomSceneInput,
  isAwaitingInitialProductRef,
  isAwaitingPlanMode,
  isAwaitingPlanDeliverable,
  isAwaitingProductNameInput,
  isAwaitingSceneApplyMode,
  isAwaitingSchemePick,
  isGenerateAllImagesChoice,
  isGenerateFullVideoChoice,
  isInPostPlanRefWorkflow,
  isMergePanelVideosChoice,
  parseSchemePickChoice,
  planModeChosen,
  resolveAssistantComposerPlaceholder,
  resolveSelectedSchemeIndex,
  resolveStoryboardDeliverable,
  resolveSceneApplyLlmMessage,
  sceneRefStepDone,
  schemePickChoiceLabel,
  schemePickPromptBlock,
  shouldCaptureSceneDescription,
  startCustomSceneInput,
  needsStaleSchemePickReset,
  workflowPatchForChoice,
} from "@/lib/storyboard-workflow";
import type { StoryboardSettingsValue } from "@/components/storyboard/storyboard-settings-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  streamStoryboardChat,
  syncStoryboardSheet,
  updateStoryboardProject,
  getStoryboardProject,
} from "@/lib/ecom-storyboard-api";
import { stripStoryboardDeliverableFence } from "@/lib/storyboard-display";
import { extractStoryboardDeliverableFromText, asStoryboardDeliverable } from "@/lib/storyboard-deliverable-parse";
import type {
  StoryboardChatMessage,
  StoryboardGatewayModel,
  StoryboardProject,
} from "@/lib/storyboard-types";
import { EcomAssistantPanelHeader } from "@/components/layout/ecom-assistant-panel-header";
import { EcomAssistantFloatingComposer } from "@/components/layout/ecom-assistant-floating-composer";
import {
  EcomAssistantIconButton,
  ECOM_ASSISTANT_CONTROL_ICON_CLASS,
} from "@/components/layout/ecom-assistant-icon-button";
import { EcomAssistantSendButton } from "@/components/layout/ecom-assistant-send-button";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_CHOICE_SHELL_CLASS,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
} from "@/lib/ecom-assistant-chat-styles";
import { cn } from "@/lib/utils";

const WELCOME: StoryboardChatMessage = {
  id: "welcome",
  role: "assistant",
  content: `你好，我是【电商全品类带货短视频分镜策划师】。

请先在参考图区上传产品图（必填），完成后点击「已上传产品图」，再输入产品名并选择品类与生成方式。`,
  createdAt: new Date().toISOString(),
};

function hasStoryboardDeliverable(project: StoryboardProject): boolean {
  const d = asStoryboardDeliverable(project.meta?.deliverable);
  return Boolean(d?.analysis || d?.schemes?.length);
}

type Props = {
  project: StoryboardProject;
  chatModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
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
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  durationSec?: number;
  /** 旧版 v2 项目只读，禁用助手交互 */
  legacyReadonly?: boolean;
};

export function StoryboardAssistantPanel({
  project,
  chatModels,
  imageModels,
  videoModels,
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
  collapsed = false,
  onCollapsedChange,
  durationSec = 15,
  legacyReadonly = false,
}: Props) {
  const chatHistory = project.chatHistory;
  const projectId = project.id;
  const [messages, setMessages] = useState<StoryboardChatMessage[]>(
    chatHistory.length ? chatHistory : [WELCOME],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [pendingSchemePick, setPendingSchemePick] = useState<string | null>(null);
  const [workflowOverride, setWorkflowOverride] = useState<Record<string, unknown>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const assistantRootRef = useRef<HTMLDivElement>(null);

  const tryCollapse = useCallback(() => {
    if (streaming) return;
    onCollapsedChange?.(true);
  }, [streaming, onCollapsedChange]);

  const tryExpand = useCallback(() => {
    onCollapsedChange?.(false);
  }, [onCollapsedChange]);

  const handleAssistantBlur = useCallback(
    (e: React.FocusEvent) => {
      if (collapsed || streaming) return;
      const root = assistantRootRef.current;
      if (!root) return;
      const next = e.relatedTarget as Node | null;
      if (next && root.contains(next)) return;
      if (next && (next as HTMLElement).closest?.("[data-ecom-floating-composer]")) return;
      onCollapsedChange?.(true);
    },
    [collapsed, streaming, onCollapsedChange],
  );

  useEffect(() => {
    setWorkflowOverride({});
    setPendingSchemePick(null);
    setStreamText("");
    setInput("");
  }, [projectId]);

  useEffect(() => {
    if (streaming) return;
    setMessages(chatHistory.length ? chatHistory : [WELCOME]);
  }, [projectId, chatHistory, streaming]);

  useEffect(() => {
    onStreamingChange?.(streaming);
  }, [streaming, onStreamingChange]);

  const staleSchemeResetRef = useRef(false);

  useEffect(() => {
    staleSchemeResetRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (streaming || staleSchemeResetRef.current) return;
    const projectForReset: StoryboardProject = {
      ...project,
      chatHistory: messages.filter(
        (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
      ),
    };
    if (!needsStaleSchemePickReset(projectForReset)) return;
    staleSchemeResetRef.current = true;
    void updateStoryboardProject(projectId, {
      meta: {
        ...project.meta,
        workflow: {
          ...project.meta?.workflow,
          schemePicked: false,
          phase: "planning",
        },
      },
    }).then(() => onDeliverableReady?.());
  }, [project, projectId, messages, streaming, onDeliverableReady]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = dist < 96;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /** 胶囊推断须用本地 messages + workflow，避免父级 project 刷新滞后 */
  const effectiveProject = useMemo<StoryboardProject>(
    () => ({
      ...project,
      chatHistory: messages.filter(
        (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
      ),
      meta: {
        ...project.meta,
        workflow: {
          ...(project.meta?.workflow ?? {}),
          ...workflowOverride,
        },
      },
    }),
    [project, messages, workflowOverride],
  );

  const applyWorkflowPatch = useCallback((patch: Record<string, unknown>) => {
    setWorkflowOverride((prev) => ({ ...prev, ...patch }));
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    scrollToBottom(streaming ? "auto" : "smooth");
  }, [messages, streamText, streaming, scrollToBottom]);

  const persistLocalMessages = useCallback(
    async (next: StoryboardChatMessage[]) => {
      setMessages(next);
      await updateStoryboardProject(projectId, { chatHistory: next });
    },
    [projectId],
  );

  const stripInternalLlmTriggerMessages = useCallback(
    async (history: StoryboardChatMessage[]) => {
      const cleaned = history.filter(
        (m) =>
          !(
            m.role === "user" &&
            (isSceneAdjustLlmTrigger(m.content) || isStoryboardPlanLlmTrigger(m.content))
          ),
      );
      if (cleaned.length !== history.length) {
        await updateStoryboardProject(projectId, { chatHistory: cleaned });
      }
      return cleaned;
    },
    [projectId],
  );

  const runInternalLlmStream = useCallback(
    async (historyBase: StoryboardChatMessage[], internalUserMessage: string) => {
      const llmUserMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}-internal-llm`,
        role: "user",
        content: internalUserMessage,
        createdAt: new Date().toISOString(),
      };
      const historyForLlm = [...historyBase, llmUserMsg];
      setStreaming(true);
      setStreamText("");
      try {
        const full = await streamStoryboardChat({
          projectId,
          messages: historyForLlm,
          modelKey: settings.chatModelKey,
          onChunk: setStreamText,
        });
        setStreamText("");
        if (onDeliverableReady) await onDeliverableReady();
        const refreshed = await getStoryboardProject(projectId);
        const cleaned = await stripInternalLlmTriggerMessages(
          refreshed.chatHistory.length ? refreshed.chatHistory : historyBase,
        );
        setMessages(cleaned);
        void full;
      } catch (e) {
        const err = e instanceof Error ? e.message : "发送失败";
        const withErr = [
          ...historyBase,
          {
            id: `err-${Date.now()}`,
            role: "assistant" as const,
            content: `请求失败：${err}`,
            createdAt: new Date().toISOString(),
          },
        ];
        setMessages(withErr);
        await updateStoryboardProject(projectId, { chatHistory: withErr });
        setStreamText("");
      } finally {
        setStreaming(false);
      }
    },
    [
      onDeliverableReady,
      projectId,
      settings.chatModelKey,
      stripInternalLlmTriggerMessages,
    ],
  );

  const sendText = useCallback(
    async (text: string, historyBase?: StoryboardChatMessage[]) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const prior = historyBase ?? messages;
      const base = [...prior.filter((m) => m.id !== "welcome"), userMsg];
      setInput("");

      if (shouldCaptureSceneDescription(effectiveProject, trimmed)) {
        const result = completeCustomSceneInput(effectiveProject, trimmed);
        if (!result) return;
        applyWorkflowPatch(result.workflowPatch);
        const assistantMsg: StoryboardChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.assistantReply,
          createdAt: new Date().toISOString(),
        };
        const next = [...base, assistantMsg];
        await updateStoryboardProject(projectId, {
          chatHistory: next,
          meta: {
            ...project.meta,
            workflow: {
              ...project.meta?.workflow,
              ...workflowOverride,
              ...result.workflowPatch,
            },
          },
        });
        setMessages(next);
        if (onDeliverableReady) await onDeliverableReady();
        return;
      }

      if (isAwaitingSceneApplyMode(effectiveProject)) {
        const assistantMsg: StoryboardChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "请点击上方「自定义」或「AI 生成」选择场景应用方式。",
          createdAt: new Date().toISOString(),
        };
        await persistLocalMessages([...base, assistantMsg]);
        return;
      }

      if (isAwaitingPlanDeliverable(effectiveProject)) {
        const assistantMsg: StoryboardChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "策划方案未完整生成，请点击「重新生成策划」重试。",
          createdAt: new Date().toISOString(),
        };
        await persistLocalMessages([...base, assistantMsg]);
        return;
      }

      if (isAwaitingSellpointInput(effectiveProject)) {
        const result = completeSellpointInput(effectiveProject, trimmed);
        if (!result) return;
        const assistantMsg: StoryboardChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.assistantReply,
          createdAt: new Date().toISOString(),
        };
        const next = [...base, assistantMsg];
        await updateStoryboardProject(projectId, {
          chatHistory: next,
          meta: {
            ...project.meta,
            workflow: {
              ...project.meta?.workflow,
              ...result.workflowPatch,
            },
          },
        });
        setMessages(next);
        if (onDeliverableReady) await onDeliverableReady();
        if (result.completed && result.llmUserMessage) {
          await runInternalLlmStream(next, result.llmUserMessage);
        }
        return;
      }

      const isPlanLlmTrigger =
        isStoryboardPlanLlmTrigger(trimmed) || isSceneAdjustLlmTrigger(trimmed);
      const projWithBase: StoryboardProject = { ...project, chatHistory: base };
      const deferLlm =
        !isPlanLlmTrigger &&
        !planModeChosen(projWithBase) &&
        !hasStoryboardDeliverable(projWithBase) &&
        !isParamCollecting(projWithBase);

      if (deferLlm) {
        let reply: string;
        if (isAwaitingInitialProductRef(projWithBase)) {
          reply =
            "请先在参考图区上传产品图（必填），上传完成后点击「已上传产品图」，再输入产品名。";
        } else if (isAwaitingPlanMode(projWithBase)) {
          reply = "请点击上方按钮选择「快速生成」或「自定义参数」。";
        } else if (!projWithBase.meta?.workflow?.productCategory) {
          reply = `已收到产品「${trimmed}」。\n请先选择产品品类：`;
        } else {
          reply = "请点击上方按钮继续操作。";
        }
        const assistantMsg: StoryboardChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
        };
        await persistLocalMessages([...base, assistantMsg]);
        return;
      }

      setMessages(base);
      stickToBottomRef.current = true;
      setStreaming(true);
      setStreamText("");

      try {
        const full = await streamStoryboardChat({
          projectId,
          messages: base,
          modelKey: settings.chatModelKey,
          onChunk: setStreamText,
        });
        setStreamText("");
        if (onDeliverableReady) {
          await onDeliverableReady();
        } else {
          const refreshed = await getStoryboardProject(projectId);
          if (refreshed.chatHistory.length) {
            setMessages(refreshed.chatHistory);
          } else {
            setMessages([
              ...base,
              {
                id: `assistant-${Date.now()}`,
                role: "assistant" as const,
                content: full,
                createdAt: new Date().toISOString(),
              },
            ]);
          }
        }
      } catch (e) {
        const err = e instanceof Error ? e.message : "发送失败";
        const withErr = [
          ...base,
          {
            id: `err-${Date.now()}`,
            role: "assistant" as const,
            content: `请求失败：${err}`,
            createdAt: new Date().toISOString(),
          },
        ];
        setMessages(withErr);
        await updateStoryboardProject(projectId, { chatHistory: withErr });
        setStreamText("");
      } finally {
        setStreaming(false);
      }
    },
    [
      streaming,
      messages,
      project,
      effectiveProject,
      projectId,
      settings.chatModelKey,
      onDeliverableReady,
      persistLocalMessages,
      applyWorkflowPatch,
      workflowOverride,
      runInternalLlmStream,
    ],
  );

  const send = useCallback(() => sendText(input), [input, sendText]);

  const displayMessages = (streaming
    ? [
        ...messages,
        {
          id: "streaming",
          role: "assistant" as const,
          content: streamText || "…",
          createdAt: new Date().toISOString(),
        },
      ]
    : messages
  ).filter(
    (m) =>
      !(
        m.role === "user" &&
        (isSceneAdjustLlmTrigger(m.content) || isStoryboardPlanLlmTrigger(m.content))
      ),
  );

  const lastAssistantId = [...displayMessages].reverse().find((m) => m.role === "assistant")?.id;
  const awaitingSchemePick = isAwaitingSchemePick(effectiveProject);
  const schemePickChoices = awaitingSchemePick
    ? buildSchemePickChoiceCards(effectiveProject)
    : [];
  const schemePickBlock = schemePickPromptBlock();
  const inlineChoices = inferAssistantChoices(effectiveProject);
  const showSchemePickCards =
    !legacyReadonly && !streaming && awaitingSchemePick && schemePickChoices.length > 1;
  const showPostPlanRefChoices =
    !legacyReadonly && !streaming && !awaitingSchemePick && isInPostPlanRefWorkflow(effectiveProject);
  const showChoices =
    !legacyReadonly && !streaming && inlineChoices.length > 0 && (showPostPlanRefChoices || !showSchemePickCards);

  const handleChoice = async (t: string) => {
    if (isGenerateAllImagesChoice(t)) {
      onRequestGenerateAllImages?.();
      return;
    }
    if (isGenerateFullVideoChoice(t)) {
      onRequestGenerateFullVideo?.();
      return;
    }
    if (isMergePanelVideosChoice(t)) {
      onRequestMergePanelVideos?.();
      return;
    }

    if (t === "已上传产品图") {
      if (isAwaitingInitialProductRef(effectiveProject)) {
        if (!hasStoryboardProductRef(project)) {
          await onAlert({
            title: "请先上传产品图",
            message: "请先在参考图区上传产品图（必填），再点击「已上传产品图」。",
          });
          return;
        }
        const userMsg: StoryboardChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: t,
          createdAt: new Date().toISOString(),
        };
        const assistantMsg: StoryboardChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            "产品图已收到。请输入产品名（如「蓝牙耳机」「保湿面霜」），用于生成策划方案。",
          createdAt: new Date().toISOString(),
        };
        const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
        await updateStoryboardProject(projectId, {
          chatHistory: next,
          meta: {
            ...project.meta,
            workflow: {
              ...project.meta?.workflow,
              initialProductRefAcknowledged: true,
            },
          },
        });
        setMessages(next);
        return;
      }
      if (isInPostPlanRefWorkflow(effectiveProject)) {
        return;
      }
    }

    const schemeIndex = parseSchemePickChoice(effectiveProject, t);
    if (schemeIndex != null && isAwaitingSchemePick(effectiveProject)) {
      setPendingSchemePick(t);
      const deliverable = resolveStoryboardDeliverable(effectiveProject);
      const scheme = deliverable?.schemes?.[schemeIndex];
      const label = scheme ? schemePickChoiceLabel(scheme, schemeIndex) : t;
      applyWorkflowPatch({
        schemePicked: true,
        phase: "refs",
      });
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: label,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `已选定「${scheme?.title ?? label}」。\n\n接下来请上传角色参考图，或选择预设 / 点击「跳过」。`,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      try {
        await updateStoryboardProject(projectId, {
          chatHistory: next,
          meta: {
            ...project.meta,
            selectedSchemeIndex: schemeIndex,
            workflow: {
              ...project.meta?.workflow,
              schemePicked: true,
              phase: "refs",
            },
          },
        });
        setMessages(next);
        await onDeliverableReady?.();
      } finally {
        setPendingSchemePick(null);
      }
      return;
    }

    if (t === "重新定方案") {
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `好的，我们重新收集参数。\n${getStepPrompt(0)}`,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        sheet: null,
        sheetPngUrl: null,
        chatHistory: next,
        meta: {
          ...project.meta,
          deliverable: undefined,
          workflow: {
            ...project.meta?.workflow,
            phase: "planning",
            replanning: false,
            schemePicked: false,
            ...startCustomParamCollectPatch(),
          },
        },
      });
      setMessages(next);
      onDeliverableReady?.();
      return;
    }

    if (isAwaitingCategory(effectiveProject) && isAutoMatchCategoryChoice(t)) {
      const result = completeAutoMatchCategory(effectiveProject);
      if (!result) return;

      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.assistantReply,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...result.workflowPatch,
          },
        },
      });
      setMessages(next);
      onDeliverableReady?.();
      return;
    }

    if (isAwaitingCategory(effectiveProject) && isCategoryChoiceLabel(t)) {
      const result = selectProductCategory(effectiveProject, t);
      if (!result) return;

      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.assistantReply,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...result.workflowPatch,
          },
        },
      });
      setMessages(next);
      onDeliverableReady?.();
      return;
    }

    if (t === CUSTOM_SCENE_INPUT_CHOICE && !sceneRefStepDone(effectiveProject)) {
      const { workflowPatch, assistantReply } = startCustomSceneInput();
      applyWorkflowPatch(workflowPatch);
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantReply,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...workflowPatch,
          },
        },
      });
      setMessages(next);
      onDeliverableReady?.();
      return;
    }

    if (t === SCENE_APPLY_CUSTOM_CHOICE && isAwaitingSceneApplyMode(effectiveProject)) {
      const result = completeSceneApplyCustom(effectiveProject);
      applyWorkflowPatch(result.workflowPatch);
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.assistantReply,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...result.workflowPatch,
          },
        },
      });
      setMessages(next);
      onDeliverableReady?.();
      return;
    }

    if (t === SCENE_APPLY_AI_CHOICE && isAwaitingSceneApplyMode(effectiveProject)) {
      const llmUserMessage = resolveSceneApplyLlmMessage(effectiveProject);
      if (!llmUserMessage) return;
      const result = completeSceneApplyAi();
      applyWorkflowPatch(result.workflowPatch);
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.assistantReply,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...result.workflowPatch,
          },
        },
      });
      setMessages(next);
      if (onDeliverableReady) await onDeliverableReady();
      await runInternalLlmStream(next, llmUserMessage);
      return;
    }

    const scenePresetResult = completeScenePresetChoice(effectiveProject, t);
    if (
      scenePresetResult &&
      !isAwaitingCustomSceneInput(effectiveProject) &&
      !isAwaitingSceneApplyMode(effectiveProject)
    ) {
      applyWorkflowPatch(scenePresetResult.workflowPatch);
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: scenePresetResult.assistantReply,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...scenePresetResult.workflowPatch,
          },
        },
      });
      setMessages(next);
      if (onDeliverableReady) await onDeliverableReady();
      return;
    }

    if (t === REGENERATE_PLAN_CHOICE && isAwaitingPlanDeliverable(effectiveProject)) {
      const llmUserMessage = buildStoryboardLlmUserMessage(effectiveProject, { durationSec });
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "正在重新生成策划方案（brief + 三套分镜 JSON）…",
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, { chatHistory: next });
      setMessages(next);
      if (onDeliverableReady) await onDeliverableReady();
      await runInternalLlmStream(next, llmUserMessage);
      return;
    }

    if (t === QUICK_GENERATE_CHOICE) {
      const result = completeQuickGenerate(effectiveProject, settings.durationSec);
      applyWorkflowPatch(result.workflowPatch);
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.assistantReply,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...result.workflowPatch,
          },
        },
      });
      setMessages(next);
      if (onDeliverableReady) await onDeliverableReady();
      if (result.llmUserMessage) {
        await runInternalLlmStream(next, result.llmUserMessage);
      }
      return;
    }

    if (t === CUSTOM_PARAMS_CHOICE) {
      const patch = startCustomParamCollectPatch(effectiveProject);
      const startStep = typeof patch.paramStep === "number" ? patch.paramStep : 0;
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `好的，我们逐项确认参数。\n${getStepPrompt(startStep)}`,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...patch,
          },
        },
      });
      setMessages(next);
      onDeliverableReady?.();
      return;
    }

    if (isParamCollectChoice(effectiveProject, t)) {
      const result = advanceParamStep(effectiveProject, t);
      if (!result) return;

      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.assistantReply,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];

      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...result.workflowPatch,
          },
        },
      });
      applyWorkflowPatch(result.workflowPatch);
      setMessages(next);
      if (onDeliverableReady) await onDeliverableReady();
      if (result.completed && result.llmUserMessage) {
        await runInternalLlmStream(next, result.llmUserMessage);
      }
      return;
    }

    const patch = workflowPatchForChoice(project, t);
    if (patch) {
      await updateStoryboardProject(projectId, {
        meta: {
          ...project.meta,
          workflow: { ...project.meta?.workflow, ...patch },
        },
      });
      onDeliverableReady?.();
    }
    if (t === "定稿" || t === "无需微调") {
      if (isAwaitingSchemePick(project)) {
        await onAlert({
          title: "请先选定方案",
          message: "共有多套分镜方案，请先点击上方按钮或右侧卡片选定一套，再上传参考图并定稿。",
        });
        return;
      }
      try {
        await syncStoryboardSheet(projectId);
        onDeliverableReady?.();
      } catch {
        /* 助手会继续处理 */
      }
    }
    await sendText(t);
  };

  const paramCollecting = isParamCollecting(effectiveProject);
  const awaitingSellpoint = isAwaitingSellpointInput(effectiveProject);
  const awaitingCustomScene = isAwaitingCustomSceneInput(effectiveProject);
  const awaitingSceneApplyMode = isAwaitingSceneApplyMode(effectiveProject);
  const awaitingInitialProductRef = isAwaitingInitialProductRef(effectiveProject);
  const awaitingProductName = isAwaitingProductNameInput(effectiveProject);
  const freeTextEnabled =
    awaitingSellpoint || awaitingCustomScene || awaitingProductName;
  const modelName =
    chatModels.find((m) => m.modelKey === settings.chatModelKey)?.displayName ?? "助手模型";
  const panelCount = project.sheet?.panels.length ?? 0;
  const params = asStoryboardDeliverable(project.meta?.deliverable)?.params;
  const productFromParams =
    typeof params?.产品名 === "string" ? params.产品名.trim() : "";
  const productLabel =
    project.meta?.deliverable?.productName?.trim() || productFromParams || "Skill 策划";
  const assistantSubtitle = `${durationSec}秒 · ${panelCount > 0 ? `${panelCount} 镜` : productLabel} · ${modelName}`;

  const needsAttention =
    Boolean(pendingSchemePick) ||
    showSchemePickCards ||
    (showPostPlanRefChoices && inlineChoices.length > 0);

  const composerDisabled =
    legacyReadonly ||
    streaming ||
    awaitingSceneApplyMode ||
    (paramCollecting && !freeTextEnabled) ||
    (awaitingInitialProductRef && !hasStoryboardProductRef(project));

  const composerSection = (
    <div className="shrink-0 border-t border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-composer-bg)] p-4">
      <div className="flex items-end gap-2">
        <textarea
          className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
          rows={collapsed ? 1 : 2}
          placeholder={
            showSchemePickCards
              ? "也可输入补充说明；点选上方卡片可继续下一步…"
              : showPostPlanRefChoices
                ? "也可输入补充说明；点选上方按钮继续…"
                : resolveAssistantComposerPlaceholder(effectiveProject)
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={composerDisabled}
          onFocus={() => {
            if (collapsed) tryExpand();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <EcomAssistantSendButton
          disabled={composerDisabled || !input.trim()}
          busy={streaming}
          onClick={send}
        />
        {!collapsed ? (
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={streaming}
            onClick={() => setMessages([WELCOME])}
            className="shrink-0"
          >
            清空
          </EcomButtonSecondary>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={assistantRootRef}
        className={cn(
          "flex h-full min-h-0 flex-col bg-[var(--ecom-assistant-surface)]",
          collapsed && "pointer-events-none invisible absolute h-0 w-0 overflow-hidden",
        )}
        onBlur={handleAssistantBlur}
      >
      <EcomAssistantPanelHeader
        title="微剧故事版助手"
        subtitle={assistantSubtitle}
        composerWide={composerWide}
        onComposerWideChange={onComposerWideChange}
        onCollapse={onCollapsedChange ? tryCollapse : undefined}
        collapseDisabled={streaming}
        trailing={
          onOpenSettings ? (
            <EcomAssistantIconButton title="影片参数" onClick={() => onOpenSettings()}>
              <Settings2 className={ECOM_ASSISTANT_CONTROL_ICON_CLASS} />
            </EcomAssistantIconButton>
          ) : null
        }
      />

      <div
        ref={scrollRef}
        className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        <div className="space-y-3">
          {legacyReadonly ? (
            <div className={ECOM_ASSISTANT_BUBBLE_CLASS}>
              此为旧版微剧故事版项目，仅支持只读浏览。请新建「服装专业版」项目继续创作。
            </div>
          ) : null}
          {displayMessages.map((m) => {
            const isLastAssistant = m.role === "assistant" && m.id === lastAssistantId;
            const sbDeliverable = asStoryboardDeliverable(project.meta?.deliverable);
            const useProjectDeliverable =
              isLastAssistant &&
              Boolean(sbDeliverable?.schemes?.length || sbDeliverable?.analysis);
            const showDeliverableView =
              m.role === "assistant" &&
              (useProjectDeliverable ||
                Boolean(extractStoryboardDeliverableFromText(m.content)));
            const briefBody =
              m.id === "streaming"
                ? stripStoryboardDeliverableFence(m.content)
                : m.role === "assistant"
                  ? stripStoryboardDeliverableFence(m.content)
                  : m.content;
            return (
              <div
                key={m.id}
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
                    showDeliverableView ? (
                      <StoryboardAssistantDeliverableView
                        content={m.content}
                        projectDeliverable={
                          useProjectDeliverable ? project.meta?.deliverable : undefined
                        }
                        selectedSchemeIndex={resolveSelectedSchemeIndex(effectiveProject)}
                        awaitingSchemePick={isAwaitingSchemePick(effectiveProject)}
                        compact={m.id === "streaming"}
                      />
                    ) : briefBody ? (
                      <p className="whitespace-pre-wrap text-sm text-[#1d1d1f]">{briefBody}</p>
                    ) : m.id === "streaming" ? (
                      <p className="text-sm text-[#86868b]">正在生成策划方案…</p>
                    ) : null
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                  {isLastAssistant && showChoices && !showSchemePickCards && !showPostPlanRefChoices ? (
                    <StoryboardAssistantChoices
                      project={effectiveProject}
                      disabled={streaming}
                      compact
                      onChoose={(t) => void handleChoice(t)}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
          {streaming ? (
            <StoryboardTaskStatus
              active
              title="思考中"
              detail="助手正在流式输出策划内容，完成后将同步到中间分镜区…"
              className="mt-3"
            />
          ) : null}
          {showPostPlanRefChoices && inlineChoices.length > 0 ? (
            <div className="flex flex-col items-start">
              <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
                <StoryboardAssistantChoices
                  project={effectiveProject}
                  disabled={streaming}
                  onChoose={(t) => void handleChoice(t)}
                />
              </div>
            </div>
          ) : null}
          {showSchemePickCards ? (
            <div className="flex flex-col items-start">
              <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
                <SeedVideoAssistantChoiceCards
                  title={schemePickBlock.title}
                  subtitle={schemePickBlock.subtitle}
                  choices={schemePickChoices}
                  disabled={Boolean(pendingSchemePick)}
                  selectedMessage={pendingSchemePick}
                  onSelect={(message) => void handleChoice(message)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!collapsed ? composerSection : null}
      </div>

      {collapsed ? (
        <EcomAssistantFloatingComposer
          open
          attentionBadge={needsAttention}
          onExpand={tryExpand}
        >
          <div data-ecom-floating-composer onClick={(e) => e.stopPropagation()}>
            {composerSection}
          </div>
        </EcomAssistantFloatingComposer>
      ) : null}
    </>
  );
}
