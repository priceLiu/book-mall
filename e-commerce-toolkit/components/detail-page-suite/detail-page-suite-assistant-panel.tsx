"use client";

import { Settings2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { EcomAssistantCollapsibleLayout } from "@/components/layout/ecom-assistant-collapsible-layout";
import { EcomAssistantComposerDock } from "@/components/layout/ecom-assistant-composer-dock";
import {
  EcomAssistantIconButton,
  ECOM_ASSISTANT_CONTROL_ICON_CLASS,
} from "@/components/layout/ecom-assistant-icon-button";
import { EcomAssistantPanelHeader } from "@/components/layout/ecom-assistant-panel-header";
import { EcomAssistantSendButton } from "@/components/layout/ecom-assistant-send-button";
import { SeedVideoAssistantChoiceCards } from "@/components/seed-video/seed-video-assistant-choice-cards";
import { StoryboardTaskStatus } from "@/components/storyboard/storyboard-task-status";
import {
  ECOM_ASSISTANT_BUBBLE_CLASS,
  ECOM_ASSISTANT_CHOICE_SHELL_CLASS,
  ECOM_ASSISTANT_COMPOSER_SHELL_BASE,
  ECOM_ASSISTANT_COMPOSER_SHELL_COMPACT,
  ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER,
  ECOM_ASSISTANT_MESSAGE_BUBBLE_BASE,
  ECOM_ASSISTANT_USER_BUBBLE_CLASS,
} from "@/lib/ecom-assistant-chat-styles";
import {
  buildSuiteDimensionMessageLabels,
  buildSuiteHistoricalChoiceBlock,
  resolveSuiteAssistantSelectedMessage,
  resolveSuiteLiveChoiceStep,
  resolveSuiteWorkspaceGuide,
} from "@/lib/detail-page-suite-assistant-choice-ui";
import type { DetailPageSuiteBusyStatus } from "@/lib/detail-page-suite-busy-status";
import {
  FASHION_DIMENSION_STEPS,
  fashionDimensionPrompt,
} from "@/lib/fashion-dimensions";
import {
  SUITE_RAIL_STEPS,
  type DetailPageSuitePhase,
  type DetailPageSuiteProject,
  type DetailPageSuiteTemplate,
} from "@/lib/detail-page-suite-types";
import { cn } from "@/lib/utils";

type Props = {
  project: DetailPageSuiteProject;
  templates: DetailPageSuiteTemplate[];
  busy?: boolean;
  busyStatus?: DetailPageSuiteBusyStatus | null;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  onChoice: (message: string) => void;
  /** 故事版同款 · composer 内「参数」钮 */
  onOpenImageModel?: () => void;
};

type AssistantContextValue = {
  project: DetailPageSuiteProject;
  templates: DetailPageSuiteTemplate[];
  busy: boolean;
  busyStatus: DetailPageSuiteBusyStatus | null;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  tryCollapse: () => void;
  tryExpand: () => void;
  onChoice: (message: string) => void;
  phase: DetailPageSuitePhase;
  dimStep: number;
  dimensionMessageLabels: ReturnType<typeof buildSuiteDimensionMessageLabels>;
  liveStep: ReturnType<typeof resolveSuiteLiveChoiceStep>;
  workspaceGuide: ReturnType<typeof resolveSuiteWorkspaceGuide>;
  showChoices: boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  optimisticSelected: string | null;
  selectedMessage: string | null;
  handleChoice: (message: string) => void;
  renderComposer: (variant: "dock" | "compact") => ReactNode;
};

const DetailPageSuiteAssistantContext =
  createContext<AssistantContextValue | null>(null);

function useDetailPageSuiteAssistantContext() {
  const ctx = useContext(DetailPageSuiteAssistantContext);
  if (!ctx) {
    throw new Error(
      "DetailPageSuite assistant must render inside DetailPageSuiteAssistantRoot",
    );
  }
  return ctx;
}

function phaseLabel(phase: DetailPageSuitePhase): string {
  return SUITE_RAIL_STEPS.find((s) => s.id === phase)?.label ?? "产品图";
}

function composerPlaceholder(
  project: DetailPageSuiteProject,
  phase: DetailPageSuitePhase,
  dimStep: number,
): string {
  if (phase === "product_ref") {
    return "请在下方选择产品图方式，或点选上方卡片";
  }
  if (phase === "dimensions") {
    const step = FASHION_DIMENSION_STEPS[dimStep];
    if (step?.freeText) return fashionDimensionPrompt(dimStep);
    return "请点选上方卡片继续七维采集";
  }
  if (phase === "sellpoints") {
    if ((project.brief?.sellPoints?.length ?? 0) > 0) {
      return "可继续补充卖点（每行一条），或点「确认卖点清单」";
    }
    return project.references.length
      ? "手填卖点（每行一条），或点「AI识图抽卖点」"
      : "手填卖点（每行一条）；上传产品图后可识图";
  }
  if (phase === "modules") {
    return "输入自定义大模块名称后发送，或点「确认模块配置」";
  }
  if (phase === "template") return "请点选上方套图模板";
  if (phase === "subdims") return "勾选子维度后点「确认子维度」";
  if (phase === "prompts") return "点「生成全部提示词」，或在中栏逐模块生成";
  return "点「生成全部图片」出图，或在中栏单张生成";
}

function composerEnabled(
  phase: DetailPageSuitePhase,
  dimStep: number,
): boolean {
  if (phase === "dimensions") {
    const step = FASHION_DIMENSION_STEPS[dimStep];
    return Boolean(step?.freeText);
  }
  return phase === "sellpoints" || phase === "modules";
}

function useDetailPageSuiteAssistant(props: Props): AssistantContextValue {
  const {
    project,
    templates,
    busy = false,
    busyStatus = null,
    composerWide,
    onComposerWideChange,
    collapsed = false,
    onCollapsedChange,
    onChoice,
    onOpenImageModel,
  } = props;

  const tryCollapse = useCallback(() => {
    if (busy) return;
    onCollapsedChange?.(true);
  }, [busy, onCollapsedChange]);

  const tryExpand = useCallback(() => {
    onCollapsedChange?.(false);
  }, [onCollapsedChange]);

  const [input, setInput] = useState("");
  const [optimisticSelected, setOptimisticSelected] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const phase: DetailPageSuitePhase = project.meta?.phase ?? "product_ref";
  const dimStep = project.meta?.dimensionStep ?? 0;

  const dimensionMessageLabels = useMemo(
    () => buildSuiteDimensionMessageLabels(project.chatHistory),
    [project.chatHistory],
  );

  const liveStep = useMemo(
    () =>
      resolveSuiteLiveChoiceStep({
        phase,
        dimStep,
        templates,
        hasProductRefs: project.references.some((r) => r.ossUrl?.trim()),
        hasSellPoints: (project.brief?.sellPoints?.length ?? 0) > 0,
      }),
    [phase, dimStep, templates, project.references.length, project.brief?.sellPoints?.length],
  );

  const workspaceGuide = useMemo(() => resolveSuiteWorkspaceGuide(phase), [phase]);

  const showChoices = !busy && Boolean(liveStep?.choices.length);

  const selectedMessage = useMemo(
    () => optimisticSelected ?? resolveSuiteAssistantSelectedMessage(project),
    [optimisticSelected, project],
  );

  useEffect(() => {
    setOptimisticSelected(null);
  }, [phase, dimStep, project.id]);

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

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [project.chatHistory.length, liveStep?.choices.length, scrollToBottom]);

  const inputEnabled = composerEnabled(phase, dimStep);
  const placeholder = composerPlaceholder(project, phase, dimStep);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    if (phase === "sellpoints") {
      onChoice(`手填卖点\n${text}`);
    } else if (phase === "modules") {
      onChoice(`自定义模块·${text}`);
    } else if (phase === "dimensions" && FASHION_DIMENSION_STEPS[dimStep]?.freeText) {
      onChoice(text);
    } else {
      return;
    }
    setInput("");
  }, [busy, dimStep, input, onChoice, phase]);

  const handleChoice = useCallback(
    (message: string) => {
      setOptimisticSelected(message);
      onChoice(message);
    },
    [onChoice],
  );

  const renderComposer = useCallback(
    (variant: "dock" | "compact") => {
      const compact = variant === "compact";
      return (
        <div
          className={cn(
            compact
              ? ECOM_ASSISTANT_COMPOSER_SHELL_COMPACT
              : variant === "dock"
                ? "shrink-0 bg-[var(--ecom-assistant-composer-bg)] px-4 py-2"
                : ECOM_ASSISTANT_COMPOSER_SHELL_BASE,
            !compact && variant !== "dock" && ECOM_ASSISTANT_COMPOSER_SHELL_EXPANDED_BORDER,
          )}
          data-ecom-suite-composer
        >
          <div className="flex items-end gap-2">
            <textarea
              className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-[var(--ecom-assistant-input-border)] bg-[var(--ecom-assistant-input-bg)] px-3 py-2 text-sm text-[#1d1d1f] outline-none placeholder:text-[#86868b] focus:border-[var(--ecom-chrome-accent)] disabled:opacity-50"
              rows={compact ? 1 : composerWide ? 4 : 2}
              placeholder={placeholder}
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => {
                if (collapsed) tryExpand();
                if (!compact) onComposerWideChange?.(true);
              }}
              onKeyDown={(e) => {
                if (busy || !inputEnabled) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {onOpenImageModel && !compact ? (
              <EcomAssistantIconButton title="生图模型" onClick={onOpenImageModel}>
                <Settings2 className={ECOM_ASSISTANT_CONTROL_ICON_CLASS} />
              </EcomAssistantIconButton>
            ) : null}
            <EcomAssistantSendButton
              disabled={busy || !input.trim()}
              busy={busy}
              onClick={handleSend}
            />
          </div>
        </div>
      );
    },
    [
      busy,
      composerWide,
      handleSend,
      input,
      inputEnabled,
      onComposerWideChange,
      collapsed,
      onOpenImageModel,
      placeholder,
      tryExpand,
    ],
  );

  return {
    project,
    templates,
    busy,
    busyStatus,
    composerWide,
    onComposerWideChange,
    collapsed,
    onCollapsedChange,
    tryCollapse,
    tryExpand,
    onChoice,
    phase,
    dimStep,
    dimensionMessageLabels,
    liveStep,
    workspaceGuide,
    showChoices,
    scrollRef,
    optimisticSelected,
    selectedMessage,
    handleChoice,
    renderComposer,
  };
}

/** 共享输入状态；须包裹 EcomWorkspaceLayout */
export function DetailPageSuiteAssistantRoot({
  children,
  ...props
}: Props & { children: ReactNode }) {
  const value = useDetailPageSuiteAssistant(props);
  return (
    <DetailPageSuiteAssistantContext.Provider value={value}>
      {children}
    </DetailPageSuiteAssistantContext.Provider>
  );
}

/** 顶栏 + 聊天记录（不含底部输入） */
export function DetailPageSuiteAssistantPanel() {
  const {
    project,
    templates,
    busy,
    busyStatus,
    composerWide,
    onComposerWideChange,
    collapsed,
    onCollapsedChange,
    tryCollapse,
    phase,
    dimensionMessageLabels,
    liveStep,
    workspaceGuide,
    showChoices,
    scrollRef,
    selectedMessage,
    handleChoice,
    renderComposer,
  } = useDetailPageSuiteAssistantContext();

  return (
    <EcomAssistantCollapsibleLayout
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      collapseBlocked={busy}
      attentionBadge={showChoices}
      composer={null}
      floatingComposer={renderComposer("compact")}
      className="h-full min-h-0"
    >
      <EcomAssistantPanelHeader
        title="套图助手"
        subtitle={`${phaseLabel(phase)} · 产品图 → 七维 → 卖点 → 模板 → 出图`}
        composerWide={composerWide}
        onComposerWideChange={onComposerWideChange}
        onCollapse={onCollapsedChange ? tryCollapse : undefined}
        collapseDisabled={busy}
      />

      <div
        ref={scrollRef}
        className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 [overflow-anchor:none]"
      >
          <div className="space-y-3">
            {project.chatHistory.map((m) => {
              const dimMeta =
                m.role === "user" ? dimensionMessageLabels.get(m.id) : undefined;
              const historical =
                m.role === "user"
                  ? buildSuiteHistoricalChoiceBlock({
                      userMessage: m.content,
                      dimMeta,
                      templates,
                    })
                  : null;

              return (
                <div key={m.id} className="space-y-2">
                  {m.role === "assistant" || !historical ? (
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
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ) : null}

                  {historical ? (
                    <div className="flex w-full flex-col items-start">
                      <div
                        className={cn(ECOM_ASSISTANT_CHOICE_SHELL_CLASS, "w-full max-w-[95%]")}
                      >
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

            {!showChoices && workspaceGuide ? (
              <div className="rounded-2xl border border-[#0071e3]/25 bg-[#f0f6ff] p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#1d1d1f]">{workspaceGuide.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#6e6e73]">{workspaceGuide.body}</p>
              </div>
            ) : null}

            {showChoices && liveStep ? (
              <div className="flex flex-col items-start">
                <div className={ECOM_ASSISTANT_CHOICE_SHELL_CLASS}>
                  <div className="rounded-2xl border border-[#0071e3]/25 bg-[#f0f6ff] p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1d1d1f]">
                          {liveStep.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#6e6e73]">
                          {liveStep.subtitle}
                        </p>
                        <p className="mt-2 text-[11px] text-[#86868b]">
                          请选择（无需输入）：点选后将写入会话并同步中栏。
                        </p>
                      </div>
                      {liveStep.progress ? (
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium text-[#0071e3]">
                          {liveStep.progress}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3">
                    <SeedVideoAssistantChoiceCards
                      title="可选方案"
                      subtitle="选中项会高亮显示；确认后进入下一步"
                      choices={liveStep.choices}
                      selectedMessage={selectedMessage}
                      disabled={busy}
                      onSelect={(message) => handleChoice(message)}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          {busy && busyStatus ? (
            <StoryboardTaskStatus
              active
              sweep={busyStatus.sweep}
              title={busyStatus.title}
              detail={busyStatus.detail}
              className="mt-3"
            />
          ) : null}
      </div>
    </EcomAssistantCollapsibleLayout>
  );
}

/** 固定底栏：Grid 第二行，不参与滚动 */
export function DetailPageSuiteAssistantComposer() {
  const { renderComposer } = useDetailPageSuiteAssistantContext();
  return (
    <EcomAssistantComposerDock>{renderComposer("dock")}</EcomAssistantComposerDock>
  );
}
