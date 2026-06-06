"use client";

import { Loader2, Send, Settings2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { StoryboardAssistantChoices } from "@/components/storyboard/storyboard-assistant-choices";
import {
  advanceParamStep,
  canTextInputDuringParamCollect,
  completeSellpointInput,
  getStepPrompt,
  isAwaitingSellpointInput,
  isParamCollectChoice,
  isParamCollecting,
  startCustomParamCollectPatch,
} from "@/lib/storyboard-param-collect";
import {
  inferAssistantChoices,
  planModeChosen,
  workflowPatchForChoice,
} from "@/lib/storyboard-workflow";
import type { StoryboardSettingsValue } from "@/components/storyboard/storyboard-settings-dialog";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  streamStoryboardChat,
  syncStoryboardSheet,
  updateStoryboardProject,
} from "@/lib/ecom-storyboard-api";
import {
  isGenerateAllImagesChoice,
  isGenerateFullVideoChoice,
  isMergePanelVideosChoice,
} from "@/lib/storyboard-workflow";
import { stripStoryboardDeliverableFence } from "@/lib/storyboard-display";
import type {
  StoryboardChatMessage,
  StoryboardGatewayModel,
  StoryboardProject,
} from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

const WELCOME: StoryboardChatMessage = {
  id: "welcome",
  role: "assistant",
  content: `你好，我是【电商全品类带货短视频分镜策划师】。

请先输入产品名（如「蓝牙耳机」「保湿面霜」），再选择策划方式。`,
  createdAt: new Date().toISOString(),
};

function hasStoryboardDeliverable(project: StoryboardProject): boolean {
  return Boolean(
    project.meta?.deliverable?.analysis || project.meta?.deliverable?.schemes?.length,
  );
}

type Props = {
  project: StoryboardProject;
  chatModels: StoryboardGatewayModel[];
  imageModels: StoryboardGatewayModel[];
  videoModels: StoryboardGatewayModel[];
  settings: StoryboardSettingsValue;
  onOpenSettings?: () => void;
  onStreamingChange?: (streaming: boolean) => void;
  onDeliverableReady?: () => void;
  onRequestGenerateAllImages?: () => void;
  onRequestGenerateFullVideo?: () => void;
  onRequestMergePanelVideos?: () => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
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
}: Props) {
  const chatHistory = project.chatHistory;
  const projectId = project.id;
  const [messages, setMessages] = useState<StoryboardChatMessage[]>(
    chatHistory.length ? chatHistory : [WELCOME],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streaming) return;
    if (chatHistory.length) setMessages(chatHistory);
  }, [chatHistory, streaming]);

  useEffect(() => {
    onStreamingChange?.(streaming);
  }, [streaming, onStreamingChange]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, streaming]);

  const persistLocalMessages = useCallback(
    async (next: StoryboardChatMessage[]) => {
      setMessages(next);
      await updateStoryboardProject(projectId, { chatHistory: next });
    },
    [projectId],
  );

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const base = [...messages.filter((m) => m.id !== "welcome"), userMsg];
      setInput("");

      if (isAwaitingSellpointInput(project)) {
        const result = completeSellpointInput(project, trimmed);
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
        onDeliverableReady?.();
        if (result.completed && result.llmUserMessage) {
          await sendText(result.llmUserMessage);
        }
        return;
      }

      const isPlanLlmTrigger =
        trimmed === "按默认方案A" || trimmed.startsWith("参数已确认");
      const deferLlm =
        !isPlanLlmTrigger &&
        !planModeChosen(project) &&
        !hasStoryboardDeliverable(project) &&
        !isParamCollecting(project);

      if (deferLlm) {
        const assistantMsg: StoryboardChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: `已收到产品「${trimmed}」。\n请选择策划方式：`,
          createdAt: new Date().toISOString(),
        };
        await persistLocalMessages([...base, assistantMsg]);
        return;
      }

      setMessages(base);
      setStreaming(true);
      setStreamText("");

      try {
        const full = await streamStoryboardChat({
          projectId,
          messages: base,
          modelKey: settings.chatModelKey,
          onChunk: setStreamText,
        });
        const withReply = [
          ...base,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant" as const,
            content: full,
            createdAt: new Date().toISOString(),
          },
        ];
        setMessages(withReply);
        await updateStoryboardProject(projectId, { chatHistory: withReply });
        setStreamText("");
        onDeliverableReady?.();
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
      projectId,
      settings.chatModelKey,
      onDeliverableReady,
      persistLocalMessages,
    ],
  );

  const send = useCallback(() => sendText(input), [input, sendText]);

  const displayMessages = streaming
    ? [
        ...messages,
        {
          id: "streaming",
          role: "assistant" as const,
          content: streamText || "…",
          createdAt: new Date().toISOString(),
        },
      ]
    : messages;

  const lastAssistantId = [...displayMessages].reverse().find((m) => m.role === "assistant")?.id;
  const showChoices = !streaming && inferAssistantChoices(project).length > 0;

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
            ...startCustomParamCollectPatch(),
          },
        },
      });
      setMessages(next);
      onDeliverableReady?.();
      return;
    }

    if (t === "自定义参数") {
      const userMsg: StoryboardChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: t,
        createdAt: new Date().toISOString(),
      };
      const assistantMsg: StoryboardChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `好的，我们逐项确认参数。\n${getStepPrompt(0)}`,
        createdAt: new Date().toISOString(),
      };
      const next = [...messages.filter((m) => m.id !== "welcome"), userMsg, assistantMsg];
      await updateStoryboardProject(projectId, {
        chatHistory: next,
        meta: {
          ...project.meta,
          workflow: {
            ...project.meta?.workflow,
            ...startCustomParamCollectPatch(),
          },
        },
      });
      setMessages(next);
      onDeliverableReady?.();
      return;
    }

    if (isParamCollectChoice(project, t)) {
      const result = advanceParamStep(project, t);
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

      if (result.completed && result.llmUserMessage) {
        await sendText(result.llmUserMessage);
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
      try {
        await syncStoryboardSheet(projectId);
        onDeliverableReady?.();
      } catch {
        /* 助手会继续处理 */
      }
    }
    await sendText(t);
  };

  const paramCollecting = isParamCollecting(project);
  const awaitingSellpoint = isAwaitingSellpointInput(project);
  const paramInputEnabled = canTextInputDuringParamCollect(project);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fafafa]">
      <div className="flex items-center justify-between gap-2 border-b border-[#e8e8ed] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#1d1d1f]">创作助手</p>
          <p className="text-[10px] text-[#86868b]">
            {chatModels.find((m) => m.modelKey === settings.chatModelKey)?.displayName ??
              "助手模型"}
          </p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d2d2d7] bg-white text-[#6e6e73] hover:border-[#0071e3] hover:text-[#0071e3]"
          title="影片参数"
          onClick={() => onOpenSettings?.()}
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      <StoryboardTaskStatus
        active={streaming}
        title="思考中"
        detail="助手正在流式输出策划内容，完成后将同步到右侧分镜区…"
      />

      <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {displayMessages.map((m) => {
          const body =
            m.id === "streaming"
              ? stripStoryboardDeliverableFence(m.content)
              : m.role === "assistant"
                ? stripStoryboardDeliverableFence(m.content)
                : m.content;
          const isLastAssistant = m.role === "assistant" && m.id === lastAssistantId;
          return (
            <div
              key={m.id}
              className={cn(
                "max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto border border-[#d2d2d7] bg-[#f5f5f7] text-[#1d1d1f]"
                  : "bg-white text-[#1d1d1f] shadow-sm ring-1 ring-[#e8e8ed]",
              )}
            >
              <pre className="whitespace-pre-wrap font-sans">{body}</pre>
              {isLastAssistant && showChoices ? (
                <StoryboardAssistantChoices
                  project={project}
                  disabled={streaming}
                  compact
                  onChoose={(t) => void handleChoice(t)}
                />
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#e8e8ed] p-4">
        <textarea
          className="mb-3 w-full resize-none rounded-xl border border-[#d2d2d7] bg-white px-3 py-2 text-sm outline-none focus:border-[#0071e3] disabled:bg-[#f5f5f7] disabled:text-[#86868b]"
          rows={2}
          placeholder={
            awaitingSellpoint
              ? "请输入产品卖点（品牌、价格、核心卖点等）…"
              : paramCollecting
                ? "请点击上方按钮选择参数…"
                : "输入产品名，或补充说明（可选）…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming || (paramCollecting && !paramInputEnabled)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="flex gap-2">
          <EcomButtonPrimary
            size="sm"
            type="button"
            className="flex-1"
            disabled={
              streaming || (paramCollecting && !paramInputEnabled) || !input.trim()
            }
            onClick={send}
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Send className="h-4 w-4 shrink-0" />
            )}
            发送
          </EcomButtonPrimary>
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={streaming}
            onClick={() => setMessages([WELCOME])}
          >
            清空
          </EcomButtonSecondary>
        </div>
      </div>

    </div>
  );
}
