"use client";

import { Loader2, Maximize2, Minimize2, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STORYBOARD_ASSISTANT_CHOICE_CLASS } from "@/components/storyboard/storyboard-assistant-choices";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  streamHandCraftChat,
  syncHandCraftPlan,
  updateHandCraftProject,
} from "@/lib/ecom-hand-craft-api";
import type {
  HandCraftChatMessage,
  HandCraftProject,
  HandCraftStepId,
} from "@/lib/hand-craft-types";
import {
  assistantChoices,
  choicePrompt,
  handCraftStep,
  HAND_CRAFT_WELCOME_MESSAGE,
  isStepReady,
  missingRequirements,
  stepIdFromChoice,
} from "@/lib/hand-craft-workflow";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

const WELCOME: HandCraftChatMessage = {
  id: "welcome",
  role: "assistant",
  content: HAND_CRAFT_WELCOME_MESSAGE,
  createdAt: new Date().toISOString(),
};

type Props = {
  project: HandCraftProject;
  currentStepId: HandCraftStepId;
  chatModels: StoryboardGatewayModel[];
  chatModelKey: string;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  onStreamingChange?: (streaming: boolean) => void;
  onProjectChange: () => void | Promise<void>;
  onCurrentStepChange: (stepId: HandCraftStepId) => void | Promise<void>;
  /** 用户在会话里确认「生成本步」时，由中间工作区执行出图 / 拼版 */
  onRequestGenerateStep: (stepId: HandCraftStepId) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
};

/**
 * 手伴创作助手：按 doc/手伴/skill.md 的 10 步 SOP 逐步推进。
 *
 * 每步只有三种去向：确认生成 / 微调本步 / 回上一步。生成动作交给中间工作区，
 * 助手只负责说明与产出槽位说明表（由 plan/sync 解析回写）。
 */
export function HandCraftAssistantPanel({
  project,
  currentStepId,
  chatModels,
  chatModelKey,
  composerWide,
  onComposerWideChange,
  onStreamingChange,
  onProjectChange,
  onCurrentStepChange,
  onRequestGenerateStep,
  onAlert,
}: Props) {
  const chatHistory = project.chatHistory;
  const projectId = project.id;
  const [messages, setMessages] = useState<HandCraftChatMessage[]>(
    chatHistory.length ? chatHistory : [WELCOME],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    if (streaming) return;
    setMessages(chatHistory.length ? chatHistory : [WELCOME]);
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

  const sketchCount = project.references.length;

  const sendText = useCallback(
    async (text: string, historyBase?: HandCraftChatMessage[]) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      if (sketchCount === 0) {
        await onAlert({
          title: "请先上传线稿",
          message: "手伴创作以你的手绘线稿为唯一原型，请先在中间工作区上传线稿。",
          variant: "error",
        });
        return;
      }

      const prior = historyBase ?? messages;
      const base: HandCraftChatMessage[] = [
        ...prior.filter((m) => m.id !== "welcome" && !m.id.startsWith("err-")),
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
        const full = await streamHandCraftChat({
          projectId,
          messages: base,
          modelKey: chatModelKey,
          onChunk: (chunk) => setStreamText((prev) => prev + chunk),
        });
        setStreamText("");
        // 助手输出里的步骤标记与槽位说明表在服务端解析回写，UI 只负责刷新
        try {
          await syncHandCraftPlan(projectId, { markdown: full });
        } catch {
          /* 解析失败不影响会话，用户可在工作区手改说明 */
        }
        await onProjectChange();
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
    [
      chatModelKey,
      messages,
      onAlert,
      onProjectChange,
      projectId,
      sketchCount,
      streaming,
    ],
  );

  const appendLocalTurn = useCallback(
    async (userText: string, assistantText: string) => {
      const now = new Date().toISOString();
      const ts = Date.now();
      const next: HandCraftChatMessage[] = [
        ...messages.filter((m) => m.id !== "welcome" && !m.id.startsWith("err-")),
        { id: `user-${ts}`, role: "user", content: userText, createdAt: now },
        {
          id: `assistant-${ts + 1}`,
          role: "assistant",
          content: assistantText,
          createdAt: now,
        },
      ];
      setMessages(next);
      await updateHandCraftProject(projectId, { chatHistory: next });
      await onProjectChange();
    },
    [messages, onProjectChange, projectId],
  );

  const handleChoice = useCallback(
    async (choice: string) => {
      const target = stepIdFromChoice(choice) ?? currentStepId;
      const meta = handCraftStep(target);

      if (choice.startsWith("确认生成")) {
        const blocked = missingRequirements(project, target);
        if (blocked.length > 0) {
          await onAlert({
            title: "还不能生成",
            message: `第 ${meta.no} 步依赖尚未齐备：${blocked.join("、")}`,
            variant: "error",
          });
          return;
        }
        await onCurrentStepChange(target);
        await appendLocalTurn(
          choice,
          meta.kind === "compose"
            ? `开始拼版第 ${meta.no} 步「${meta.label}」。版式由系统排版、浏览器抓图后存入云端，共 ${meta.count} 页。`
            : `开始生成第 ${meta.no} 步「${meta.label}」，共 ${meta.count} 张。出图会以第 1 步定稿的主形象为参考图，并自动拼接基准风格串。`,
        );
        onRequestGenerateStep(target);
        return;
      }

      if (choice.startsWith("微调")) {
        await onCurrentStepChange(target);
        await sendText(
          `微调第 ${meta.no} 步「${meta.label}」。请按固定格式输出本步槽位说明表（序号｜标题｜画面说明），我会据此更新工作区的槽位说明。`,
        );
        return;
      }

      // 进入下一步 / 回到上一步
      await onCurrentStepChange(target);
      await sendText(
        `${choice}。请先说明本步要产出什么、共几张，再输出本步槽位说明表（序号｜标题｜画面说明）。`,
      );
    },
    [
      appendLocalTurn,
      currentStepId,
      onAlert,
      onCurrentStepChange,
      onRequestGenerateStep,
      project,
      sendText,
    ],
  );

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

  const lastAssistantId = [...displayMessages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  const choices = useMemo(
    () => assistantChoices(project, currentStepId),
    [project, currentStepId],
  );
  const showChoices = !streaming && sketchCount > 0 && choices.length > 0;
  const modelName =
    chatModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? "助手模型";
  const stepMeta = handCraftStep(currentStepId);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--ecom-assistant-surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bg)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1d1d1f]">手伴创作助手</p>
          <p className="truncate text-[10px] text-[#6e6e73]">
            第 {stepMeta.no}/10 步 · {stepMeta.label} · {modelName}
          </p>
        </div>
        {onComposerWideChange ? (
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[var(--ecom-chrome-accent)]"
            title={composerWide ? "收窄会话区" : "加宽会话区"}
            onClick={() => onComposerWideChange(!composerWide)}
          >
            {composerWide ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      <StoryboardTaskStatus
        active={streaming}
        title="思考中"
        detail="助手正在按 SOP 输出本步说明，完成后会同步到中间工作区…"
      />

      <div
        ref={scrollRef}
        className="ecom-scrollbar-overlay min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-scroll overscroll-y-contain px-4 py-4 [overflow-anchor:none]"
      >
        {displayMessages.map((m) => {
          const isLastAssistant = m.role === "assistant" && m.id === lastAssistantId;
          return (
            <div
              key={m.id}
              className={cn(
                "max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "ml-auto border border-[var(--ecom-assistant-bubble-user-border)] bg-[var(--ecom-assistant-bubble-user-bg)] text-[#1d1d1f]"
                  : "bg-[var(--ecom-assistant-bubble-bot-bg)] text-[#1d1d1f] shadow-sm ring-1 ring-[var(--ecom-assistant-bubble-bot-ring)]",
              )}
            >
              <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              {isLastAssistant && showChoices ? (
                <div className="mt-3 border-t border-[var(--ecom-assistant-border)] pt-3">
                  <p className="mb-2 text-[11px] text-[#6e6e73]">
                    {choicePrompt(currentStepId)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {choices.map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={streaming}
                        className={STORYBOARD_ASSISTANT_CHOICE_CLASS}
                        onClick={() => void handleChoice(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {isStepReady(project, currentStepId) ? (
                    <p className="mt-2 text-[11px] text-[#6e6e73]">
                      第 {stepMeta.no} 步已出齐，可直接进入下一步。
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[var(--ecom-assistant-border)] p-4">
        <textarea
          className="mb-3 w-full resize-none rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
          rows={composerWide ? 4 : 2}
          placeholder={
            sketchCount === 0
              ? "请先在中间工作区上传手绘线稿…"
              : "补充说明，例如「盲盒主题换成节日系列」…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming || sketchCount === 0}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendText(input);
            }
          }}
        />
        <div className="flex gap-2">
          <EcomButtonPrimary
            size="sm"
            type="button"
            className="flex-1"
            disabled={streaming || sketchCount === 0 || !input.trim()}
            onClick={() => void sendText(input)}
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
            disabled={streaming || sketchCount === 0}
            onClick={() =>
              void sendText(
                `请开始第 ${stepMeta.no} 步「${stepMeta.label}」，先说明本步产出，再输出槽位说明表（序号｜标题｜画面说明）。`,
              )
            }
          >
            讲解本步
          </EcomButtonSecondary>
        </div>
      </div>
    </div>
  );
}
