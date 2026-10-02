"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomAssistantCollapsibleLayout } from "@/components/layout/ecom-assistant-collapsible-layout";
import { EcomAssistantPanelHeader } from "@/components/layout/ecom-assistant-panel-header";
import { EcomAssistantSendButton } from "@/components/layout/ecom-assistant-send-button";
import { SeedVideoAssistantChoiceCards } from "@/components/seed-video/seed-video-assistant-choice-cards";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_CHOICE_SHELL_CLASS,
  ECOM_ASSISTANT_COMPOSER_SHELL_BASE,
  ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
} from "@/lib/ecom-assistant-chat-styles";
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
  buildHandCraftHistoricalChoiceBlock,
  buildHandCraftStepChoices,
  buildHandCraftStyleChoices,
  currentHandCraftStyleMessage,
  isHandCraftStyleChoice,
  resolveHandCraftStylePatchFromChoice,
  shouldHideLiveHandCraftStepChoices,
} from "@/lib/hand-craft-assistant-choice-ui";
import {
  handCraftStep,
  HAND_CRAFT_POST_HERO_GUIDE_MESSAGE,
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
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 中间栏出图 / 线稿 / 拼版进行中时隐藏分步确认卡片 */
  workspaceBusy?: boolean;
};

/**
 * 手办创作助手：按 doc/手办/skill.md 的 10 步 SOP 逐步推进。
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
  collapsed = false,
  onCollapsedChange,
  workspaceBusy = false,
}: Props) {
  const chatHistory = project.chatHistory;
  const projectId = project.id;
  const [messages, setMessages] = useState<HandCraftChatMessage[]>(
    chatHistory.length ? chatHistory : [WELCOME],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [choicePending, setChoicePending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const choiceBusyRef = useRef(false);
  const messageCountRef = useRef(0);

  useEffect(() => {
    if (streaming) return;
    const next = chatHistory.length ? chatHistory : [WELCOME];
    setMessages((prev) => {
      if (
        prev.length === next.length &&
        prev.every(
          (m, i) => m.id === next[i]?.id && m.content === next[i]?.content,
        )
      ) {
        return prev;
      }
      return next;
    });
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
    const count = messages.length + (streaming ? 1 : 0);
    const grew = count > messageCountRef.current;
    messageCountRef.current = count;
    if (!grew && !streaming) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: streaming || grew ? "auto" : "smooth",
    });
  }, [messages, streamText, streaming]);

  const sketchCount = project.references.length;
  const heroGuideMode = Boolean(project.meta?.workflow?.heroLockedUrl?.trim());

  const sendText = useCallback(
    async (text: string, historyBase?: HandCraftChatMessage[]) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      if (
        project.settings?.stylePresetId === "custom" &&
        !isHandCraftStyleChoice(trimmed)
      ) {
        await updateHandCraftProject(projectId, {
          settings: { styleCustomText: trimmed },
        });
        await onProjectChange();
      }
      if (sketchCount === 0) {
        await onAlert({
          title: "请先上传线稿",
          message: "手办创作以你的手绘线稿为唯一原型，请先在中间工作区上传线稿。",
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
      let next: HandCraftChatMessage[] = [];
      setMessages((prev) => {
        const base = prev.filter((m) => m.id !== "welcome" && !m.id.startsWith("err-"));
        const prevUser = base.at(-2);
        const prevAsst = base.at(-1);
        if (
          prevUser?.role === "user" &&
          prevAsst?.role === "assistant" &&
          prevUser.content.trim() === userText.trim() &&
          prevAsst.content.trim() === assistantText.trim()
        ) {
          next = base;
          return base;
        }
        next = [
          ...base,
          { id: `user-${ts}`, role: "user", content: userText, createdAt: now },
          {
            id: `assistant-${ts + 1}`,
            role: "assistant",
            content: assistantText,
            createdAt: now,
          },
        ];
        return next;
      });
      await updateHandCraftProject(projectId, { chatHistory: next });
      void onProjectChange();
    },
    [onProjectChange, projectId],
  );

  const applyStyleChoice = useCallback(
    async (choice: string) => {
      const patch = resolveHandCraftStylePatchFromChoice(choice);
      if (!patch) return false;
      await updateHandCraftProject(projectId, { settings: patch });
      void onProjectChange();
      if (patch.stylePresetId === "custom") {
        await appendLocalTurn(
          choice,
          "已选自定义风格。请在下方输入框发送一段画风描述（例如：红白主色、哑光树脂、软萌比例），我会写入项目设置。",
        );
      } else {
        await appendLocalTurn(
          choice,
          `视觉风格已设为「${choice.replace(/^风格·/, "")}」。更换风格会清空已定稿主形象与后续产出。`,
        );
      }
      return true;
    },
    [appendLocalTurn, onProjectChange, projectId],
  );

  const handleChoice = useCallback(
    async (choice: string) => {
      if (heroGuideMode) return;
      if (choiceBusyRef.current || choicePending || streaming) return;
      choiceBusyRef.current = true;
      setChoicePending(true);
      try {
      if (isHandCraftStyleChoice(choice)) {
        await applyStyleChoice(choice);
        return;
      }
      const target = stepIdFromChoice(choice) ?? currentStepId;
      const meta = handCraftStep(target);

      if (choice.startsWith("确认生成") || choice.startsWith("确认拼版")) {
        const blocked = missingRequirements(project, target);
        if (blocked.length > 0) {
          await onAlert({
            title: meta.kind === "compose" ? "还不能拼版" : "还不能生成",
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
      } finally {
        choiceBusyRef.current = false;
        setChoicePending(false);
        onCollapsedChange?.(false);
      }
    },
    [
      applyStyleChoice,
      appendLocalTurn,
      choicePending,
      currentStepId,
      heroGuideMode,
      onAlert,
      onCollapsedChange,
      onCurrentStepChange,
      onRequestGenerateStep,
      project,
      sendText,
      streaming,
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

  const stepChoices = useMemo(
    () => buildHandCraftStepChoices(project, currentStepId),
    [project, currentStepId],
  );
  const styleChoices = useMemo(() => buildHandCraftStyleChoices(), []);
  const hideLiveStepChoices = useMemo(
    () => shouldHideLiveHandCraftStepChoices(project, messages, currentStepId),
    [project, messages, currentStepId],
  );
  const showStepChoices =
    !heroGuideMode &&
    !streaming &&
    !workspaceBusy &&
    sketchCount > 0 &&
    stepChoices.length > 0 &&
    !hideLiveStepChoices;
  const showStyleChoices =
    !heroGuideMode && !streaming && !workspaceBusy && sketchCount > 0;
  const choiceCardsDisabled = streaming || choicePending;
  const modelName =
    chatModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? "助手模型";
  const stepMeta = handCraftStep(currentStepId);

  const tryCollapse = useCallback(() => {
    if (streaming) return;
    onCollapsedChange?.(true);
  }, [streaming, onCollapsedChange]);

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
          className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
          rows={compact ? 1 : composerWide ? 4 : 2}
          placeholder={
            heroGuideMode
              ? "可咨询步骤说明或 Prompt，出图请在中栏勾选槽位生成…"
              : sketchCount === 0
                ? "请先在中间工作区上传手绘线稿…"
                : "补充说明，例如「盲盒主题换成节日系列」…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming || sketchCount === 0}
          onFocus={() => {
            if (compact) tryExpand();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendText(input);
            }
          }}
        />
        <EcomAssistantSendButton
          disabled={streaming || sketchCount === 0 || !input.trim()}
          busy={streaming}
          onClick={() => void sendText(input)}
        />
      </div>
      {!compact ? (
        <div className="mt-2">
          <EcomButtonSecondary
            size="sm"
            type="button"
            className="w-full"
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
      ) : null}
    </div>
  );

  return (
    <EcomAssistantCollapsibleLayout
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      collapseBlocked={streaming || choicePending}
      collapseOnBlur={false}
      attentionBadge={showStepChoices || showStyleChoices}
      composer={renderComposer(false)}
      floatingComposer={renderComposer(true)}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <EcomAssistantPanelHeader
          title="手办创作助手"
          subtitle={`第 ${stepMeta.no}/10 步 · ${stepMeta.label} · ${modelName}`}
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
          {displayMessages.map((m, idx) => {
            const historical =
              m.role === "user"
                ? buildHandCraftHistoricalChoiceBlock(project, m.content, idx)
                : null;
            const suppressHistoricalCard = Boolean(
              historical &&
                ((showStyleChoices && historical.title === "视觉风格") ||
                  (showStepChoices && historical.title.includes("步操作"))),
            );
            const showBubble = m.role === "assistant" || !historical;
            return (
              <div key={m.id} className="flex w-full flex-col gap-2">
                {showBubble ? (
                  <div
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
                        <StoryboardMarkdownBlock
                          markdown={m.content || (streaming && m.id === "streaming" ? "…" : "")}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                ) : null}
                {historical && !suppressHistoricalCard ? (
                  <div
                    className="flex w-full flex-col items-start"
                    data-ecom-no-assistant-collapse
                  >
                    <div className={cn(ECOM_ASSISTANT_CHOICE_SHELL_CLASS, "w-full max-w-[95%]")}>
                      <SeedVideoAssistantChoiceCards
                        title={historical.title}
                        subtitle="本次点选记录（只读）"
                        choices={historical.cards}
                        selectedMessage={historical.selectedMessage}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {showStyleChoices ? (
            <div className="flex flex-col items-start" data-ecom-no-assistant-collapse>
              <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
                <SeedVideoAssistantChoiceCards
                  title="视觉风格"
                  subtitle="选定后应用于全流程 Prompt；更换会重置已定稿产出"
                  choices={styleChoices}
                  disabled={choiceCardsDisabled}
                  selectedMessage={currentHandCraftStyleMessage(project)}
                  onSelect={(message) => void handleChoice(message)}
                />
              </div>
            </div>
          ) : null}
          {showStepChoices ? (
            <div className="flex flex-col items-start" data-ecom-no-assistant-collapse>
              <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
                <SeedVideoAssistantChoiceCards
                  title={`第 ${stepMeta.no} 步 · ${stepMeta.label}`}
                  subtitle="请选择下一步操作"
                  choices={stepChoices}
                  disabled={choiceCardsDisabled}
                  onSelect={(message) => void handleChoice(message)}
                />
                {isStepReady(project, currentStepId) ? (
                  <p className="mt-2 text-[11px] text-[#6e6e73]">
                    第 {stepMeta.no} 步已出齐，可直接进入下一步。
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          {heroGuideMode ? (
            <div className="mt-3 rounded-xl border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-3">
              <StoryboardMarkdownBlock markdown={HAND_CRAFT_POST_HERO_GUIDE_MESSAGE} />
            </div>
          ) : workspaceBusy && !streaming ? (
            <p className="mt-3 text-[11px] leading-relaxed text-[#6e6e73]">
              中间工作区正在出图或拼版；进度见右下角任务窗。
            </p>
          ) : null}
        </div>
        {streaming ? (
          <StoryboardTaskStatus
            active
            title="思考中"
            detail="助手正在按 SOP 输出本步说明，完成后会同步到中间工作区…"
            className="mt-3"
          />
        ) : null}
        </div>
      </div>
    </EcomAssistantCollapsibleLayout>
  );
}
