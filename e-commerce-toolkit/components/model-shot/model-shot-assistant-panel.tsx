"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EcomAssistantCollapsibleLayout } from "@/components/layout/ecom-assistant-collapsible-layout";
import { EcomAssistantPanelHeader } from "@/components/layout/ecom-assistant-panel-header";
import { EcomAssistantSendButton } from "@/components/layout/ecom-assistant-send-button";
import { STORYBOARD_ASSISTANT_CHOICE_CLASS } from "@/components/storyboard/storyboard-assistant-choices";
import { StoryboardMarkdownBlock } from "@/components/storyboard/storyboard-markdown-block";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_CHOICE_SHELL_CLASS,
  ECOM_ASSISTANT_COMPOSER_SHELL_BASE,
  ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
} from "@/lib/ecom-assistant-chat-styles";
import {
  attachModelShotReference,
  generateModelShotPosePlan,
  streamModelShotChat,
  updateModelShotProject,
} from "@/lib/ecom-model-shot-api";
import type { ModelShotBrief, ModelShotChatMessage, ModelShotMeta, ModelShotProject } from "@/lib/model-shot-types";
import {
  MODEL_SHOT_MODEL_MODE_PREFIX,
  MODEL_SHOT_PROP_MODE_PREFIX,
  MODEL_SHOT_SCENE_MODE_PREFIX,
  parseModelArchetypeChoice,
} from "@/lib/model-shot-prompt-presets";
import {
  choicePrompt,
  inferAssistantChoices,
  inferModelShotPhase,
  metaAssistantReplyAfterChoice,
  modelArchetypeAssistantReply,
  modelModeAssistantReply,
  MODEL_SHOT_POSE_PLAN_READY_REPLY,
  MODEL_SHOT_SKIP_PROP_ASSISTANT_REPLY,
  MODEL_SHOT_SKIP_SCENE_ASSISTANT_REPLY,
  parseMetaCountChoice,
  parseMetaStyleChoice,
  parseMetaUsageChoice,
  parsePropChoiceLabel,
  parseSceneChoiceLabel,
  posePlanGenerateChoiceLabel,
  propPickAssistantReply,
  resolveModelShotWelcomeMessage,
  scenePickAssistantReply,
  MODEL_SHOT_META_COUNT_REPLY,
} from "@/lib/model-shot-workflow";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { hasGarmentReference, type ModelShotReferenceRole } from "@/lib/model-shot-types";
import { cn } from "@/lib/utils";

const WELCOME_ID = "welcome";

const REF_GEN_ROLE_LABEL: Record<Exclude<ModelShotReferenceRole, "garment">, string> = {
  model: "模特图",
  scene: "场景图",
  prop: "道具图",
};

type Props = {
  project: ModelShotProject;
  chatModels: StoryboardGatewayModel[];
  chatModelKey: string;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  onStreamingChange?: (streaming: boolean) => void;
  onProjectChange: () => void | Promise<void>;
  onRequestGeneratePoses?: () => void | Promise<void>;
  refGenBusyRole?: ModelShotReferenceRole | null;
  onAlert: (opts: { title: string; message: string; variant?: "error" }) => Promise<void>;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function ModelShotAssistantPanel({
  project,
  chatModels,
  chatModelKey,
  composerWide,
  onComposerWideChange,
  onStreamingChange,
  onProjectChange,
  onRequestGeneratePoses,
  refGenBusyRole = null,
  onAlert,
  collapsed = false,
  onCollapsedChange,
}: Props) {
  const chatHistory = project.chatHistory;
  const projectId = project.id;
  const phase = inferModelShotPhase(project);
  const welcomeMessage = useMemo<ModelShotChatMessage>(
    () => ({
      id: WELCOME_ID,
      role: "assistant",
      content: resolveModelShotWelcomeMessage(project),
      createdAt: new Date().toISOString(),
    }),
    [project],
  );
  const [messages, setMessages] = useState<ModelShotChatMessage[]>(
    chatHistory.length ? chatHistory : [welcomeMessage],
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    if (streaming) return;
    if (chatHistory.length) {
      setMessages(chatHistory);
      return;
    }
    setMessages([welcomeMessage]);
  }, [chatHistory, streaming, welcomeMessage]);

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

  const sendText = useCallback(
    async (text: string, historyBase?: ModelShotChatMessage[]) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      if (!hasGarmentReference(project.references)) {
        await onAlert({
          title: "请先上传服装",
          message: "服装参考图为必填项，请在中栏上传后再与助手对话。",
          variant: "error",
        });
        return;
      }

      const prior = historyBase ?? messages;
      const base: ModelShotChatMessage[] = [
        ...prior.filter((m) => m.id !== WELCOME_ID && !m.id.startsWith("err-")),
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
        await streamModelShotChat({
          projectId,
          messages: base,
          modelKey: chatModelKey,
          onChunk: (chunk) => setStreamText((prev) => prev + chunk),
        });
        setStreamText("");
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
    [chatModelKey, messages, onAlert, onProjectChange, project.references, projectId, streaming],
  );

  const recordLocalSkipTurn = useCallback(
    async (opts: {
      userText: string;
      assistantText: string;
      attach: () => Promise<void>;
    }) => {
      const now = new Date().toISOString();
      const base = messages.filter((m) => m.id !== WELCOME_ID && !m.id.startsWith("err-"));
      const nextMessages: ModelShotChatMessage[] = [
        ...base,
        { id: `user-${Date.now()}`, role: "user", content: opts.userText, createdAt: now },
        {
          id: `assistant-${Date.now() + 1}`,
          role: "assistant",
          content: opts.assistantText,
          createdAt: now,
        },
      ];
      setMessages(nextMessages);
      stickToBottomRef.current = true;
      try {
        await opts.attach();
        await updateModelShotProject(projectId, { chatHistory: nextMessages });
        await onProjectChange();
      } catch (e) {
        await onAlert({
          title: "操作失败",
          message: e instanceof Error ? e.message : "无法更新项目",
          variant: "error",
        });
      }
    },
    [messages, onAlert, onProjectChange, projectId],
  );

  const recordLocalTurn = useCallback(
    async (opts: {
      userText: string;
      assistantText: string;
      brief?: Partial<ModelShotBrief>;
      meta?: Partial<ModelShotMeta>;
      beforeSave?: () => Promise<void>;
    }) => {
      const now = new Date().toISOString();
      const base = messages.filter((m) => m.id !== WELCOME_ID && !m.id.startsWith("err-"));
      const nextMessages: ModelShotChatMessage[] = [
        ...base,
        { id: `user-${Date.now()}`, role: "user", content: opts.userText, createdAt: now },
        {
          id: `assistant-${Date.now() + 1}`,
          role: "assistant",
          content: opts.assistantText,
          createdAt: now,
        },
      ];
      setMessages(nextMessages);
      stickToBottomRef.current = true;
      try {
        if (opts.beforeSave) await opts.beforeSave();
        const nextMeta: ModelShotMeta = {
          ...(project.meta ?? {}),
          ...(opts.meta ?? {}),
          wizard: {
            ...(project.meta?.wizard ?? {}),
            ...(opts.meta?.wizard ?? {}),
          },
        };
        await updateModelShotProject(projectId, {
          chatHistory: nextMessages,
          ...(opts.brief ? { brief: { ...(project.brief ?? {}), ...opts.brief } } : {}),
          ...(opts.meta ? { meta: nextMeta } : {}),
        });
        await onProjectChange();
      } catch (e) {
        await onAlert({
          title: "操作失败",
          message: e instanceof Error ? e.message : "无法更新项目",
          variant: "error",
        });
      }
    },
    [messages, onAlert, onProjectChange, project.brief, project.meta, projectId],
  );

  const handleChoice = useCallback(
    async (choice: string) => {
      const poseGenLabel = posePlanGenerateChoiceLabel(project.brief?.poseCount ?? 6);
      if (
        choice === "生成姿势方案" ||
        choice === "重新生成姿势方案" ||
        choice === poseGenLabel
      ) {
        try {
          await generateModelShotPosePlan(projectId);
          const now = new Date().toISOString();
          const base = messages.filter((m) => m.id !== WELCOME_ID && !m.id.startsWith("err-"));
          const nextMessages: ModelShotChatMessage[] = [
            ...base,
            { id: `user-${Date.now()}`, role: "user", content: choice, createdAt: now },
            {
              id: `assistant-${Date.now() + 1}`,
              role: "assistant",
              content: MODEL_SHOT_POSE_PLAN_READY_REPLY,
              createdAt: now,
            },
          ];
          setMessages(nextMessages);
          await updateModelShotProject(projectId, {
            chatHistory: nextMessages,
            meta: {
              ...(project.meta ?? {}),
              wizard: { ...(project.meta?.wizard ?? {}), summaryAcknowledged: true },
            },
          });
          await onProjectChange();
        } catch (e) {
          await onAlert({
            title: "生成失败",
            message: e instanceof Error ? e.message : "无法生成姿势方案",
            variant: "error",
          });
        }
        return;
      }

      if (choice === "确认姿势计划") {
        await recordLocalTurn({
          userText: choice,
          assistantText:
            "请在左侧中栏点击「确认计划」，然后在下方 **模特图** 卡片逐张或勾选生成。",
        });
        return;
      }

      if (
        choice === "微调某条 Prompt" ||
        choice.startsWith("微调·") ||
        choice.startsWith("微调 ")
      ) {
        await recordLocalTurn({
          userText: choice,
          assistantText:
            "Prompt 请直接在中栏 **姿势脚本** 表点击铅笔编辑（姿势 / 场景 / 道具分列），无需在助手内微调。",
        });
        return;
      }

      if (choice === "重新出图") {
        await recordLocalTurn({
          userText: choice,
          assistantText:
            "请在中栏 **模特图** 区域点击对应姿势卡片「待生成」，或勾选多张后点「生成模特图」。",
        });
        return;
      }

      if (choice === "查看中栏姿势方案") {
        await recordLocalTurn({
          userText: choice,
          assistantText: "请在中栏姿势计划表核对每条 Prompt，满意后点击「确认计划」。",
        });
        return;
      }

      const scenePreset = parseSceneChoiceLabel(choice);
      if (scenePreset) {
        await recordLocalTurn({
          userText: choice,
          assistantText: scenePickAssistantReply(scenePreset.name),
          meta: { wizard: { scenePick: false } },
          beforeSave: () =>
            attachModelShotReference(projectId, {
              reference: {
                id: `scene-text-${scenePreset.id}`,
                role: "scene",
                source: "library",
                catalogId: scenePreset.id,
                name: scenePreset.name,
                description: scenePreset.visualPrompt,
              },
            }).then(() => undefined),
        });
        return;
      }

      const propPreset = parsePropChoiceLabel(choice);
      if (propPreset) {
        await recordLocalTurn({
          userText: choice,
          assistantText: propPickAssistantReply(propPreset.name),
          meta: { wizard: { propPick: false } },
          beforeSave: () =>
            attachModelShotReference(projectId, {
              reference: {
                id: `prop-text-${propPreset.id}`,
                role: "prop",
                source: "library",
                catalogId: propPreset.id,
                name: propPreset.name,
                description: propPreset.visualDescription,
              },
            }).then(() => undefined),
        });
        return;
      }

      const modelArchetype = parseModelArchetypeChoice(choice);
      if (modelArchetype) {
        await recordLocalTurn({
          userText: choice,
          assistantText: modelArchetypeAssistantReply(modelArchetype),
          meta: { wizard: { modelPick: false } },
          beforeSave: () =>
            attachModelShotReference(projectId, {
              reference: {
                id: `model-text-${modelArchetype.id}`,
                role: "model",
                source: "text",
                name: modelArchetype.label,
                description: modelArchetype.description,
              },
            }).then(() => undefined),
        });
        return;
      }

      const modeReply = modelModeAssistantReply(choice, projectId);
      if (modeReply) {
        if (choice === `${MODEL_SHOT_MODEL_MODE_PREFIX}AI推荐虚拟模特`) {
          await recordLocalTurn({
            userText: choice,
            assistantText: modeReply,
            meta: { wizard: { modelPick: true } },
          });
          return;
        }
        if (choice === `${MODEL_SHOT_SCENE_MODE_PREFIX}词库推荐`) {
          await recordLocalTurn({
            userText: choice,
            assistantText: modeReply,
            meta: { wizard: { scenePick: true } },
          });
          return;
        }
        if (choice === `${MODEL_SHOT_PROP_MODE_PREFIX}词库推荐`) {
          await recordLocalTurn({
            userText: choice,
            assistantText: modeReply,
            meta: { wizard: { propPick: true } },
          });
          return;
        }
        if (choice === `${MODEL_SHOT_SCENE_MODE_PREFIX}跳过场景`) {
          await recordLocalSkipTurn({
            userText: choice,
            assistantText: modeReply,
            attach: () =>
              attachModelShotReference(projectId, {
                reference: {
                  id: `scene-skip-${Date.now()}`,
                  role: "scene",
                  source: "none",
                  name: "跳过场景",
                },
              }).then(() => undefined),
          });
          return;
        }
        if (choice === `${MODEL_SHOT_PROP_MODE_PREFIX}不需要道具`) {
          await recordLocalSkipTurn({
            userText: choice,
            assistantText: modeReply,
            attach: () =>
              attachModelShotReference(projectId, {
                reference: {
                  id: `prop-skip-${Date.now()}`,
                  role: "prop",
                  source: "none",
                  name: "不需要道具",
                },
              }).then(() => undefined),
          });
          return;
        }
        await recordLocalTurn({ userText: choice, assistantText: modeReply });
        return;
      }

      const stylePatch = parseMetaStyleChoice(choice);
      if (stylePatch) {
        await recordLocalTurn({
          userText: choice,
          assistantText: metaAssistantReplyAfterChoice(choice) ?? "",
          brief: stylePatch,
        });
        return;
      }

      const usagePatch = parseMetaUsageChoice(choice);
      if (usagePatch) {
        await recordLocalTurn({
          userText: choice,
          assistantText: metaAssistantReplyAfterChoice(choice) ?? "",
          brief: usagePatch,
        });
        return;
      }

      const countPatch = parseMetaCountChoice(choice);
      if (countPatch) {
        const brief = { ...(project.brief ?? {}), ...countPatch };
        await recordLocalTurn({
          userText: choice,
          assistantText: MODEL_SHOT_META_COUNT_REPLY({ ...project, brief }),
          brief: countPatch,
        });
        return;
      }

      await sendText(choicePrompt(choice));
    },
    [
      messages,
      onAlert,
      onProjectChange,
      onRequestGeneratePoses,
      project,
      projectId,
      recordLocalSkipTurn,
      recordLocalTurn,
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

  const choices = useMemo(() => inferAssistantChoices(project), [project]);
  const showChoices = !streaming && choices.length > 0;
  const modelName =
    chatModels.find((m) => m.modelKey === chatModelKey)?.displayName ?? "助手模型";

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
            hasGarmentReference(project.references)
              ? phase === "model"
                ? "描述模特偏好，或点上方快捷选项…"
                : "补充平台、风格或姿势偏好…"
              : "请先在中栏上传服装参考图…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming || !hasGarmentReference(project.references)}
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
          disabled={streaming || !hasGarmentReference(project.references) || !input.trim()}
          busy={streaming}
          onClick={() => void sendText(input)}
        />
      </div>
    </div>
  );

  return (
    <EcomAssistantCollapsibleLayout
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      collapseBlocked={streaming}
      attentionBadge={showChoices}
      composer={renderComposer(false)}
      floatingComposer={renderComposer(true)}
    >
      <EcomAssistantPanelHeader
        title="服装模特图助手"
        subtitle={`${phase} · ${modelName}`}
        composerWide={composerWide}
        onComposerWideChange={onComposerWideChange}
        onCollapse={onCollapsedChange ? tryCollapse : undefined}
        collapseDisabled={streaming}
      />

      <div
        ref={scrollRef}
        className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        <div className="space-y-3">
          {displayMessages.map((m) => (
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
                  <StoryboardMarkdownBlock markdown={m.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          {showChoices ? (
            <div className="flex flex-col items-start">
              <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
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
            </div>
          ) : null}
        </div>
        {streaming ? (
          <StoryboardTaskStatus
            active
            title="思考中"
            detail="助手正在采集需求，完成后请在中栏确认姿势方案…"
            className="mt-3"
          />
        ) : null}
        {!streaming && refGenBusyRole && refGenBusyRole !== "garment" ? (
          <StoryboardTaskStatus
            active
            sweep
            title={`${REF_GEN_ROLE_LABEL[refGenBusyRole]} AI 生成中`}
            detail="Gateway 图像任务进行中，完成后写入中栏对应素材槽位。"
            className="mt-3"
          />
        ) : null}
      </div>
    </EcomAssistantCollapsibleLayout>
  );
}
