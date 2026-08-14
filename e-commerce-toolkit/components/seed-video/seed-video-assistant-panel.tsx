"use client";

import { Loader2, PanelRightClose, PanelRightOpen, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { STORYBOARD_ASSISTANT_CHOICE_CLASS } from "@/components/storyboard/storyboard-assistant-choices";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  streamSeedVideoChat,
  syncSeedVideoPlan,
  getSeedVideoProject,
} from "@/lib/ecom-seed-video-api";
import { SEED_VIDEO_WELCOME_MESSAGE } from "@/lib/seed-video-mention-refs";
import type { SeedVideoChatMessage, SeedVideoProject } from "@/lib/seed-video-types";
import {
  buildUserMessageWithChoice,
  choicePrompt,
  inferAssistantChoices,
} from "@/lib/seed-video-workflow";
import { cn } from "@/lib/utils";

const WELCOME: SeedVideoChatMessage = {
  id: "welcome",
  role: "assistant",
  content: SEED_VIDEO_WELCOME_MESSAGE,
  createdAt: new Date().toISOString(),
};

type Props = {
  project: SeedVideoProject;
  chatModelKey: string;
  onProjectChange: () => void | Promise<void>;
  onStreamingChange?: (streaming: boolean) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  startPlanningToken?: number;
  planningPrompt?: string;
};

export function SeedVideoAssistantPanel({
  project,
  chatModelKey,
  onProjectChange,
  onStreamingChange,
  onAlert,
  composerWide = false,
  onComposerWideChange,
  startPlanningToken = 0,
  planningPrompt = "",
}: Props) {
  const projectId = project.id;
  const chatHistory = project.chatHistory;
  const [messages, setMessages] = useState<SeedVideoChatMessage[]>(
    chatHistory.length ? chatHistory : [WELCOME],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const startPlanningTokenRef = useRef(startPlanningToken);

  const materials = project.references.filter((r) => r.role === "seed-material");

  useEffect(() => {
    if (streaming) return;
    if (chatHistory.length) setMessages(chatHistory);
  }, [chatHistory, streaming]);

  useEffect(() => {
    onStreamingChange?.(streaming);
  }, [streaming, onStreamingChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamText, streaming]);

  const effectiveProject = useMemo<SeedVideoProject>(
    () => ({
      ...project,
      chatHistory: messages.filter(
        (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
      ),
    }),
    [project, messages],
  );

  const choices = inferAssistantChoices(effectiveProject);
  const showChoices = choices.length > 0 && !streaming;
  const inputDisabled = streaming;

  const runAssistant = useCallback(
    async (history: SeedVideoChatMessage[]) => {
      setStreaming(true);
      setStreamText("");
      const streamingMsg: SeedVideoChatMessage = {
        id: "streaming",
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages([...history, streamingMsg]);

      try {
        const full = await streamSeedVideoChat({
          projectId,
          messages: history,
          modelKey: chatModelKey,
          onChunk: (chunk) => setStreamText((prev) => prev + chunk),
        });

        const updated = await getSeedVideoProject(projectId);
        setMessages(updated.chatHistory.length ? updated.chatHistory : history);

        const lastUser = history[history.length - 1]?.content ?? "";
        await syncSeedVideoPlan(projectId, {
          markdown: full,
          userChoice: lastUser,
        });
        await onProjectChange();
      } catch (e) {
        await onAlert({
          title: "助手失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
        setMessages(history);
      } finally {
        setStreaming(false);
        setStreamText("");
      }
    },
    [chatModelKey, onAlert, onProjectChange, projectId],
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || streaming) return;
      const userMsg: SeedVideoChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        refIds: materials.map((r) => r.id),
      };
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg];
      setInput("");
      setMessages(history);
      await runAssistant(history);
    },
    [input, materials, messages, runAssistant, streaming],
  );

  useEffect(() => {
    if (startPlanningToken <= 0 || startPlanningToken === startPlanningTokenRef.current) {
      startPlanningTokenRef.current = startPlanningToken;
      return;
    }
    startPlanningTokenRef.current = startPlanningToken;
    const prompt = planningPrompt.trim();
    if (!prompt || streaming) return;
    void handleSend(prompt);
  }, [handleSend, planningPrompt, startPlanningToken, streaming]);

  async function handleChoice(choice: string) {
    if (streaming) return;
    const history = buildUserMessageWithChoice(
      messages.filter((m) => m.id !== "welcome"),
      choice,
    );
    setMessages(history);
    await runAssistant(history);
  }

  function refThumbsForMessage(msg: SeedVideoChatMessage) {
    const ids = msg.refIds ?? [];
    if (!ids.length) return null;
    const refs = ids
      .map((id) => project.references.find((r) => r.id === id))
      .filter(Boolean)
      .slice(0, 4);
    if (!refs.length) return null;
    return (
      <div className="mb-1.5 flex justify-end gap-1">
        {refs.map((r) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={r!.id}
            src={r!.ossUrl}
            alt={r!.label}
            className="h-10 w-10 rounded-lg border border-[#e8e8ed] object-cover"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {(streaming
            ? [
                ...messages.filter((m) => m.id !== "streaming"),
                {
                  id: "streaming",
                  role: "assistant" as const,
                  content: streamText,
                  createdAt: new Date().toISOString(),
                },
              ]
            : messages
          ).map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col",
                msg.role === "user" ? "items-end" : "items-start",
              )}
            >
              {msg.role === "user" ? refThumbsForMessage(msg) : null}
              <div
                className={cn(
                  "max-w-[95%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-[#0071e3] text-white"
                    : "border border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bubble-bg)] text-[#1d1d1f]",
                )}
              >
                {msg.role === "assistant" ? (
                  <StoryboardMarkdownBlock markdown={msg.content || (streaming ? "…" : "")} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.role === "assistant" &&
                msg.id === messages[messages.length - 1]?.id &&
                showChoices ? (
                  <div className="mt-3 border-t border-[var(--ecom-assistant-border)] pt-3">
                    <p className="mb-2 text-[11px] text-[#6e6e73]">{choicePrompt(effectiveProject)}</p>
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
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {streaming ? (
          <StoryboardTaskStatus
            active
            title="思考中"
            detail="助手正在输出策划内容，完成后自动同步到中间工作区…"
            className="mt-3"
          />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-composer-bg)] p-4">
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-[#6e6e73] transition hover:bg-[var(--ecom-chrome-hover)] hover:text-[#1d1d1f]"
            title={composerWide ? "收窄助手栏" : "展开助手栏至半屏"}
            onClick={() => onComposerWideChange?.(!composerWide)}
          >
            {composerWide ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
            {composerWide ? "收窄" : "半屏展开"}
          </button>
        </div>
        <textarea
          className="mb-3 min-h-[4.5rem] w-full resize-y rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
          rows={3}
          placeholder="补充说明或让我修改某一步…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={inputDisabled}
          onFocus={() => onComposerWideChange?.(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <EcomButtonPrimary
          size="sm"
          type="button"
          className="w-full"
          disabled={inputDisabled || !input.trim()}
          onClick={() => void handleSend()}
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
