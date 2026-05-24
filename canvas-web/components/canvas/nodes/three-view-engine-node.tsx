"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  AlertTriangle,
  Download,
  ImageIcon,
  Play,
  RefreshCw,
  Split,
  Trash2,
  UserRound,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { ThreeViewEngineNodeData } from "@/lib/canvas/types";
import { THREE_VIEW_ENGINE_MODEL_KEYS } from "@/lib/canvas/types";
import { deleteCanvasTask, saveCanvasCharacter } from "@/lib/canvas-api";
import { RF_NODE_SCROLL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { resolveReferencedNodeIds } from "@/lib/canvas/referenced-nodes";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { useAutoFitNodeSize } from "@/lib/canvas/use-auto-fit-node-size";
import { NodeShell, NodeStatusBadge } from "../node-shell";
import {
  CompareModal,
  type CompareReferenceImage,
} from "../compare-modal";
import { EnginePicker } from "../engine-picker";
import { MediaHoverBox } from "../media-hover-box";
import {
  MentionsTextarea,
  type MentionableItem,
} from "../mentions/MentionsTextarea";
import { UpstreamChipRow, useUpstreamChips, sortUpstreamChips } from "../upstream-chips";

type CompareState = {
  defaultLeftId?: string;
  defaultRightId?: string;
};

/** 三视图节点壳层 + 控件区（不含图片展示区） */
const THREE_VIEW_CHROME_HEIGHT = 292;
const THREE_VIEW_PER_IMAGE_CHROME = 0;
const ERROR_TOAST_MS = 8000;

const HEADER_ACTION_BTN =
  "nodrag inline-flex shrink-0 items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] transition";

/** 三视图生成引擎：上游接参考图，输出标准正/侧/背人设图。 */
export function ThreeViewEngineNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { doubleConfirm, alert, prompt } = useDialogs();

  const { history, succeeded, refreshHistory } = useNodeTaskHistory(id);
  const [compareState, setCompareState] = useState<CompareState | null>(null);
  const [errorToast, setErrorToast] = useState<{
    code?: string;
    message: string;
  } | null>(null);

  const d = data as unknown as ThreeViewEngineNodeData;
  const runtimeStatus = d.runtime?.status ?? "idle";

  const chips = sortUpstreamChips(
    useUpstreamChips(id).filter((c) => c.kind === "image"),
  );
  const mentionables = useMemo<MentionableItem[]>(
    () => chips.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    [chips],
  );

  const referenceImages = useMemo<CompareReferenceImage[]>(() => {
    const ref = chips.find((c) => c.thumb);
    if (!ref?.thumb) return [];
    return [{ id: `ref-${ref.id}`, url: ref.thumb, label: ref.label }];
  }, [chips]);

  const referenced = useMemo(
    () => resolveReferencedNodeIds(d.prompt ?? "", chips),
    [d.prompt, chips],
  );

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

  const canCompare = succeeded.length >= 2;

  const fitImageUrls = useMemo(() => {
    const url = activeTask?.ossUrl ?? succeeded[succeeded.length - 1]?.ossUrl;
    return url ? [url] : [];
  }, [activeTask?.ossUrl, succeeded]);

  const fitChromeHeight =
    THREE_VIEW_CHROME_HEIGHT +
    (canCompare ? 44 : 0) +
    (history.length > 0 ? 72 : 0);

  useEffect(() => {
    if (runtimeStatus === "running" || runtimeStatus === "pending") {
      setErrorToast(null);
      return;
    }
    if (runtimeStatus !== "error" || !d.runtime?.failMessage) return;
    setErrorToast({
      code: d.runtime.failCode,
      message: d.runtime.failMessage,
    });
    const timer = window.setTimeout(() => setErrorToast(null), ERROR_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [runtimeStatus, d.runtime?.failCode, d.runtime?.failMessage]);

  useAutoFitNodeSize(id, {
    imageUrls: fitImageUrls,
    chromeHeight: fitChromeHeight,
    perImageChrome: fitImageUrls.length > 0 ? THREE_VIEW_PER_IMAGE_CHROME : 0,
    minWidth: 360,
    minHeight: 420,
    maxWidth: 760,
  });

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

  const onRun = (forceFresh: boolean) => {
    window.dispatchEvent(
      new CustomEvent("canvas:run-node", {
        detail: { nodeId: id, forceFresh },
      }),
    );
  };

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
        message: "本次三视图将从历史中移除。",
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

  const onSaveAsCharacter = useCallback(async (task: {
    id: string;
    ossUrl: string | null;
    model: string;
  }) => {
    if (!base || !projectId || !task.ossUrl) return;
    const defaultName = `角色 ${new Date().toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    const name = await prompt({
      title: "保存为角色",
      message: "角色三视图将加入「我的角色」与画廊，可在画布快速插入图片节点。",
      label: "角色名",
      defaultValue: defaultName,
      placeholder: "请输入角色名",
      confirmLabel: "保存",
      validate: (v) => (v.trim() ? null : "角色名不能为空"),
    });
    if (!name) return;
    try {
      await saveCanvasCharacter(base, {
        name: name.trim(),
        imageUrl: task.ossUrl,
        model: task.model,
        sourceTaskId: task.id,
        sourceProjectId: projectId,
      });
      window.dispatchEvent(new CustomEvent("canvas:characters-changed"));
      await alert({
        title: "已保存",
        message: "角色已保存，可在工具栏「我的角色」或画廊中查看。",
        variant: "success",
      });
    } catch (e) {
      await alert({
        title: "保存失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    }
  }, [base, projectId, prompt, alert]);

  const onSaveActiveAsCharacter = useCallback(async () => {
    if (!activeTask?.ossUrl) return;
    await onSaveAsCharacter({
      id: activeTask.id,
      ossUrl: activeTask.ossUrl,
      model: activeTask.model,
    });
  }, [activeTask, onSaveAsCharacter]);

  const headerRight = useMemo(() => {
    if (errorToast) {
      const label = errorToast.code
        ? `${errorToast.code} · ${errorToast.message}`
        : errorToast.message;
      return (
        <span
          className="inline-flex max-w-[min(240px,42vw)] items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-200"
          title={label}
        >
          <AlertTriangle className="size-3 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
      );
    }
    if (runtimeStatus === "running" || runtimeStatus === "pending") {
      return (
        <NodeStatusBadge
          status={runtimeStatus}
          message={d.runtime?.failMessage ?? null}
        />
      );
    }
    if (activeTask?.ossUrl) {
      const isHunyuan3d =
        activeTask.model === "hunyuan-3d-pro" ||
        activeTask.model === "hunyuan-3d-express";
      const has3d =
        isHunyuan3d &&
        activeTask.ephemeralUrl &&
        activeTask.ephemeralUrl !== activeTask.ossUrl;
      return (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void onSaveActiveAsCharacter()}
            className={`${HEADER_ACTION_BTN} border-white/10 text-white/75 hover:border-white/30 hover:text-white`}
          >
            <UserRound className="size-2.5" /> 保存角色
          </button>
          {has3d ? (
            <a
              href={activeTask.ephemeralUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className={`${HEADER_ACTION_BTN} border-[var(--canvas-accent)]/40 text-[var(--canvas-accent-soft)] hover:border-[var(--canvas-accent)]/70`}
            >
              <Download className="size-2.5" /> 3D
            </a>
          ) : null}
          <a
            href={activeTask.ossUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${HEADER_ACTION_BTN} border-white/10 text-white/75 hover:border-white/30 hover:text-white`}
          >
            <Download className="size-2.5" />{" "}
            {isHunyuan3d ? "预览图" : "下载"}
          </a>
        </div>
      );
    }
    return null;
  }, [
    errorToast,
    runtimeStatus,
    d.runtime?.failMessage,
    activeTask,
    onSaveActiveAsCharacter,
  ]);

  return (
    <>
      <NodeShell
        title="三视图"
        subtitle={d.modelKey || "未选模型"}
        selected={selected}
        runtime={d.runtime}
        engine
        minWidth={360}
        minHeight={420}
        inputs={[{ id: "in_image", label: "参考图", kind: "image" }]}
        outputs={[{ id: "image", label: "三视图", kind: "image" }]}
        headerRight={headerRight}
      >
        <div className="flex h-full flex-col gap-2">
          {chips.length > 0 ? (
            <UpstreamChipRow chips={chips} referenced={referenced} />
          ) : (
            <p className="rounded-md border border-dashed border-white/15 bg-black/20 px-2 py-1.5 text-[11px] text-[var(--canvas-muted)]">
              请从上游「图片」节点连入参考图
            </p>
          )}

          <MentionsTextarea
            value={d.prompt ?? ""}
            onChange={onPromptChange}
            mentionables={mentionables}
            placeholder="三视图描述（默认已填，可编辑风格 / 体型 / 服饰等）"
            rows={4}
            className={`${RF_NODE_SCROLL} max-h-[140px] min-h-[80px] w-full resize-y rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[12px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
          />

          {canCompare ? (
            <button
              type="button"
              onClick={() => openCompare()}
              className="nodrag inline-flex w-fit items-center gap-1.5 rounded-md border border-[var(--canvas-accent)]/40 bg-[var(--canvas-accent)]/10 px-2.5 py-1.5 text-[11px] font-medium text-white hover:border-[var(--canvas-accent)]/70 hover:bg-[var(--canvas-accent)]/20"
            >
              <Split className="size-3.5" /> 对比历史
            </button>
          ) : null}

          <div
            className={`min-h-[220px] flex-1 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-1.5 ${RF_NODE_SCROLL}`}
          >
            {succeeded.length > 0 ? (
              succeeded.map((t, idx) => (
                <div
                  key={t.id}
                  className={`overflow-hidden rounded-md border ${
                    activeTask?.id === t.id
                      ? "border-[var(--canvas-accent)]"
                      : "border-white/10"
                  }`}
                >
                  <MediaHoverBox
                    src={t.ossUrl!}
                    variant="generated"
                    alt={`三视图 ${idx + 1}`}
                    naturalSize
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
                </div>
              ))
            ) : (
              <div className="flex h-full min-h-[140px] items-center justify-center text-[var(--canvas-muted)]">
                <ImageIcon className="size-6 opacity-40" />
              </div>
            )}
          </div>

          {history.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
                历史 · 共 {history.length} 次
              </p>
              <div className={`flex gap-1 overflow-x-auto pb-1 ${RF_NO_WHEEL}`}>
                {history.map((t) => {
                  const isActive = activeTask?.id === t.id;
                  const ok =
                    t.status === "SUCCEEDED" && (t.ossUrl || t.textOutput);
                  return (
                    <div
                      key={t.id}
                      className={`group/h relative shrink-0 rounded border ${
                        isActive
                          ? "border-[var(--canvas-accent)]"
                          : "border-white/10"
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => ok && onSwitchActive(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && ok) onSwitchActive(t.id);
                        }}
                        className="relative size-12 cursor-pointer overflow-hidden rounded bg-black/60"
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
              </div>
            </div>
          ) : null}

          <div className="mt-1 shrink-0 space-y-1.5 border-t border-white/5 pt-2">
            <div className="flex items-center gap-2">
              <p className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
                模型
              </p>
              <div className="min-w-0 flex-1">
                <EnginePicker
                  role="IMAGE"
                  allowedModelKeys={[...THREE_VIEW_ENGINE_MODEL_KEYS]}
                  providerId={d.providerId}
                  modelKey={d.modelKey}
                  params={d.params ?? {}}
                  onChange={onPickEngine}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRun(hasGenerated)}
              disabled={!d.providerId || !d.modelKey}
              title={hasGenerated ? "跳过缓存，强制创建新任务" : undefined}
              className="nodrag inline-flex w-full items-center justify-center gap-1 rounded-md bg-[var(--canvas-accent)] px-2 py-1.5 text-[12px] font-medium text-black hover:bg-[var(--canvas-accent-soft)] hover:text-white disabled:opacity-50"
            >
              {hasGenerated ? (
                <>
                  <RefreshCw className="size-3" /> 重新生成
                </>
              ) : (
                <>
                  <Play className="size-3" /> 生成三视图
                </>
              )}
            </button>
          </div>
        </div>
      </NodeShell>

      {compareState ? (
        <CompareModal
          tasks={history}
          referenceImages={referenceImages}
          defaultLeftId={compareState.defaultLeftId}
          defaultRightId={compareState.defaultRightId}
          onClose={() => setCompareState(null)}
        />
      ) : null}
    </>
  );
}
