"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play, RefreshCw, X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import {
  STORY_LLM_MODEL_KEYS,
  type CanvasEnginePick,
} from "@/lib/canvas/types";
import { EnginePicker } from "./engine-picker";
import { MarkdownView } from "./markdown-view";
import { MarkdownFullscreenLightbox } from "./markdown-fullscreen-lightbox";
import {
  MentionsTextarea,
  type MentionableItem,
} from "./mentions/MentionsTextarea";

function BatchSelectListItem({
  item,
  checked,
  onToggle,
}: {
  item: BatchSelectItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const followMouse = (e: React.MouseEvent) => {
    if (!item.tip) return;
    setTipPos({ x: e.clientX, y: e.clientY });
  };

  const hideTip = () => setTipPos(null);

  const tipAbove = tipPos && tipPos.y > 160;

  return (
    <>
      <li>
        <label
          className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-white/5"
          onMouseEnter={followMouse}
          onMouseMove={followMouse}
          onMouseLeave={hideTip}
        >
          <input
            type="checkbox"
            className="mt-0.5"
            checked={checked}
            onChange={onToggle}
          />
          <span className="min-w-0 flex-1">
            <span className="text-[13px] text-white">{item.label}</span>
            {item.hint ? (
              <span className="ml-1 text-[11px] text-white/50">{item.hint}</span>
            ) : null}
          </span>
        </label>
      </li>
      {mounted && tipPos && item.tip
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[1200] max-h-[280px] max-w-[min(420px,calc(100vw-24px))] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/20 bg-black/95 px-3.5 py-3 text-sm leading-relaxed text-white shadow-2xl"
              style={{
                left: tipPos.x,
                top: tipPos.y,
                transform: tipAbove
                  ? "translate(-50%, calc(-100% - 14px))"
                  : "translate(-50%, 14px)",
              }}
            >
              {item.tip}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export type StoryEngineModalKind =
  | "outline"
  | "character"
  | "storyboard";

export type StoryEngineModalTab = "copy" | "next" | "preview";

type TabId = StoryEngineModalTab;

const TAB_LABELS: Record<TabId, string> = {
  copy: "文案",
  next: "下一步",
  preview: "预览",
};

function tabsForKind(kind: StoryEngineModalKind): TabId[] {
  if (kind === "outline") return ["copy", "preview"];
  if (kind === "character") return ["copy", "next", "preview"];
  return ["copy", "next", "preview"];
}

function nextTabLabel(kind: StoryEngineModalKind): string {
  if (kind === "character") return "三视图";
  return "分镜图";
}

function tabLabel(id: TabId, kind: StoryEngineModalKind): string {
  if (id === "next") return nextTabLabel(kind);
  return TAB_LABELS[id];
}

export type BatchSelectItem = {
  key: string;
  label: string;
  hint?: string;
  /** 悬停 tip（分镜表完整内容等） */
  tip?: string;
};

export type StoryBatchRunOptions = {
  forceFresh?: boolean;
  selectedKeys: string[];
};

const EMPTY_PICK: CanvasEnginePick = {
  providerId: "",
  modelKey: "",
  params: {},
};

export function StoryEngineActionsModal({
  open,
  onClose,
  initialTab,
  title,
  kind,
  prompt,
  onPromptChange,
  mentionables,
  providerId,
  modelKey,
  params,
  onPickEngine,
  batchImage,
  onPickBatchImage,
  textOutput,
  isGenerating,
  hasGenerated,
  isNextRunning,
  onRunCopy,
  onRunNext,
  onRunNextForce,
  batchSelectItems,
  batchImageAllowedKeys,
}: {
  open: boolean;
  onClose: () => void;
  /** 打开时定位到的 Tab（由节点「文案 / 三视图」等按钮传入） */
  initialTab?: StoryEngineModalTab;
  title: string;
  kind: StoryEngineModalKind;
  prompt: string;
  onPromptChange: (v: string) => void;
  mentionables: MentionableItem[];
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  onPickEngine: (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => void;
  batchImage?: CanvasEnginePick;
  onPickBatchImage?: (next: CanvasEnginePick) => void;
  textOutput?: string;
  isGenerating: boolean;
  hasGenerated: boolean;
  isNextRunning?: boolean;
  onRunCopy: (forceFresh: boolean) => void;
  onRunNext?: (opts: StoryBatchRunOptions) => void;
  onRunNextForce?: (opts: StoryBatchRunOptions) => void;
  batchSelectItems?: BatchSelectItem[];
  /** 三视图 Tab 模型白名单（角色设定用） */
  batchImageAllowedKeys?: readonly string[];
}) {
  const tabIds = tabsForKind(kind);
  const [tab, setTab] = useState<TabId>(tabIds[0]!);
  const [mounted, setMounted] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const imagePick = batchImage ?? EMPTY_PICK;
  const hasBatchImage = Boolean(
    imagePick.providerId?.trim() && imagePick.modelKey?.trim(),
  );
  const nextLabel = nextTabLabel(kind);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const ids = tabsForKind(kind);
    const t =
      initialTab && ids.includes(initialTab) ? initialTab : ids[0]!;
    setTab(t);
  }, [open, kind, initialTab]);

  useEffect(() => {
    if (batchSelectItems?.length) {
      setSelectedKeys(new Set(batchSelectItems.map((i) => i.key)));
    }
  }, [batchSelectItems, open]);

  const toggleSelectKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allBatchKeys = batchSelectItems?.map((i) => i.key) ?? [];
  const checkedKeys = allBatchKeys.filter((k) => selectedKeys.has(k));

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1090] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} · 操作`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="nodrag flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/15 bg-[var(--canvas-surface)] shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{title}</p>
              <p className="text-[11px] text-[var(--canvas-muted)]">
                各 Tab 独立选模型 · 节点上仅保留摘要
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full border border-white/10 p-1.5 text-white/70 hover:bg-white/10"
              aria-label="关闭"
            >
              <X className="size-5" />
            </button>
          </header>

          <div className="flex shrink-0 gap-1 border-b border-white/10 px-3 py-2">
            {tabIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition ${
                  tab === id
                    ? "bg-[#fb923c]/20 text-[#fdba74]"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {id === "next" ? nextLabel : tabLabel(id, kind)}
              </button>
            ))}
          </div>

          <div className={`${RF_NODE_SCROLL} min-h-0 flex-1 overflow-y-auto p-4`}>
            {tab === "copy" ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    Prompt
                  </p>
                  <MentionsTextarea
                    value={prompt}
                    onChange={onPromptChange}
                    mentionables={mentionables}
                    placeholder="编辑 prompt；输出 Markdown"
                    rows={10}
                    className={`${RF_NODE_SCROLL} w-full resize-y rounded-md border border-white/10 bg-black/30 p-3 font-mono text-[12px] text-white`}
                  />
                </div>
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    LLM 模型
                  </p>
                  <EnginePicker
                    role="LLM"
                    allowedModelKeys={[...STORY_LLM_MODEL_KEYS]}
                    providerId={providerId}
                    modelKey={modelKey}
                    params={params}
                    onChange={onPickEngine}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={!providerId || !modelKey || isGenerating}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#fb923c] px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
                    onClick={() => onRunCopy(hasGenerated)}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" /> 生成中…
                      </>
                    ) : hasGenerated ? (
                      <>
                        <RefreshCw className="size-3.5" /> 重新生成本步
                      </>
                    ) : (
                      <>
                        <Play className="size-3.5" /> 生成本步
                      </>
                    )}
                  </button>
                  {hasGenerated ? (
                    <button
                      type="button"
                      disabled={isGenerating}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-white/15 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10 disabled:opacity-50"
                      onClick={() => onRunCopy(true)}
                    >
                      强制跳过缓存
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {tab === "next" && kind !== "outline" ? (
              <div className="space-y-4">
                <p className="text-[13px] leading-relaxed text-white/80">
                  {kind === "character"
                    ? "确认角色表无误后，批量创建各角色三视图节点并自动生图。"
                    : "确认分镜表无误后，创建各镜分镜图节点，并带入画面 Prompt、视频提示与对白。在各分镜图节点内分别生成静帧 / 视频 / 配音。"}
                </p>
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    {kind === "character"
                      ? "三视图 IMAGE 模型"
                      : "IMAGE 模型（写入分镜图节点，供手动生成）"}
                  </p>
                  <EnginePicker
                    role="IMAGE"
                    allowedModelKeys={
                      batchImageAllowedKeys?.length
                        ? [...batchImageAllowedKeys]
                        : undefined
                    }
                    providerId={imagePick.providerId}
                    modelKey={imagePick.modelKey}
                    params={imagePick.params ?? {}}
                    onChange={(next) =>
                      onPickBatchImage?.({
                        providerId: next.providerId,
                        modelKey: next.modelKey,
                        params: next.params,
                      })
                    }
                  />
                  {kind === "character" ? (
                    <p className="mt-1 text-[10px] text-[var(--canvas-muted)]">
                      推荐 nano-banana-pro；输出为正面/侧面/背面 turnaround sheet。
                    </p>
                  ) : null}
                </div>
                {!textOutput?.trim() ? (
                  <p className="text-[12px] text-red-300">
                    请先在「文案」Tab 生成本步 Markdown。
                  </p>
                ) : !hasBatchImage ? (
                  <p className="text-[12px] text-amber-200">
                    请先在上方选择 IMAGE 模型。
                  </p>
                ) : !batchSelectItems?.length ? (
                  <p className="text-[12px] text-red-300">
                    无法解析{kind === "character" ? "角色表" : "分镜表"}。
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-[var(--canvas-muted)]">
                          选择要生成的项（可取消勾选跳过）
                        </p>
                        <button
                          type="button"
                          className="text-[11px] text-[#fdba74] hover:underline"
                          onClick={() =>
                            setSelectedKeys(
                              selectedKeys.size === allBatchKeys.length
                                ? new Set()
                                : new Set(allBatchKeys),
                            )
                          }
                        >
                          {selectedKeys.size === allBatchKeys.length
                            ? "全不选"
                            : "全选"}
                        </button>
                      </div>
                      <ul className="max-h-[200px] space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-2">
                        {batchSelectItems.map((item) => (
                          <BatchSelectListItem
                            key={item.key}
                            item={item}
                            checked={selectedKeys.has(item.key)}
                            onToggle={() => toggleSelectKey(item.key)}
                          />
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={isNextRunning || checkedKeys.length === 0}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-[#fb923c] px-3 py-2 text-[13px] font-medium text-black disabled:opacity-50"
                        onClick={() => {
                          onRunNext?.({
                            forceFresh: false,
                            selectedKeys: checkedKeys,
                          });
                          onClose();
                        }}
                      >
                        {isNextRunning ? (
                          <>
                            <RefreshCw className="size-3.5 animate-spin" />{" "}
                            处理中…
                          </>
                        ) : kind === "storyboard" ? (
                          <>创建选中 ({checkedKeys.length})</>
                        ) : (
                          <>生成选中 ({checkedKeys.length})</>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isNextRunning}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-white/15 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10 disabled:opacity-50"
                        onClick={() => {
                          onRunNext?.({
                            forceFresh: false,
                            selectedKeys: allBatchKeys,
                          });
                          onClose();
                        }}
                      >
                        {kind === "storyboard"
                          ? `创建全部 (${allBatchKeys.length})`
                          : `生成全部 (${allBatchKeys.length})`}
                      </button>
                      {kind !== "storyboard" ? (
                        <button
                          type="button"
                          disabled={isNextRunning || checkedKeys.length === 0}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-white/15 px-3 py-2 text-[12px] text-white/85 hover:bg-white/10 disabled:opacity-50"
                          onClick={() => {
                            onRunNextForce?.({
                              forceFresh: true,
                              selectedKeys: checkedKeys,
                            });
                            onClose();
                          }}
                        >
                          选中强制重生成
                        </button>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-[var(--canvas-muted)]">
                      {kind === "storyboard"
                        ? "已存在的镜号会跳过创建，但会补全 @ 角色关联与参考图连线。"
                        : "批量任务排队依次执行，降低 API 429 限流风险。"}
                    </p>
                  </>
                )}
                {kind === "storyboard" ? (
                  <p className="text-[11px] text-[var(--canvas-muted)]">
                    创建前按镜号校验出镜角色三视图是否已生成；鼠标悬停镜号可查看完整分镜内容。无需一次性创建全部角色。
                  </p>
                ) : null}
              </div>
            ) : null}

            {tab === "preview" ? (
              <div className="space-y-3">
                {textOutput?.trim() ? (
                  <>
                    <button
                      type="button"
                      className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] hover:bg-white/10"
                      onClick={() => setPreviewFullscreen(true)}
                    >
                      全屏 Word 式预览
                    </button>
                    <div className="max-h-[360px] overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3">
                      <MarkdownView content={textOutput} />
                    </div>
                  </>
                ) : (
                  <p className="text-[12px] text-[var(--canvas-muted)]">
                    尚未生成本步内容
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {previewFullscreen && textOutput ? (
        <MarkdownFullscreenLightbox
          title={title}
          content={textOutput}
          onClose={() => setPreviewFullscreen(false)}
        />
      ) : null}
    </>,
    document.body,
  );
}
