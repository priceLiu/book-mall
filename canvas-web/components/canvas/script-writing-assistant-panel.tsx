"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  GripHorizontal,
  Loader2,
  Maximize2,
  MessageSquareText,
  PanelLeft,
  Send,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { ScriptAssistantPackPreviewModal } from "@/components/canvas/script-assistant-pack-preview-modal";
import { StoryErrorLine } from "@/components/canvas/story-status-line";
import {
  clearScriptAssistantHistory,
  getScriptAssistantHistory,
  listScriptAssistantHistoryThreads,
  saveScriptAssistantHistory,
  streamScriptAssistantChat,
  type ScriptAssistantHistoryThread,
  type ScriptAssistantMessage,
} from "@/lib/canvas-api";
import {
  PRO2_ASSISTANT_CHROME,
  PRO_ASSISTANT_CHROME,
  type StoryAssistantChrome,
} from "@/lib/canvas/story-pro2-node-chrome";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  SCRIPT_ASSISTANT_OUTPUT_MODES,
  SCRIPT_ASSISTANT_WELCOME_MESSAGE,
  resolveStoryProAssistantImport,
  type ScriptAssistantOutputMode,
} from "@/lib/canvas/story-pro-script-assistant";
import {
  listStoryProAssistantWorkflowThreads,
  pickActiveStoryProAssistantWorkflowKey,
  storyProAssistantThemeForWorkflowKey,
  type StoryProAssistantWorkflowThread,
} from "@/lib/canvas/story-pro-script-assistant-workflows";
import { cn } from "@/lib/utils";

type ChatMessage = ScriptAssistantMessage;
type LayoutMode = "dock" | "immersive";

const ASSISTANT_FLOAT_Z = 1050;
const ASSISTANT_SCRIM_Z = ASSISTANT_FLOAT_Z - 1;
const PANEL_SOLID_CLASS = "bg-[var(--canvas-surface,#13131f)]";
const PANEL_BODY_SOLID_CLASS = "bg-[var(--canvas-surface-2,#1a1a2b)]";
const DOCK_WIDTH_PX = 320;
const FLOAT_WIDTH_PX = 920;
const FLOAT_HEIGHT_PX = 720;
const VIEWPORT_MARGIN = 12;

function newMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function floatPanelSize() {
  const w = Math.min(FLOAT_WIDTH_PX, Math.round(window.innerWidth * 0.88));
  const h = Math.min(FLOAT_HEIGHT_PX, Math.round(window.innerHeight * 0.82));
  return { w, h };
}

function clampFloatPos(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - w - VIEWPORT_MARGIN);
  const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - h - VIEWPORT_MARGIN);
  return {
    x: Math.min(maxX, Math.max(VIEWPORT_MARGIN, x)),
    y: Math.min(maxY, Math.max(VIEWPORT_MARGIN, y)),
  };
}

function centerFloatPos() {
  const { w, h } = floatPanelSize();
  return clampFloatPos(
    (window.innerWidth - w) / 2,
    (window.innerHeight - h) / 2,
    w,
    h,
  );
}

function useFloatingDrag(enabled: boolean) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const resetCenter = useCallback(() => {
    setPos(centerFloatPos());
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPos(null);
      return;
    }
    if (pos === null) resetCenter();
  }, [enabled, pos, resetCenter]);

  useEffect(() => {
    if (!enabled || pos === null) return;
    const onResize = () => {
      const { w, h } = floatPanelSize();
      setPos((p) => (p ? clampFloatPos(p.x, p.y, w, h) : p));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const { w, h } = floatPanelSize();
      setPos(
        clampFloatPos(
          d.originX + (e.clientX - d.startX),
          d.originY + (e.clientY - d.startY),
          w,
          h,
        ),
      );
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const rect = panelRef.current?.getBoundingClientRect();
      const originX = pos?.x ?? rect?.left ?? 0;
      const originY = pos?.y ?? rect?.top ?? 0;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX,
        originY,
      };
    },
    [pos],
  );

  return { pos, panelRef, onDragStart, resetCenter };
}

const LEGACY_ASSISTANT_WORKFLOW_KEY = "";

type AssistantThreadRow = {
  workflowKey: string;
  theme: string;
  workflowLabel: string;
  scriptFinalized: boolean;
  hasScript: boolean;
  messageCount: number;
};

function AssistantWorkflowPicker({
  threads,
  activeKey,
  onSelect,
  immersive,
  chrome,
}: {
  threads: AssistantThreadRow[];
  activeKey: string | null;
  onSelect: (workflowKey: string) => void;
  immersive: boolean;
  chrome: StoryAssistantChrome;
}) {
  if (threads.length === 0) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-b border-white/10",
        PANEL_BODY_SOLID_CLASS,
        immersive ? "px-5 py-2" : "px-3 py-1.5",
      )}
      data-canvas-wheel-scroll
    >
      <p className="text-[9px] uppercase tracking-wide text-white/35">
        工作流会话
      </p>
      <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
        {threads.map((t) => {
          const active = t.workflowKey === activeKey;
          return (
            <button
              key={t.workflowKey}
              type="button"
              className={cn(
                "shrink-0 rounded-md border px-2 py-1.5 text-left transition",
                immersive ? "text-[11px]" : "text-[10px]",
                active ? chrome.threadActive : chrome.tabIdle,
              )}
              onClick={() => onSelect(t.workflowKey)}
            >
              <span className="block truncate font-medium leading-snug">{t.theme}</span>
              <span className="mt-0.5 block text-[9px] opacity-70">
                {t.workflowLabel}
                {t.messageCount > 0 ? ` · ${t.messageCount} 条` : " · 暂无对话"}
                {t.scriptFinalized ? " · 已定稿" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AssistantModeBar({
  mode,
  onModeChange,
  immersive,
  chrome,
}: {
  mode: ScriptAssistantOutputMode;
  onModeChange: (m: ScriptAssistantOutputMode) => void;
  immersive: boolean;
  chrome: StoryAssistantChrome;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap gap-1 border-b border-white/10",
        PANEL_BODY_SOLID_CLASS,
        immersive ? "px-5 py-2" : "px-3 py-1.5",
      )}
    >
      {SCRIPT_ASSISTANT_OUTPUT_MODES.map((opt) => (
        <button
          key={opt.id}
          type="button"
          title={opt.hint}
          className={cn(
            "rounded-md border px-2 py-1 text-left transition",
            immersive ? "text-[11px]" : "text-[10px]",
            mode === opt.id ? chrome.tabActive : chrome.tabIdle,
          )}
          onClick={() => onModeChange(opt.id)}
        >
          <span className="font-medium">{opt.label}</span>
          <span className="mt-0.5 block text-[9px] opacity-75">{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}

type AssistantPanelBodyProps = {
  chrome: StoryAssistantChrome;
  immersive: boolean;
  showPackPreview: boolean;
  previewReady: boolean;
  onOpenPreview: () => void;
  messages: ChatMessage[];
  loadingHistory: boolean;
  sending: boolean;
  chatError: string | null;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  listRef: React.Ref<HTMLDivElement>;
  lastAssistant?: ChatMessage;
  onCopyLast: () => void;
  onDownloadLast: () => void;
};

function AssistantPanelBody({
  chrome,
  immersive,
  showPackPreview,
  previewReady,
  onOpenPreview,
  messages,
  loadingHistory,
  sending,
  chatError,
  input,
  setInput,
  onSend,
  listRef,
  lastAssistant,
  onCopyLast,
  onDownloadLast,
}: AssistantPanelBodyProps) {
  const textSize = immersive ? "text-[13px]" : "text-[11px]";
  const inputSize = immersive ? "text-[13px]" : "text-[11px]";

  return (
    <>
      <div
        ref={listRef}
        data-canvas-wheel-scroll
        className={cn(
          "min-h-0 flex-1 select-text space-y-3 overflow-y-auto",
          immersive ? "px-5 py-4" : "space-y-2 px-3 py-2",
          textSize,
        )}
      >
        {loadingHistory ? (
          <p className="text-white/40">加载历史…</p>
        ) : messages.length === 0 ? (
          <div
            className={cn(
              "select-text rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap text-white/90",
              immersive
                ? "mr-auto max-w-[92%] bg-neutral-900"
                : "mr-2 bg-neutral-900/95",
            )}
          >
            {SCRIPT_ASSISTANT_WELCOME_MESSAGE}
            {showPackPreview ? (
              <p className={cn("mt-3 border-t border-white/10 pt-2 text-[10px] leading-snug", chrome.packHint)}>
                「创作并导入故事剧本」模式生成制作包；预览满意后「确定导入」将启动<strong>全新</strong>工作流（仅 Hub
                尚无大纲/定稿/下游列时可用）。
              </p>
            ) : null}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "select-text rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap",
                immersive ? "max-w-3xl" : "",
                m.role === "user"
                  ? immersive
                    ? chrome.userBubble
                    : chrome.userBubbleDock
                  : immersive
                    ? "mr-auto max-w-[92%] bg-neutral-900 text-white/92"
                    : "mr-2 bg-neutral-900/95 text-white/88",
              )}
            >
              {m.content ||
                (sending && m.role === "assistant" ? (
                  <span className="inline-flex items-center gap-0.5 text-white/45">
                    <span className={cn("inline-block size-1.5 animate-pulse rounded-full", chrome.pulseDot)} />
                    正在输入…
                  </span>
                ) : (
                  ""
                ))}
              {sending &&
              m.role === "assistant" &&
              m.content &&
              m.id === messages[messages.length - 1]?.id ? (
                <span
                  className={cn("ml-0.5 inline-block w-0.5 animate-pulse align-middle", chrome.cursorBlink)}
                  style={{ height: "0.85em" }}
                  aria-hidden
                />
              ) : null}
            </div>
          ))
        )}
      </div>

      {chatError ? (
        <StoryErrorLine
          message={chatError}
          className={immersive ? "mx-5 mb-2" : "mx-3 mb-1"}
        />
      ) : null}

      {lastAssistant?.content?.trim() ? (
        <div
          className={cn(
            "flex shrink-0 flex-wrap gap-1.5 border-t border-white/8",
            immersive ? "px-5 py-2.5" : "px-2 py-1.5",
          )}
        >
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded border border-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/5"
            title="复制最近一条助手回复全文"
            onClick={() => void onCopyLast()}
          >
            <Copy className="size-3" /> 复制
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded border border-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/5"
            onClick={onDownloadLast}
          >
            <Download className="size-3" /> 下载 .md
          </button>
          {showPackPreview ? (
            <button
              type="button"
              disabled={!previewReady}
              title={
                previewReady
                  ? "全屏弹层审阅 · 与故事大纲同款"
                  : "需先由助手生成制作包正文"
              }
              className={cn("inline-flex items-center gap-0.5 rounded border px-2 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-40", chrome.previewBtn)}
              onClick={onOpenPreview}
            >
              <Eye className="size-3" /> 制作包预览
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "shrink-0 border-t border-white/10",
          immersive ? "px-5 py-3" : "p-2",
        )}
      >
        <div className={cn("flex gap-2", immersive && "max-w-3xl")}>
          <textarea
            value={input}
            rows={immersive ? 3 : 2}
            placeholder={
              showPackPreview
                ? "描述修改意见，发送后助手会更新制作包…"
                : "描述剧本需求…"
            }
            className={cn(
              "flex-1 select-text resize-none rounded-md border border-white/10 bg-neutral-950 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none",
              chrome.inputFocus,
              immersive ? "min-h-[72px] text-[13px]" : "min-h-[52px]",
              inputSize,
            )}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={sending}
          />
          <button
            type="button"
            disabled={sending || !input.trim()}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md disabled:opacity-40",
              chrome.sendBtn,
              immersive ? "size-11" : "size-9",
            )}
            onClick={onSend}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function mergeAssistantThreadRows(
  workflows: StoryProAssistantWorkflowThread[],
  stored: ScriptAssistantHistoryThread[],
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
  edges: ReturnType<typeof useCanvasStore.getState>["edges"],
): AssistantThreadRow[] {
  const storedByKey = new Map(stored.map((s) => [s.workflowKey, s]));
  const rows: AssistantThreadRow[] = workflows.map((wf) => {
    const hit = storedByKey.get(wf.workflowKey);
    return {
      workflowKey: wf.workflowKey,
      theme: hit?.theme?.trim() || wf.theme,
      workflowLabel: wf.workflowLabel,
      scriptFinalized: wf.scriptFinalized,
      hasScript: wf.hasScript,
      messageCount: hit?.messageCount ?? 0,
    };
  });

  const legacy = storedByKey.get(LEGACY_ASSISTANT_WORKFLOW_KEY);
  if (legacy && legacy.messageCount > 0) {
    const hasLegacyRow = rows.some(
      (r) => r.workflowKey === LEGACY_ASSISTANT_WORKFLOW_KEY,
    );
    if (!hasLegacyRow) {
      rows.unshift({
        workflowKey: LEGACY_ASSISTANT_WORKFLOW_KEY,
        theme:
          legacy.theme?.trim() ||
          storyProAssistantThemeForWorkflowKey(nodes, edges, ""),
        workflowLabel: "项目会话（旧）",
        scriptFinalized: false,
        hasScript: false,
        messageCount: legacy.messageCount,
      });
    }
  }

  return rows;
}

export function ScriptWritingAssistantPanel({
  projectId,
  onImportScript,
  theme = "pro",
}: {
  projectId: string;
  onImportScript: (markdown: string) => void | Promise<void>;
  /** pro2 画布使用紫罗兰主题，禁止 green/emerald */
  theme?: "pro" | "pro2";
}) {
  const chrome = theme === "pro2" ? PRO2_ASSISTANT_CHROME : PRO_ASSISTANT_CHROME;
  const base = useBookMallBaseUrl();
  const [open, setOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("dock");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [portalMounted, setPortalMounted] = useState(false);
  const [outputMode, setOutputMode] =
    useState<ScriptAssistantOutputMode>("chat");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeWorkflowKey, setActiveWorkflowKey] = useState<string | null>(
    null,
  );
  const [threadRows, setThreadRows] = useState<AssistantThreadRow[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const persistRef = useRef(false);
  const { confirm } = useDialogs();

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const graphRevision = useCanvasStore((s) => s.graphRevision);
  const importPlan = useMemo(
    () => resolveStoryProAssistantImport(nodes, edges),
    [nodes, edges],
  );
  const importGate = useMemo(
    () => ({
      allowed: importPlan.allowed,
      reason: importPlan.allowed ? importPlan.hint : importPlan.reason,
      spawnNew: importPlan.allowed && importPlan.spawnNew,
    }),
    [importPlan],
  );

  const immersive = layoutMode === "immersive" && open;
  const showPackPreview = outputMode === "pack";
  const { pos, panelRef, onDragStart, resetCenter } = useFloatingDrag(immersive);

  const workflowThreads = useMemo(
    () => listStoryProAssistantWorkflowThreads(nodes, edges),
    [nodes, edges, graphRevision],
  );

  const selectedNodeId = useMemo(() => {
    const selected = nodes.filter((n) => n.selected);
    const hit = selected.find(
      (n) =>
        n.type === "story-pro-starter" ||
        n.type === "story-pro-script-hub" ||
        n.type === "story-pro2-starter" ||
        n.type === "story-pro2-script-hub",
    );
    return hit?.id ?? selected[0]?.id ?? null;
  }, [nodes, graphRevision]);

  const activeThread = useMemo(
    () => threadRows.find((t) => t.workflowKey === activeWorkflowKey) ?? null,
    [threadRows, activeWorkflowKey],
  );

  const scriptFinalized = Boolean(activeThread?.scriptFinalized);
  const hasScript = Boolean(activeThread?.hasScript);

  useEffect(() => setPortalMounted(true), []);

  useEffect(() => {
    if (!base?.trim() || !projectId) {
      setThreadRows([]);
      return;
    }
    void listScriptAssistantHistoryThreads(base, projectId)
      .then((stored) => {
        const merged = mergeAssistantThreadRows(
          workflowThreads,
          stored,
          nodes,
          edges,
        );
        setThreadRows(merged);
        setActiveWorkflowKey((prev) => {
          if (prev && merged.some((m) => m.workflowKey === prev)) return prev;
          return (
            pickActiveStoryProAssistantWorkflowKey(
              nodes,
              edges,
              selectedNodeId,
            ) ?? merged[0]?.workflowKey ?? null
          );
        });
      })
      .catch(() => {
        const merged = mergeAssistantThreadRows(workflowThreads, [], nodes, edges);
        setThreadRows(merged);
        setActiveWorkflowKey(
          pickActiveStoryProAssistantWorkflowKey(nodes, edges, selectedNodeId) ??
            merged[0]?.workflowKey ??
            null,
        );
      });
  }, [
    base,
    projectId,
    workflowThreads,
    nodes,
    edges,
    selectedNodeId,
    graphRevision,
  ]);

  useEffect(() => {
    if (!base?.trim() || !projectId || !activeWorkflowKey || scriptFinalized) {
      setMessages([]);
      return;
    }
    setLoadingHistory(true);
    void getScriptAssistantHistory(base, projectId, activeWorkflowKey)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [base, projectId, activeWorkflowKey, scriptFinalized]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const persistIfNeeded = useCallback(
    async (next: ChatMessage[]) => {
      if (
        scriptFinalized ||
        !base?.trim() ||
        !projectId ||
        !activeWorkflowKey
      ) {
        return;
      }
      if (persistRef.current) return;
      persistRef.current = true;
      try {
        const theme =
          activeThread?.theme ||
          storyProAssistantThemeForWorkflowKey(
            nodes,
            edges,
            activeWorkflowKey,
          );
        await saveScriptAssistantHistory(
          base,
          projectId,
          activeWorkflowKey,
          next,
          theme,
        );
        setThreadRows((prev) =>
          prev.map((row) =>
            row.workflowKey === activeWorkflowKey
              ? { ...row, messageCount: next.length, theme }
              : row,
          ),
        );
      } catch {
        /* ignore */
      } finally {
        persistRef.current = false;
      }
    },
    [
      activeThread?.theme,
      activeWorkflowKey,
      base,
      edges,
      nodes,
      projectId,
      scriptFinalized,
    ],
  );

  const dockToLeft = useCallback(() => {
    setLayoutMode("dock");
  }, []);

  const expandToImmersive = useCallback(() => {
    setLayoutMode("immersive");
    resetCenter();
  }, [resetCenter]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !base?.trim() || !activeWorkflowKey) return;

    if (layoutMode === "dock") {
      setLayoutMode("immersive");
      resetCenter();
    }

    const userMsg: ChatMessage = {
      id: newMessageId("u"),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const assistantId = newMessageId("a");
    const historyForApi = [...messages, userMsg].map(({ role, content }) => ({
      role,
      content,
    }));

    setInput("");
    setChatError(null);
    setSending(true);
    const withAssistant = [
      ...messages,
      userMsg,
      {
        id: assistantId,
        role: "assistant" as const,
        content: "",
        createdAt: new Date().toISOString(),
      },
    ];
    setMessages(withAssistant);
    scrollToBottom();

    try {
      const res = await streamScriptAssistantChat(base, historyForApi, outputMode);
      if (!res.ok) {
        let msg = `请求失败（HTTP ${res.status}）`;
        try {
          const j = (await res.json()) as { message?: string; error?: string };
          msg = j.message ?? j.error ?? msg;
        } catch {
          /* ignore */
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: msg } : m)),
        );
        setChatError(msg);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setChatError("无法读取响应流");
        return;
      }

      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const chunk = acc;
        flushSync(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: chunk } : m,
            ),
          );
        });
        scrollToBottom();
      }
      acc += decoder.decode();
      const finalText = acc.trimEnd() || "（模型未返回正文）";
      const finalMessages = withAssistant.map((m) =>
        m.id === assistantId ? { ...m, content: finalText } : m,
      );
      setMessages(finalMessages);
      await persistIfNeeded(finalMessages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setChatError(msg);
    } finally {
      setSending(false);
    }
  }, [
    activeWorkflowKey,
    base,
    input,
    layoutMode,
    messages,
    outputMode,
    persistIfNeeded,
    resetCenter,
    scrollToBottom,
    sending,
  ]);

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  const copyLast = async () => {
    const text = lastAssistant?.content?.trim();
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  const downloadLast = () => {
    const text = lastAssistant?.content?.trim();
    if (!text) return;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `script-draft-${projectId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const previewMd = lastAssistant?.content?.trim() ?? "";

  const confirmImportAndStart = useCallback(async () => {
    const text = previewMd;
    if (!text || !importGate.allowed) return;
    if (
      !(await confirm({
        title: "确定导入并开始制作",
        message: importGate.spawnNew
          ? "将在本画布新建一套独立工作流（故事启动 + 故事剧本），并写入当前制作包。导入后请在新的启动页运行导演向生成，再在对应 Hub 定稿并生成下游列；既有工作流不受影响。"
          : "将把当前制作包写入可用的故事启动节点。导入后请在启动页运行导演向生成，再在 Hub 定稿并生成下游列。",
        confirmLabel: "确定导入",
        cancelLabel: "再改改",
      }))
    ) {
      return;
    }
    await onImportScript(text);
    setPreviewOpen(false);
    setLayoutMode("dock");
    setOpen(false);
  }, [confirm, importGate.allowed, importGate.spawnNew, onImportScript, previewMd]);

  const collapse = useCallback(() => {
    setOpen(false);
    setLayoutMode("dock");
  }, []);

  const headerSubtitle = activeThread
    ? scriptFinalized
      ? `${activeThread.theme} · 定稿后对话不保存`
      : `${activeThread.theme} · 定稿前自动保存`
    : scriptFinalized
      ? "定稿后对话不保存"
      : "定稿前自动保存历史";

  const workflowPicker = (
    <AssistantWorkflowPicker
      threads={threadRows}
      activeKey={activeWorkflowKey}
      onSelect={(key) => {
        setActiveWorkflowKey(key);
        setChatError(null);
      }}
      immersive={layoutMode === "immersive"}
      chrome={chrome}
    />
  );

  const previewReady = Boolean(previewMd);

  const bodyProps: AssistantPanelBodyProps = {
    chrome,
    immersive: layoutMode === "immersive",
    showPackPreview,
    previewReady,
    onOpenPreview: () => setPreviewOpen(true),
    messages,
    loadingHistory,
    sending,
    chatError,
    input,
    setInput,
    onSend: () => void send(),
    listRef,
    lastAssistant,
    onCopyLast: copyLast,
    onDownloadLast: downloadLast,
  };

  const collapsedTab = (
    <button
      type="button"
      className={cn(
        "nodrag absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-r-lg border border-l-0 bg-[var(--canvas-surface)]/95 px-1.5 py-3 text-[10px] shadow-lg",
        chrome.collapsedTab,
      )}
      title="展开剧本创作助手"
      onClick={() => setOpen(true)}
    >
      <MessageSquareText className="size-4" />
      <span className="writing-vertical-rl [writing-mode:vertical-rl]">
        剧本创作助手
      </span>
      <ChevronRight className="size-3.5" />
    </button>
  );

  const modeBar = (
    <AssistantModeBar
      mode={outputMode}
      onModeChange={setOutputMode}
      immersive={layoutMode === "immersive"}
      chrome={chrome}
    />
  );

  const immersiveHeader = (
    <header
      className={cn(
        "nodrag flex shrink-0 cursor-grab items-center gap-2 border-b border-white/10 px-4 py-2.5 active:cursor-grabbing",
        PANEL_SOLID_CLASS,
      )}
      onMouseDown={onDragStart}
    >
      <GripHorizontal className="size-4 shrink-0 text-white/35" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13px] font-medium", chrome.titleText)}>
          剧本创作助手
        </p>
        {theme === "pro" ? (
          <p className="text-[10px] text-white/40">
            deepseek-v4-flash · 宽幅对话 · 拖标题栏移动 · {headerSubtitle}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/75 hover:bg-white/5"
        title="收回到画布左侧栏"
        onClick={dockToLeft}
      >
        <PanelLeft className="size-3.5" />
        收回侧栏
      </button>
      <button
        type="button"
        className="rounded p-1 text-white/50 hover:bg-white/5 hover:text-white"
        title="折叠"
        onClick={(e) => {
          e.stopPropagation();
          collapse();
        }}
      >
        <ChevronLeft className="size-4" />
      </button>
    </header>
  );

  const dockHeader = (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
      <div className="min-w-0">
        <p className={cn("truncate text-[12px] font-medium", chrome.titleText)}>
          剧本创作助手
        </p>
        {theme === "pro" ? (
          <p className="text-[9px] text-white/40">
            deepseek-v4-flash · {headerSubtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          className={cn("inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px]", chrome.expandBtn)}
          title="展开到画布中央（宽幅对话）"
          onClick={expandToImmersive}
        >
          <Maximize2 className="size-3" />
          展开
        </button>
        <button
          type="button"
          className="rounded p-1 text-white/50 hover:bg-white/5 hover:text-white"
          title="折叠"
          onClick={(e) => {
            e.stopPropagation();
            collapse();
          }}
        >
          <ChevronLeft className="size-4" />
        </button>
      </div>
    </header>
  );

  const floatSize = typeof window !== "undefined" ? floatPanelSize() : { w: FLOAT_WIDTH_PX, h: FLOAT_HEIGHT_PX };

  const immersivePanel =
    portalMounted && immersive && pos
      ? createPortal(
          <>
            <div
              className="pointer-events-none fixed inset-0 bg-black/50"
              style={{ zIndex: ASSISTANT_SCRIM_Z }}
              aria-hidden
            />
            <div
              ref={panelRef}
              data-canvas-block-nav-gesture
              className={cn(
                "nodrag nowheel fixed flex flex-col overflow-hidden rounded-2xl border shadow-2xl shadow-black/70 ring-1 ring-white/15",
                chrome.panelBorder,
                PANEL_SOLID_CLASS,
              )}
              style={{
                zIndex: ASSISTANT_FLOAT_Z,
                left: pos.x,
                top: pos.y,
                width: floatSize.w,
                height: floatSize.h,
              }}
              role="dialog"
              aria-label="剧本创作助手 · 宽幅对话"
            >
              {immersiveHeader}
              {workflowPicker}
              {modeBar}
              <div className={cn("flex min-h-0 flex-1 flex-col", PANEL_BODY_SOLID_CLASS)}>
                <AssistantPanelBody {...bodyProps} immersive />
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  if (!open) {
    return collapsedTab;
  }

  return (
    <>
      <ScriptAssistantPackPreviewModal
        open={previewOpen}
        md={previewMd}
        importAllowed={importGate.allowed}
        importBlockReason={importGate.reason}
        onClose={() => setPreviewOpen(false)}
        onConfirmImport={() => void confirmImportAndStart()}
      />
      {immersivePanel}
      {layoutMode === "dock" ? (
        <aside
          data-canvas-block-nav-gesture
          className={cn(
            "nodrag relative z-30 flex shrink-0 flex-col border-r border-white/10",
            PANEL_SOLID_CLASS,
          )}
          style={{ width: DOCK_WIDTH_PX }}
          aria-label="剧本创作助手"
        >
          {dockHeader}
          {workflowPicker}
          {modeBar}
          <div className={cn("flex min-h-0 flex-1 flex-col", PANEL_BODY_SOLID_CLASS)}>
            <AssistantPanelBody {...bodyProps} immersive={false} />
          </div>
        </aside>
      ) : null}
    </>
  );
}

/** 故事定稿时由 hub 节点调用 */
export async function clearScriptAssistantOnFinalize(
  base: string,
  projectId: string,
  scriptHubId: string,
  starterId?: string,
): Promise<void> {
  try {
    await clearScriptAssistantHistory(base, projectId, scriptHubId);
    if (starterId) {
      await clearScriptAssistantHistory(
        base,
        projectId,
        `starter:${starterId}`,
      );
    }
  } catch {
    /* ignore */
  }
}
