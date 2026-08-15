"use client";

import { Loader2, PanelRightClose, PanelRightOpen, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SeedVideoAssistantChoiceCards } from "@/components/seed-video/seed-video-assistant-choice-cards";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  streamSeedVideoChat,
  syncSeedVideoPlan,
  getSeedVideoProject,
  updateSeedVideoProject,
} from "@/lib/ecom-seed-video-api";
import { SEED_VIDEO_WELCOME_MESSAGE } from "@/lib/seed-video-mention-refs";
import type { SeedVideoChatMessage, SeedVideoProject } from "@/lib/seed-video-types";
import type { SeedVideoAssistantChoice } from "@/lib/seed-video-workflow";
import { commitFormalScriptFromRows } from "@/lib/seed-video-formal-script-commit";
import {
  buildUserMessageWithChoice,
  choicePromptBlock,
  buildChoiceSnapshotForSelection,
  buildFineModeStyleIntroContent,
  reconstructChoiceSnapshot,
  EDIT_STORYBOARD_CHOICE_MESSAGE,
  findDirectPlanMarkdownForSync,
  findPlanMarkdownForSync,
  hasSeedVideoShotsTableMarkdown,
  inferAssistantChoices,
  isDirectMode,
  isDirectPlanConfirmChoice,
  isDirectPlanRegenerateChoice,
  isFinalShotsConfirmChoice,
  isFinalShotsRegenerateChoice,
  isSeedVideoChoiceMessage,
  isSeedVideoProductionWorkspaceReady,
  mergeSeedVideoWorkflowFromUserChoice,
  normalizeSeedVideoChoiceInput,
  parseSeedVideoProductionModeFromChoice,
  parseSeedVideoScriptIdFromChoice,
  parseSeedVideoUserMessageDisplay,
  resolveAssistantChoiceUiState,
  STORYBOARD_REVIEW_CHOICE_MESSAGES,
  userPickedFineMode,
  userPickedStyle,
} from "@/lib/seed-video-workflow";
import {
  parseStoryboardExecutionTable,
  resolveChatFormalScriptMarkdown,
  resolveStoryboardDraftRows,
  serializeFormalScriptTable,
} from "@/lib/seed-video-storyboard-parse";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_CHOICE_SHELL_CLASS,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
} from "@/lib/ecom-assistant-chat-styles";
import { toSeedVideoAssistantChatContent } from "@/lib/seed-video-structured";
import { cn } from "@/lib/utils";

function renderChatMessageBody(
  msg: SeedVideoChatMessage,
  streaming: boolean,
  meta: SeedVideoProject["meta"],
) {
  if (msg.role === "assistant") {
    const raw = msg.content || (streaming ? "…" : "");
    const markdown = resolveChatFormalScriptMarkdown(
      toSeedVideoAssistantChatContent(raw, {
        streaming: streaming && msg.id === "streaming",
      }),
      meta,
    );
    return <StoryboardMarkdownBlock markdown={markdown || (streaming ? "…" : "")} />;
  }

  const display = parseSeedVideoUserMessageDisplay(msg.content);
  if (display.kind === "markdown") {
    const markdown = resolveChatFormalScriptMarkdown(display.markdown, meta);
    return (
      <div className="space-y-2">
        <StoryboardMarkdownBlock markdown={markdown} />
        {display.actionLine ? (
          <div className="flex justify-end pt-1">
            <span className="inline-block rounded-xl bg-[#0071e3] px-3 py-1.5 text-xs leading-relaxed text-white">
              {display.actionLine}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return <p className="whitespace-pre-wrap">{display.text}</p>;
}

function chatMessageBubbleClass(msg: SeedVideoChatMessage): string {
  if (msg.role === "assistant") return ECOM_ASSISTANT_BUBBLE_CLASS;
  const display = parseSeedVideoUserMessageDisplay(msg.content);
  if (display.kind === "markdown") return ECOM_ASSISTANT_BUBBLE_CLASS;
  return ECOM_ASSISTANT_USER_BUBBLE_CLASS;
}

function chatMessageAlignClass(msg: SeedVideoChatMessage): string {
  if (msg.role === "assistant") return "items-start";
  const display = parseSeedVideoUserMessageDisplay(msg.content);
  if (display.kind === "markdown") return "items-start";
  return "items-end";
}

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
  onEditStoryboard?: () => void | Promise<void>;
  onPlanSyncedToProduction?: (project?: SeedVideoProject) => void | Promise<void>;
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
  onEditStoryboard,
  onPlanSyncedToProduction,
}: Props) {
  const projectId = project.id;
  const chatHistory = project.chatHistory;
  const [messages, setMessages] = useState<SeedVideoChatMessage[]>(
    chatHistory.length ? chatHistory : [WELCOME],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const startPlanningTokenRef = useRef(startPlanningToken);

  const materials = project.references.filter((r) => r.role === "seed-material");

  useEffect(() => {
    setMessages(chatHistory.length ? chatHistory : [WELCOME]);
    setInput("");
    setStreamText("");
    setStreaming(false);
    setPendingChoice(null);
  }, [projectId]);

  useEffect(() => {
    if (streaming) return;
    setMessages((prev) => {
      const prevReal = prev.filter(
        (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
      );
      if (!chatHistory.length) {
        return prevReal.length > 0 ? prevReal : [WELCOME];
      }
      // 点选后本地 history 可能领先服务端 reload，避免被旧 chatHistory 覆盖导致「卡住」
      if (prevReal.length > chatHistory.length) return prev;
      return chatHistory;
    });
  }, [chatHistory, streaming, projectId]);

  useEffect(() => {
    onStreamingChange?.(streaming);
  }, [streaming, onStreamingChange]);

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
  const choiceBlock = choicePromptBlock(effectiveProject);
  const choiceUi = useMemo(
    () => resolveAssistantChoiceUiState(effectiveProject),
    [effectiveProject],
  );
  const showChoices = choiceUi.showLive && choices.length > 0 && !streaming;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    scrollToBottom(streaming ? "auto" : "smooth");
  }, [messages, streamText, streaming, showChoices, pendingChoice, scrollToBottom]);

  const runAssistant = useCallback(
    async (history: SeedVideoChatMessage[]) => {
      stickToBottomRef.current = true;
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

        const assistantMsg: SeedVideoChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: full.trim(),
          createdAt: new Date().toISOString(),
        };
        const completedHistory = [...history, assistantMsg];

        try {
          const updated = await getSeedVideoProject(projectId);
          setMessages(updated.chatHistory.length ? updated.chatHistory : completedHistory);
        } catch {
          setMessages(completedHistory);
        }

        try {
          const fresh = await getSeedVideoProject(projectId);
          const projectForGate: SeedVideoProject = {
            ...fresh,
            chatHistory: completedHistory,
          };

          const fineNeedsStyle =
            userPickedFineMode(projectForGate) && !userPickedStyle(projectForGate);
          const workspaceReady = isSeedVideoProductionWorkspaceReady(projectForGate);

          if (
            workspaceReady &&
            hasSeedVideoShotsTableMarkdown(full.trim()) &&
            !fineNeedsStyle &&
            !isDirectMode(fresh)
          ) {
            const rows = parseStoryboardExecutionTable(full);
            if (rows.length >= 2) {
              const canonical = serializeFormalScriptTable(rows);
              const prevWorkflow =
                (fresh.meta?.workflow as Record<string, unknown> | undefined) ?? {};
              await updateSeedVideoProject(projectId, {
                meta: {
                  ...(fresh.meta ?? {}),
                  storyboardDraft: rows,
                  lastAssistantRaw: canonical,
                  workflow: {
                    ...prevWorkflow,
                    phase: "shots",
                    planSynced: false,
                  },
                },
              });
            }
            await onProjectChange();
          }
        } catch (e) {
          await onAlert({
            title: "策划同步失败",
            message: e instanceof Error ? e.message : "中间工作区未能同步，请刷新后重试",
            variant: "error",
          });
        }
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
    [chatModelKey, onAlert, onProjectChange, project, projectId],
  );

  const handleDirectPlanSync = useCallback(
    async (choice: string, history: SeedVideoChatMessage[]) => {
      const planMarkdown = findDirectPlanMarkdownForSync({
        ...project,
        chatHistory: history.filter(
          (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
        ),
      });
      if (!planMarkdown) {
        await onAlert({
          title: "无法同步",
          message: "未找到直接连贯成片参数，请先让助手输出「请确认成片参数」后再确认。",
          variant: "error",
        });
        return;
      }
      try {
        const updated = await syncSeedVideoPlan(projectId, {
          markdown: planMarkdown,
          userChoice: choice,
          confirmSync: true,
        });
        setMessages(updated.chatHistory.length ? updated.chatHistory : history);
        if (onPlanSyncedToProduction) {
          await onPlanSyncedToProduction(updated);
        } else {
          await onProjectChange();
        }
      } catch (e) {
        await onAlert({
          title: "同步失败",
          message: e instanceof Error ? e.message : "未能解析成片参数，请让助手重新输出后再确认",
          variant: "error",
        });
      }
    },
    [onAlert, onPlanSyncedToProduction, onProjectChange, project, projectId],
  );

  const handleConfirmPlanSync = useCallback(
    async (choice: string, history: SeedVideoChatMessage[]) => {
      const planMarkdown = findPlanMarkdownForSync({
        ...project,
        chatHistory: history.filter(
          (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
        ),
      });
      if (!planMarkdown || !hasSeedVideoShotsTableMarkdown(planMarkdown)) {
        await onAlert({
          title: "无法同步",
          message: "未找到逐镜参数表，请先让助手输出「正式脚本」后再确认。",
          variant: "error",
        });
        return;
      }
      try {
        const updated = await syncSeedVideoPlan(projectId, {
          markdown: planMarkdown,
          userChoice: choice,
          confirmSync: true,
        });
        setMessages(updated.chatHistory.length ? updated.chatHistory : history);
        if (onPlanSyncedToProduction) {
          await onPlanSyncedToProduction(updated);
        } else {
          await onProjectChange();
        }
      } catch (e) {
        await onAlert({
          title: "同步失败",
          message: e instanceof Error ? e.message : "未能解析逐镜参数表，请让助手重新输出正式脚本后再确认",
          variant: "error",
        });
      }
    },
    [onAlert, onPlanSyncedToProduction, onProjectChange, project, projectId],
  );

  const handleChoice = useCallback(
    async (choice: string) => {
      if (streaming) return;
      if (choice === EDIT_STORYBOARD_CHOICE_MESSAGE) {
        await onEditStoryboard?.();
        return;
      }
      if (choice === STORYBOARD_REVIEW_CHOICE_MESSAGES[3]) {
        if (userPickedFineMode(project) && !userPickedStyle(project)) {
          await onAlert({
            title: "请先选择成片风格",
            message: "方案②须先完成 Step4 成片风格（A/B 方案）点选，再确认分镜执行表。",
            variant: "error",
          });
          return;
        }
        setPendingChoice(choice);
        try {
          const rows = resolveStoryboardDraftRows({
            ...project,
            chatHistory: messages.filter((m) => m.id !== "welcome"),
          });
          if (rows.length < 2) {
            await onAlert({
              title: "无法生成正式脚本",
              message: "未能解析分镜执行表，请点「重新生成」后再试。",
              variant: "error",
            });
            return;
          }
          const updated = await commitFormalScriptFromRows(project, rows);
          setMessages(updated.chatHistory.length ? updated.chatHistory : messages);
          await onProjectChange();
        } catch (e) {
          await onAlert({
            title: "同步失败",
            message: e instanceof Error ? e.message : "未能同步正式脚本，请稍后重试",
            variant: "error",
          });
        } finally {
          setPendingChoice(null);
        }
        return;
      }
      if (
        isFinalShotsConfirmChoice(choice) &&
        userPickedFineMode(project) &&
        !userPickedStyle(project)
      ) {
        await onAlert({
          title: "请先选择成片风格",
          message: "方案②须先完成 Step4 成片风格点选，再同步逐镜参数表。",
          variant: "error",
        });
        return;
      }
      setPendingChoice(choice);
      stickToBottomRef.current = true;
      const snapshot = buildChoiceSnapshotForSelection(effectiveProject, choice);
      const history = buildUserMessageWithChoice(
        messages.filter((m) => m.id !== "welcome"),
        choice,
        snapshot,
      );
      setMessages(history);
      try {
        if (isDirectPlanConfirmChoice(choice) && isDirectMode(project)) {
          await handleDirectPlanSync(choice, history);
          return;
        }
        if (isDirectPlanRegenerateChoice(choice)) {
          await updateSeedVideoProject(projectId, {
            chatHistory: history,
            meta: {
              ...(project.meta ?? {}),
              workflow: {
                ...(project.meta?.workflow ?? {}),
                planSynced: false,
                phase: "production",
              },
            },
          });
          await onProjectChange();
          await runAssistant(history);
          return;
        }
        if (isFinalShotsConfirmChoice(choice)) {
          await handleConfirmPlanSync(choice, history);
          return;
        }
        if (isFinalShotsRegenerateChoice(choice)) {
          await updateSeedVideoProject(projectId, {
            chatHistory: history,
            meta: {
              ...(project.meta ?? {}),
              workflow: {
                ...(project.meta?.workflow ?? {}),
                planSynced: false,
                phase: "shots",
              },
            },
          });
          await onProjectChange();
          await runAssistant(history);
          return;
        }

        const scriptId = parseSeedVideoScriptIdFromChoice(choice);
        const mode = parseSeedVideoProductionModeFromChoice(choice);
        const workflow = mergeSeedVideoWorkflowFromUserChoice(
          project.meta?.workflow,
          choice,
        );

        await updateSeedVideoProject(projectId, {
          chatHistory: history,
          meta: { ...(project.meta ?? {}), workflow },
        });

        // 脚本点选：本地推进到制作模式卡片，不调 LLM 重复出脚本
        if (scriptId && !mode) {
          await onProjectChange();
          return;
        }

        // 方案②：本地插入 Step4 引导 + A/B 成片风格卡片，不调 LLM（避免跳过分镜前风格步骤）
        if (mode === "fine") {
          const mergedProject: SeedVideoProject = {
            ...project,
            chatHistory: history.filter(
              (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
            ),
            meta: { ...(project.meta ?? {}), workflow },
          };
          const introMsg: SeedVideoChatMessage = {
            id: `assistant-style-intro-${Date.now()}`,
            role: "assistant",
            content: buildFineModeStyleIntroContent(mergedProject),
            createdAt: new Date().toISOString(),
          };
          const historyWithIntro = [...history, introMsg];
          setMessages(historyWithIntro);
          await updateSeedVideoProject(projectId, {
            chatHistory: historyWithIntro,
            meta: { ...(project.meta ?? {}), workflow },
          });
          await onProjectChange();
          return;
        }

        // 方案①：持久化后立刻调 LLM，reload 后台进行，避免长时间无反馈
        void onProjectChange();
        await runAssistant(history);
      } finally {
        setPendingChoice(null);
      }
    },
    [handleConfirmPlanSync, handleDirectPlanSync, effectiveProject, messages, onAlert, onEditStoryboard, onProjectChange, project, projectId, runAssistant, streaming],
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const raw = (text ?? input).trim();
      if (!raw || streaming) return;
      stickToBottomRef.current = true;

      if (parseSeedVideoUserMessageDisplay(raw).kind === "markdown") {
        const userMsg: SeedVideoChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: raw,
          createdAt: new Date().toISOString(),
        };
        const history = [...messages.filter((m) => m.id !== "welcome"), userMsg];
        setInput("");
        setMessages(history);
        await runAssistant(history);
        return;
      }

      const normalizedChoice = normalizeSeedVideoChoiceInput(raw, effectiveProject);
      if (normalizedChoice) {
        setInput("");
        await handleChoice(normalizedChoice);
        return;
      }

      const userMsg: SeedVideoChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: raw,
        createdAt: new Date().toISOString(),
        refIds: materials.map((r) => r.id),
      };
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg];
      setInput("");
      setMessages(history);
      await runAssistant(history);
    },
    [effectiveProject, handleChoice, input, materials, messages, runAssistant, streaming],
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

  const renderMessages: SeedVideoChatMessage[] = streaming
    ? [
        ...messages.filter((m) => m.id !== "streaming"),
        {
          id: "streaming",
          role: "assistant" as const,
          content: streamText,
          createdAt: new Date().toISOString(),
        },
      ]
    : messages;

  const historyForSnapshot = renderMessages.filter(
    (m) => m.id !== "welcome" && m.id !== "streaming" && !m.id.startsWith("err-"),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {renderMessages.map((msg) => {
            if (msg.role === "user" && isSeedVideoChoiceMessage(msg.content)) {
              const histIndex = historyForSnapshot.findIndex((m) => m.id === msg.id);
              const snapshot =
                msg.choiceSnapshot ??
                (histIndex >= 0
                  ? reconstructChoiceSnapshot(
                      historyForSnapshot,
                      histIndex,
                      effectiveProject,
                    )
                  : null);
              if (snapshot) {
                if (msg.id === choiceUi.suppressSnapshotMessageId) {
                  return null;
                }
                return (
                  <div key={msg.id} className="flex flex-col items-start">
                    <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
                      <SeedVideoAssistantChoiceCards
                        title={snapshot.title}
                        subtitle={snapshot.subtitle}
                        choices={snapshot.choices as SeedVideoAssistantChoice[]}
                        disabled
                        selectedMessage={snapshot.selectedMessage}
                      />
                    </div>
                  </div>
                );
              }
            }

            return (
              <div
                key={msg.id}
                className={cn("flex w-full flex-col", chatMessageAlignClass(msg))}
              >
                {msg.role === "user" &&
                parseSeedVideoUserMessageDisplay(msg.content).kind === "text"
                  ? refThumbsForMessage(msg)
                  : null}
                <div
                  className={cn(
                    ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
                    chatMessageBubbleClass(msg),
                  )}
                >
                  {renderChatMessageBody(
                    msg,
                    streaming && msg.id === "streaming",
                    project.meta,
                  )}
                </div>
              </div>
            );
          })}
          {showChoices ? (
            <div className="flex flex-col items-start">
              <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
                <SeedVideoAssistantChoiceCards
                  title={choiceBlock.title}
                  subtitle={choiceBlock.subtitle}
                  choices={choices}
                  disabled={streaming || pendingChoice != null}
                  selectedMessage={pendingChoice}
                  onSelect={(message) => void handleChoice(message)}
                />
              </div>
            </div>
          ) : null}
        </div>
        {streaming || pendingChoice ? (
          <StoryboardTaskStatus
            active
            title={streaming ? "思考中" : "处理中"}
            detail={
              streaming
                ? "助手正在输出策划内容，完成后可继续点选确认…"
                : "已收到您的点选，正在继续策划流程…"
            }
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
          placeholder={
            showChoices
              ? "也可输入补充说明；点选上方卡片可继续下一步…"
              : "补充说明或让我修改某一步…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
          onFocus={() => onComposerWideChange?.(true)}
          onKeyDown={(e) => {
            if (streaming) return;
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
          disabled={streaming || !input.trim()}
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
