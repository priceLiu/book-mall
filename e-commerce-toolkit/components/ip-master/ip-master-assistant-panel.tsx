"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomAssistantCollapsibleLayout } from "@/components/layout/ecom-assistant-collapsible-layout";
import { EcomAssistantPanelHeader } from "@/components/layout/ecom-assistant-panel-header";
import { EcomAssistantSendButton } from "@/components/layout/ecom-assistant-send-button";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_COMPOSER_SHELL_BASE,
  ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
} from "@/lib/ecom-assistant-chat-styles";
import { streamIpMasterChat, updateIpMasterProject } from "@/lib/ecom-ip-master-api";
import type { IpMasterChatMessage, IpMasterProject } from "@/lib/ip-master-types";
import { IP_MASTER_WELCOME } from "@/lib/ip-master-workflow";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

const WELCOME: IpMasterChatMessage = {
  id: "welcome",
  role: "assistant",
  content: IP_MASTER_WELCOME,
  createdAt: new Date().toISOString(),
};

type Props = {
  project: IpMasterProject;
  chatModels: StoryboardGatewayModel[];
  chatModelKey: string;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  onStreamingChange?: (streaming: boolean) => void;
  onProjectChange: () => void | Promise<void>;
  onAssistantMarkdown?: (markdown: string) => void;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  injectUserMessage?: { text: string; token: number } | null;
};

export function IpMasterAssistantPanel({
  project,
  chatModels,
  chatModelKey,
  composerWide,
  onComposerWideChange,
  onStreamingChange,
  onProjectChange,
  onAssistantMarkdown,
  onAlert,
  collapsed = false,
  onCollapsedChange,
  injectUserMessage = null,
}: Props) {
  const projectId = project.id;
  const history =
    project.chatHistory?.length > 0 ? project.chatHistory : [WELCOME];
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const injectHandled = useRef(0);

  const modelName =
    chatModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? chatModelKey;

  const displayMessages = useMemo(() => {
    if (!streaming) return history;
    return [
      ...history,
      {
        id: "streaming",
        role: "assistant" as const,
        content: streamText || "…",
        createdAt: new Date().toISOString(),
      },
    ];
  }, [history, streaming, streamText]);

  useEffect(() => {
    onStreamingChange?.(streaming);
  }, [streaming, onStreamingChange]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMessages.length, streamText]);

  const tryCollapse = useCallback(() => {
    if (streaming) return;
    onCollapsedChange?.(true);
  }, [streaming, onCollapsedChange]);

  const tryExpand = useCallback(() => {
    onCollapsedChange?.(false);
  }, [onCollapsedChange]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      const userMsg: IpMasterChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const base = history.filter((m) => m.id !== "welcome" || history.length > 1);
      const nextHistory = [...base, userMsg];
      setDraft("");
      setStreaming(true);
      setStreamText("");
      try {
        await updateIpMasterProject(projectId, { chatHistory: nextHistory });
        const full = await streamIpMasterChat({
          projectId,
          messages: nextHistory,
          modelKey: chatModelKey,
          onChunk: (piece) => setStreamText((prev) => prev + piece),
        });
        const assistantMsg: IpMasterChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: full,
          createdAt: new Date().toISOString(),
        };
        await updateIpMasterProject(projectId, {
          chatHistory: [...nextHistory, assistantMsg],
          meta: {
            ...(project.meta ?? {}),
            workflow: {
              ...(project.meta?.workflow ?? {}),
              draftMarkdown: full,
            },
          },
        });
        onAssistantMarkdown?.(full);
        await onProjectChange();
      } catch (e) {
        await onAlert({
          title: "助手失败",
          message: e instanceof Error ? e.message : "无法完成对话",
          variant: "error",
        });
      } finally {
        setStreaming(false);
        setStreamText("");
      }
    },
    [
      streaming,
      history,
      projectId,
      chatModelKey,
      project.meta,
      onAssistantMarkdown,
      onProjectChange,
      onAlert,
    ],
  );

  useEffect(() => {
    if (!injectUserMessage || injectUserMessage.token === injectHandled.current) return;
    injectHandled.current = injectUserMessage.token;
    void sendMessage(injectUserMessage.text);
  }, [injectUserMessage, sendMessage]);

  const renderComposer = (compact: boolean) => (
    <div
      className={cn(
        ECOM_ASSISTANT_COMPOSER_SHELL_BASE,
        !compact && ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER,
      )}
    >
      <div className="flex items-end gap-2">
        <textarea
          className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
          rows={compact ? 1 : composerWide ? 4 : 2}
          placeholder="请助手按 Skill 解析模板或补充 IP 设定…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={streaming}
          onFocus={() => {
            if (compact) tryExpand();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage(draft);
            }
          }}
        />
        <EcomAssistantSendButton
          disabled={streaming || !draft.trim()}
          busy={streaming}
          onClick={() => void sendMessage(draft)}
        />
      </div>
    </div>
  );

  return (
    <EcomAssistantCollapsibleLayout
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      collapseBlocked={streaming}
      collapseOnBlur={false}
      composer={renderComposer(false)}
      floatingComposer={renderComposer(true)}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <EcomAssistantPanelHeader
          title="IP 母版助手"
          subtitle={modelName}
          composerWide={composerWide}
          onComposerWideChange={onComposerWideChange}
          onCollapse={onCollapsedChange ? tryCollapse : undefined}
          collapseDisabled={streaming}
        />
        <div
          ref={scrollRef}
          className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3"
        >
          <div className="space-y-3 pb-6">
            {displayMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex w-full flex-col",
                  msg.role === "user" ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
                    msg.role === "user"
                      ? ECOM_ASSISTANT_USER_BUBBLE_CLASS
                      : ECOM_ASSISTANT_BUBBLE_CLASS,
                  )}
                >
                  {msg.role === "assistant" ? (
                    <StoryboardMarkdownBlock markdown={msg.content || "…"} />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {streaming ? (
            <StoryboardTaskStatus
              active
              title="解析中"
              detail="助手正在输出 Markdown 模板…"
              className="mt-3"
            />
          ) : null}
        </div>
      </div>
    </EcomAssistantCollapsibleLayout>
  );
}
