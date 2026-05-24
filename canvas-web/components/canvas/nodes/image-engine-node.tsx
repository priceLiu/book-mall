"use client";

import { useCallback, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Download, ImageIcon, Split, Trash2 } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { ImageEngineNodeData } from "@/lib/canvas/types";
import { deleteCanvasTask } from "@/lib/canvas-api";
import { busEnqueueNode } from "@/lib/canvas/canvas-run-bus";
import { cn } from "@/lib/utils";
import { resolveReferencedNodeIds } from "@/lib/canvas/referenced-nodes";
import { resolveProductMainImage } from "@/lib/canvas/upstream-images";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { NodeShell } from "../node-shell";
import {
  FrameImageActionsModal,
  type FrameImageModalTab,
} from "../frame-image-actions-modal";
import {
  CompareModal,
  refSideId,
  taskSideId,
  type CompareReferenceImage,
} from "../compare-modal";
import { EnginePicker } from "../engine-picker";
import { EnginePreviewTrigger } from "../engine-preview-trigger";
import { MediaHoverBox } from "../media-hover-box";
import { PromptTemplatePicker } from "../prompt-template-picker";
import type { AppliedPromptTemplate } from "@/lib/canvas-prompt-templates-api";
import {
  MentionsTextarea,
  type MentionableItem,
} from "../mentions/MentionsTextarea";
import { UpstreamChipRow, useUpstreamChips, sortUpstreamChips } from "../upstream-chips";
import {
  NODE_BTN_ACCENT,
  NODE_BTN_GHOST,
  NODE_HISTORY_THUMB,
  NODE_MEDIA_ENGINE_HEIGHT,
  NODE_MEDIA_MIN_WIDTH,
  NODE_PROMPT_CLASS,
  NODE_STORY_FRAME_MIN_HEIGHT,
  NODE_STORY_FRAME_MIN_WIDTH,
  NODE_STORY_FRAME_PROMPT_CLASS,
  NODE_STORY_FRAME_SPLIT_MIN_H,
  NodeEngineFooter,
  NodeEngineLayout,
  NodeEngineShellFooter,
  NodeHistoryStrip,
  NODE_BTN_FRAME_ACTION,
  NodeMediaEmpty,
  NodeMediaGallery,
  NodeMediaItem,
  NodeMediaStage,
} from "../node-ui";

type CompareState = {
  defaultLeftId?: string;
  defaultRightId?: string;
};

const FRAME_QUICK_ACTIONS: Array<{
  tab: FrameImageModalTab;
  label: string;
  dynamic?: "frameImage";
}> = [
  { tab: "regenerate", label: "重新生成", dynamic: "frameImage" },
  { tab: "video", label: "生成视频" },
  { tab: "dialogue", label: "生成对白" },
  { tab: "both", label: "视频+对白" },
];

function frameImageActionLabel(
  hasGenerated: boolean,
  isGenerating: boolean,
): string {
  if (isGenerating) return "生成中…";
  if (hasGenerated) return "重新生成";
  return "分镜图生成";
}

function frameRegenerateTabLabel(hasGenerated: boolean): string {
  return hasGenerated ? "重新生成" : "分镜图生成";
}

function frameStatusLabel(status: string, isGenerating: boolean): string {
  if (isGenerating) return "生成中…";
  if (status === "done") return "已完成";
  if (status === "error") return "失败";
  if (status === "pending") return "排队中";
  return "待生成";
}

export function ImageEngineNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { doubleConfirm, alert } = useDialogs();

  const { history, succeeded, refreshHistory } = useNodeTaskHistory(id);
  const [compareState, setCompareState] = useState<CompareState | null>(null);
  const [modalState, setModalState] = useState<{
    open: boolean;
    tab?: FrameImageModalTab;
  }>({ open: false });

  const d = data as unknown as ImageEngineNodeData;
  const isStoryFrame = d.frameIndex != null || d.storyFrameMode;
  const isStoryFrameShot = d.frameIndex != null;

  const productMain = useMemo(
    () => resolveProductMainImage(nodes, edges, id),
    [nodes, edges, id],
  );

  const referenceImages = useMemo<CompareReferenceImage[]>(() => {
    if (!productMain) return [];
    return [{ id: "product-main", url: productMain.url, label: productMain.label }];
  }, [productMain]);

  const activeTask = useMemo(() => {
    if (!history.length) return null;
    if (d.activeTaskId) {
      const t = history.find((x) => x.id === d.activeTaskId);
      if (t) return t;
    }
    return succeeded[succeeded.length - 1] ?? null;
  }, [history, d.activeTaskId, succeeded]);

  const hasGenerated =
    succeeded.length > 0 ||
    d.runtime?.status === "done" ||
    Boolean(d.runtime?.ossUrl);

  const isGenerating =
    d.runtime?.status === "running" || d.runtime?.status === "pending";

  const canCompare =
    succeeded.length >= 2 ||
    (succeeded.length >= 1 && referenceImages.length > 0);

  const chips = sortUpstreamChips(useUpstreamChips(id));
  const mentionables = useMemo<MentionableItem[]>(
    () => chips.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    [chips],
  );

  const referenced = useMemo(
    () => resolveReferencedNodeIds(d.prompt ?? "", chips),
    [d.prompt, chips],
  );

  const openCompare = useCallback((state?: CompareState) => {
    setCompareState(state ?? {});
  }, []);

  const onPickEngine = (next: {
    providerId: string;
    modelKey: string;
    params: Record<string, unknown>;
  }) => {
    updateNodeData(id, {
      providerId: next.providerId,
      modelKey: next.modelKey,
      params: next.params,
    });
  };

  const onPromptChange = (value: string) => {
    updateNodeData(id, {
      prompt: value,
      referencedNodeIds: resolveReferencedNodeIds(value, chips),
    });
  };

  const onApplyTemplate = (tpl: AppliedPromptTemplate) => {
    updateNodeData(id, {
      prompt: tpl.content,
      referencedNodeIds: resolveReferencedNodeIds(tpl.content, chips),
      promptTemplateId: tpl.id,
      promptTemplateNameSnap: tpl.name,
    });
  };

  const onRun = (forceFresh: boolean) => {
    busEnqueueNode(id, forceFresh);
  };

  const frameOutputs = useMemo(
    () =>
      d.frameIndex != null
        ? ([
            { id: "image", label: "分镜图", kind: "image" as const },
            { id: "to_video", label: "→视频", kind: "image" as const },
            { id: "to_audio", label: "→语音", kind: "text" as const },
          ] as const)
        : ([{ id: "image", label: "生成图", kind: "image" as const }] as const),
    [d.frameIndex],
  );

  const onSwitchActive = (taskId: string) => {
    const t = history.find((x) => x.id === taskId);
    if (!t || !t.ossUrl) return;
    updateNodeData(id, {
      activeTaskId: t.id,
      runtime: { ...(d.runtime ?? {}), status: "done", ossUrl: t.ossUrl, taskId: t.id },
    });
  };

  const onDeleteTask = async (taskId: string) => {
    if (!base || !projectId) return;
    const ok = await doubleConfirm({
      first: {
        title: "删除这一次生成结果？",
        message: "本次生成的画作将从历史中移除。",
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 不可恢复",
        message:
          "本次生成图片将被永久删除，包括 云端存储（OSS） 上的原文件，删除后无法恢复。",
        confirmLabel: "永久删除",
        danger: true,
      },
    });
    if (!ok) return;
    try {
      await deleteCanvasTask(base, projectId, taskId);
      if (d.activeTaskId === taskId) {
        updateNodeData(id, { activeTaskId: undefined });
      }
      await refreshHistory();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    }
  };

  const previewUrl =
    activeTask?.ossUrl ?? d.runtime?.ossUrl ?? d.runtime?.ephemeralUrl;

  const activeFrameNum = useMemo(() => {
    if (!activeTask) return null;
    const idx = succeeded.findIndex((t) => t.id === activeTask.id);
    return idx >= 0 ? idx + 1 : succeeded.length;
  }, [activeTask, succeeded]);

  const frameCompareContext = useMemo(
    () =>
      canCompare
        ? {
            tasks: history,
            referenceImages,
            focusTaskId: activeTask?.id,
          }
        : undefined,
    [canCompare, history, referenceImages, activeTask?.id],
  );

  const engineFooter = isStoryFrameShot ? (
    <div className="flex gap-1 border-t border-white/10 pt-2">
      {FRAME_QUICK_ACTIONS.map(({ tab, label, dynamic }) => {
        const text =
          dynamic === "frameImage"
            ? frameImageActionLabel(hasGenerated, isGenerating)
            : label;
        return (
          <button
            key={tab}
            type="button"
            disabled={dynamic === "frameImage" && isGenerating}
            className={NODE_BTN_FRAME_ACTION}
            onClick={() => setModalState({ open: true, tab })}
          >
            {text}
          </button>
        );
      })}
    </div>
  ) : (
    <NodeEngineFooter
      picker={
        <EnginePicker
          role="IMAGE"
          providerId={d.providerId}
          modelKey={d.modelKey}
          params={d.params ?? {}}
          onChange={onPickEngine}
        />
      }
      runLabel="生成"
      runAgainLabel="重新生成"
      isGenerating={isGenerating}
      hasGenerated={hasGenerated}
      runDisabled={!d.providerId || !d.modelKey}
      onRun={() => onRun(hasGenerated)}
    />
  );

  const historyStrip =
    history.length > 0 ? (
      <NodeHistoryStrip label={`历史 · 共 ${history.length} 次`}>
        {history.map((t) => {
          const isActive = activeTask?.id === t.id;
          const ok = t.status === "SUCCEEDED" && (t.ossUrl || t.textOutput);
          return (
            <div
              key={t.id}
              className={cn(
                "group/h relative shrink-0 rounded border",
                isActive ? "border-[var(--canvas-accent)]" : "border-white/10",
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => ok && onSwitchActive(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ok) onSwitchActive(t.id);
                }}
                className={NODE_HISTORY_THUMB}
                title={`${new Date(t.createdAt).toLocaleString()} · ${t.status}`}
              >
                {t.ossUrl ? (
                  <MediaHoverBox
                    src={t.ossUrl}
                    variant="generated"
                    alt={t.id}
                    fit="cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-white/50">
                    {t.status[0]}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => void onDeleteTask(t.id)}
                className="nodrag absolute -right-1 -top-1 hidden rounded-full border border-red-400/60 bg-black/80 p-0.5 text-red-300 hover:bg-red-500/30 group-hover/h:block"
                title="删除（含 OSS）"
              >
                <Trash2 className="size-2.5" />
              </button>
            </div>
          );
        })}
      </NodeHistoryStrip>
    ) : null;

  const errorBlock = d.runtime?.failMessage ? (
    <p className="rounded-md border border-red-400/30 bg-red-500/10 p-2 text-[10px] text-red-200">
      {d.runtime?.failCode ? (
        <code className="mr-1">{d.runtime.failCode}</code>
      ) : null}
      {d.runtime.failMessage}
    </p>
  ) : null;

  return (
    <>
      <NodeShell
        title={
          d.frameIndex
            ? `分镜图 · 镜${d.frameIndex}`
            : d.storyFrameMode
              ? "分镜图"
              : "生图引擎"
        }
        subtitle={d.modelKey || "未选模型"}
        selected={selected}
        engine
        minWidth={isStoryFrameShot ? NODE_STORY_FRAME_MIN_WIDTH : NODE_MEDIA_MIN_WIDTH}
        minHeight={
          isStoryFrameShot ? NODE_STORY_FRAME_MIN_HEIGHT : NODE_MEDIA_ENGINE_HEIGHT
        }
        inputs={[
          { id: "in_text", label: "Prompt 上游", kind: "text" },
          { id: "in_image", label: "参考图（多）", kind: "image" },
        ]}
        outputs={[...frameOutputs]}
        headerRight={
          <EnginePreviewTrigger
            title={d.frameIndex ? `分镜图 · 镜${d.frameIndex}` : "生图引擎"}
            kind="image"
            mediaUrl={previewUrl}
            status={d.runtime?.status}
            failMessage={d.runtime?.failMessage}
            compareContext={
              isStoryFrameShot ? frameCompareContext : undefined
            }
            prompt={isStoryFrameShot ? (d.prompt ?? "") : undefined}
          />
        }
        footer={
          isStoryFrameShot ? (
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <ImageIcon className="size-3 shrink-0 text-[#fb923c]" />
                <span className="truncate text-[var(--canvas-muted)]">
                  分镜图 · 镜{d.frameIndex}
                </span>
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                  isGenerating
                    ? "bg-amber-500/20 text-amber-200"
                    : d.runtime?.status === "done"
                      ? "bg-emerald-500/15 text-emerald-200"
                      : d.runtime?.status === "error"
                        ? "bg-red-500/15 text-red-200"
                        : "bg-white/5 text-[var(--canvas-muted)]"
                }`}
              >
                {frameStatusLabel(d.runtime?.status ?? "idle", isGenerating)}
              </span>
            </div>
          ) : (
            <NodeEngineShellFooter
              hint={`${history.length} 次历史 · 重新生成不会覆盖`}
              tag={isStoryFrame ? "分镜图" : "IMAGE"}
            />
          )
        }
      >
        <NodeEngineLayout engineFooter={engineFooter}>
          {isStoryFrameShot ? (
            <div
              className="flex min-h-0 flex-1 flex-col gap-2"
              style={{ minHeight: NODE_STORY_FRAME_SPLIT_MIN_H }}
            >
              {chips.length > 0 ? (
                <UpstreamChipRow chips={chips} referenced={referenced} />
              ) : null}

              <div className="flex min-h-0 flex-1 gap-2">
                {/* 左 50% · Prompt */}
                <div className="flex min-h-0 w-1/2 flex-col gap-1">
                  <p className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    Prompt
                  </p>
                  <MentionsTextarea
                    value={d.prompt ?? ""}
                    onChange={onPromptChange}
                    mentionables={mentionables}
                    placeholder="分镜画面描述，@ 引用角色三视图"
                    wrapperClassName="flex min-h-0 flex-1 flex-col"
                    className={NODE_STORY_FRAME_PROMPT_CLASS}
                  />
                </div>

                {/* 右 50% · 当前图 */}
                <div className="flex min-h-0 w-1/2 flex-col gap-1">
                  <p className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
                    分镜图
                    {activeFrameNum != null ? ` · #${activeFrameNum}` : ""}
                  </p>
                  <div className="min-h-0 flex-1 rounded-lg border border-white/10 bg-black/40 p-1">
                    {previewUrl ? (
                      <NodeMediaStage fill>
                        <MediaHoverBox
                          src={previewUrl}
                          variant="generated"
                          alt={`镜${d.frameIndex} 分镜图`}
                          fit="contain"
                          clickToPreview
                          prompt={d.prompt ?? ""}
                          compareContext={frameCompareContext}
                        />
                      </NodeMediaStage>
                    ) : (
                      <NodeMediaEmpty
                        fill
                        icon={<ImageIcon className="size-6 opacity-40" />}
                        message={
                          isGenerating ? "生成中…" : "点下方「分镜图生成」"
                        }
                      />
                    )}
                  </div>
                </div>
              </div>

              {historyStrip}
              {errorBlock}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {chips.length > 0 ? (
                <UpstreamChipRow chips={chips} referenced={referenced} />
              ) : null}

              <MentionsTextarea
                value={d.prompt ?? ""}
                onChange={onPromptChange}
                mentionables={mentionables}
                placeholder="prompt（可来自上游 AI 方案 / 用户编辑），@ 可引用"
                rows={3}
                className={NODE_PROMPT_CLASS}
              />
              <PromptTemplatePicker
                engine="IMAGE"
                currentPrompt={d.prompt ?? ""}
                onApply={onApplyTemplate}
              />

              {canCompare ? (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => openCompare()}
                    className={NODE_BTN_ACCENT}
                  >
                    <Split className="size-3" /> 对比
                  </button>
                  {productMain && succeeded.length >= 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        openCompare({
                          defaultLeftId: refSideId("product-main"),
                          defaultRightId: taskSideId(
                            succeeded[succeeded.length - 1]!.id,
                          ),
                        })
                      }
                      className={NODE_BTN_GHOST}
                    >
                      与主图对比
                    </button>
                  ) : null}
                </div>
              ) : null}

              <NodeMediaGallery className="max-h-none min-h-0 flex-1">
                {succeeded.length > 0 ? (
                  succeeded.map((t, idx) => {
                    const isActive = activeTask?.id === t.id;
                    const prev = idx > 0 ? succeeded[idx - 1] : null;
                    return (
                      <NodeMediaItem
                        key={t.id}
                        active={isActive}
                        stage={
                          <NodeMediaStage active={isActive}>
                            <MediaHoverBox
                              src={t.ossUrl!}
                              variant="generated"
                              alt={`生成结果 ${idx + 1}`}
                              fit="contain"
                              clickToPreview
                              compareContext={
                                canCompare
                                  ? {
                                      tasks: history,
                                      referenceImages,
                                      focusTaskId: t.id,
                                    }
                                  : undefined
                              }
                            />
                          </NodeMediaStage>
                        }
                        actions={
                          <>
                            <span className="text-[11px] text-white/50">
                              #{idx + 1}
                            </span>
                            {productMain ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openCompare({
                                    defaultLeftId: refSideId("product-main"),
                                    defaultRightId: taskSideId(t.id),
                                  })
                                }
                                className={NODE_BTN_GHOST}
                              >
                                与主图对比
                              </button>
                            ) : null}
                            {prev ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openCompare({
                                    defaultLeftId: taskSideId(prev.id),
                                    defaultRightId: taskSideId(t.id),
                                  })
                                }
                                className={NODE_BTN_GHOST}
                              >
                                与上一张对比
                              </button>
                            ) : null}
                            <a
                              href={t.ossUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(NODE_BTN_GHOST, "ml-auto")}
                            >
                              <Download className="size-3" /> 下载
                            </a>
                          </>
                        }
                      />
                    );
                  })
                ) : (
                  <NodeMediaEmpty
                    icon={<ImageIcon className="size-6 opacity-40" />}
                  />
                )}
              </NodeMediaGallery>

              {historyStrip}
              {errorBlock}
            </div>
          )}
        </NodeEngineLayout>
      </NodeShell>

      {!isStoryFrameShot && compareState ? (
        <CompareModal
          tasks={history}
          referenceImages={referenceImages}
          defaultLeftId={compareState.defaultLeftId}
          defaultRightId={compareState.defaultRightId}
          onClose={() => setCompareState(null)}
        />
      ) : null}

      {isStoryFrameShot ? (
        <FrameImageActionsModal
          open={modalState.open}
          initialTab={modalState.tab}
          onClose={() => setModalState({ open: false })}
          title={`分镜图 · 镜${d.frameIndex}`}
          imageEngineId={id}
          data={d}
          prompt={d.prompt ?? ""}
          onPromptChange={onPromptChange}
          mentionables={mentionables}
          providerId={d.providerId ?? ""}
          modelKey={d.modelKey ?? ""}
          params={d.params ?? {}}
          onPickEngine={onPickEngine}
          isGenerating={isGenerating}
          hasGenerated={hasGenerated}
          onRunRegenerate={(forceFresh) => onRun(forceFresh)}
          onCloseAfterRun={() => setModalState({ open: false })}
        />
      ) : null}
    </>
  );
}
