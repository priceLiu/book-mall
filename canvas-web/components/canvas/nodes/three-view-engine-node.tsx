"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  AlertTriangle,
  Download,
  ImageIcon,
  Trash2,
  UserRound,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { ThreeViewEngineNodeData } from "@/lib/canvas/types";
import { THREE_VIEW_ENGINE_MODEL_KEYS } from "@/lib/canvas/types";
import { deleteCanvasTask, saveCanvasCharacter } from "@/lib/canvas-api";
import { resolveReferencedNodeIds } from "@/lib/canvas/referenced-nodes";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import {
  pickTaskImagePreviewUrl,
  pickTaskModelDownloadUrl,
  taskHasDisplayableResult,
} from "@/lib/canvas/task-media-url";
import { NodeShell } from "../node-shell";
import { EnginePicker } from "../engine-picker";
import { EnginePreviewTrigger } from "../engine-preview-trigger";
import { MediaHoverBox } from "../media-hover-box";
import {
  MentionsTextarea,
  type MentionableItem,
} from "../mentions/MentionsTextarea";
import { UpstreamChipRow, useUpstreamChips, sortUpstreamChips } from "../upstream-chips";
import {
  NODE_BTN_GHOST,
  NODE_HISTORY_THUMB,
  NODE_SECTION_LABEL,
  NODE_THREE_VIEW_MIN_HEIGHT,
  NODE_THREE_VIEW_MIN_WIDTH,
  NODE_THREE_VIEW_PROMPT_CLASS,
  NodeEngineFooter,
  NodeEngineLayout,
  NodeEngineShellFooter,
  NodeHistoryStrip,
  NodeMediaEmpty,
  NodeMediaStage,
} from "../node-ui";
import { cn } from "@/lib/utils";

const ERROR_TOAST_MS = 8000;
const HEADER_ACTION_BTN = NODE_BTN_GHOST;

/** 三视图生成引擎：上游接参考图，输出标准正/侧/背人设图。 */
export function ThreeViewEngineNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { doubleConfirm, alert, prompt } = useDialogs();

  const { history, succeeded, refreshHistory } = useNodeTaskHistory(id);
  const [errorToast, setErrorToast] = useState<{
    code?: string;
    message: string;
  } | null>(null);

  const d = data as unknown as ThreeViewEngineNodeData;
  const runtimeStatus = d.runtime?.status ?? "idle";
  const isGenerating =
    runtimeStatus === "running" || runtimeStatus === "pending";

  const chips = sortUpstreamChips(
    useUpstreamChips(id).filter((c) => c.kind === "image" || c.kind === "text"),
  );
  const mentionables = useMemo<MentionableItem[]>(
    () => chips.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    [chips],
  );

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
    Boolean(
      pickTaskImagePreviewUrl({
        ossUrl: d.runtime?.ossUrl ?? null,
        ephemeralUrl: d.runtime?.ephemeralUrl ?? null,
        model: d.modelKey ?? "",
      }),
    ) ||
    Boolean(
      pickTaskModelDownloadUrl({
        ossUrl: d.runtime?.ossUrl ?? null,
        ephemeralUrl: d.runtime?.ephemeralUrl ?? null,
        model: d.modelKey ?? "",
      }),
    );

  const canCompare =
    succeeded.length >= 2 ||
    (succeeded.length >= 1 && chips.some((c) => c.thumb));

  const activePreviewUrl = useMemo(() => {
    if (activeTask) return pickTaskImagePreviewUrl(activeTask);
    return pickTaskImagePreviewUrl({
      ossUrl: d.runtime?.ossUrl ?? null,
      ephemeralUrl: d.runtime?.ephemeralUrl ?? null,
      model: d.modelKey ?? "",
    });
  }, [activeTask, d.runtime?.ossUrl, d.runtime?.ephemeralUrl, d.modelKey]);

  const activeModelUrl = useMemo(() => {
    if (!activeTask) return undefined;
    return pickTaskModelDownloadUrl(activeTask);
  }, [activeTask]);

  const activeFrameNum = useMemo(() => {
    if (!activeTask) return null;
    const idx = succeeded.findIndex((t) => t.id === activeTask.id);
    return idx >= 0 ? idx + 1 : succeeded.length;
  }, [activeTask, succeeded]);

  const referenceImages = useMemo(() => {
    const ref = chips.find((c) => c.thumb);
    if (!ref?.thumb) return [];
    return [{ id: `ref-${ref.id}`, url: ref.thumb, label: ref.label }];
  }, [chips]);

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
    const preview = t ? pickTaskImagePreviewUrl(t) : undefined;
    if (!t || (!preview && !pickTaskModelDownloadUrl(t))) return;
    updateNodeData(id, {
      activeTaskId: t.id,
      runtime: {
        ...(d.runtime ?? {}),
        status: "done",
        ossUrl: preview ?? t.ossUrl ?? undefined,
        ephemeralUrl: t.ephemeralUrl ?? undefined,
        taskId: t.id,
      },
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

  const onSaveAsCharacter = useCallback(
    async (task: { id: string; ossUrl: string | null; model: string }) => {
      if (!base || !projectId || !task.ossUrl) return;
      const defaultName =
        d.characterName?.trim() ||
        `角色 ${new Date().toLocaleString("zh-CN", {
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
    },
    [base, projectId, prompt, alert, d.characterName],
  );

  const onSaveActiveAsCharacter = useCallback(async () => {
    if (!activeTask || !activePreviewUrl) return;
    await onSaveAsCharacter({
      id: activeTask.id,
      ossUrl: activePreviewUrl,
      model: activeTask.model,
    });
  }, [activeTask, activePreviewUrl, onSaveAsCharacter]);

  const title = d.characterName ? `三视图 · ${d.characterName}` : "三视图";

  const headerRight = useMemo(() => {
    const extraActions =
      activePreviewUrl || activeModelUrl ? (
        <div className="flex shrink-0 items-center gap-1">
          {errorToast ? (
            <span
              className="inline-flex max-w-[80px] items-center gap-0.5 truncate rounded bg-red-500/20 px-1 py-0.5 text-[9px] text-red-200"
              title={errorToast.message}
            >
              <AlertTriangle className="size-2.5 shrink-0" />
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void onSaveActiveAsCharacter()}
            disabled={!activePreviewUrl}
            className={`${HEADER_ACTION_BTN} border-white/10 px-1 py-0.5 text-[9px] text-white/75 hover:border-white/30 hover:text-white disabled:opacity-40`}
            title="保存为角色"
          >
            <UserRound className="size-2.5" />
          </button>
          {activeModelUrl ? (
            <a
              href={activeModelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${HEADER_ACTION_BTN} border-[var(--canvas-accent)]/40 px-1 py-0.5 text-[9px] text-[var(--canvas-accent-soft)]`}
              title="下载 3D 模型"
            >
              <Download className="size-2.5" />
            </a>
          ) : null}
        </div>
      ) : errorToast ? (
        <span
          className="inline-flex max-w-[100px] truncate rounded bg-red-500/20 px-1 py-0.5 text-[9px] text-red-200"
          title={errorToast.message}
        >
          {errorToast.message}
        </span>
      ) : null;

    return (
      <EnginePreviewTrigger
        title={title}
        kind="image"
        mediaUrl={activePreviewUrl ?? undefined}
        status={runtimeStatus}
        failMessage={d.runtime?.failMessage}
        extra={extraActions}
      />
    );
  }, [
    errorToast,
    runtimeStatus,
    d.runtime?.failMessage,
    title,
    activePreviewUrl,
    activeModelUrl,
    onSaveActiveAsCharacter,
  ]);

  const engineFooter = (
    <NodeEngineFooter
      picker={
        <EnginePicker
          role="IMAGE"
          allowedModelKeys={[...THREE_VIEW_ENGINE_MODEL_KEYS]}
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
    history.length > 1 ? (
      <NodeHistoryStrip label={`历史 · 共 ${history.length} 次`}>
        {history.map((t) => {
          const isActive = activeTask?.id === t.id;
          const preview = pickTaskImagePreviewUrl(t);
          const ok = taskHasDisplayableResult(t);
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
                {preview ? (
                  <MediaHoverBox
                    src={preview}
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
    <NodeShell
      title={title}
      subtitle={d.modelKey || "未选模型"}
      selected={selected}
      engine
      minWidth={NODE_THREE_VIEW_MIN_WIDTH}
      minHeight={NODE_THREE_VIEW_MIN_HEIGHT}
      inputs={[
        { id: "in_text", label: "角色 / Prompt", kind: "text" },
        { id: "in_image", label: "参考图", kind: "image" },
      ]}
      outputs={[{ id: "image", label: "三视图", kind: "image" }]}
      headerRight={headerRight}
      footer={
        <NodeEngineShellFooter
          hint={
            d.characterName
              ? `角色 ${d.characterName} · 正/侧/背 turnaround`
              : "连上游参考图 · 输出正/侧/背三视图"
          }
          tag="三视图"
        />
      }
    >
      <NodeEngineLayout engineFooter={engineFooter}>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          {chips.length > 0 ? (
            <UpstreamChipRow chips={chips} referenced={referenced} />
          ) : null}

          <div className="shrink-0 space-y-1">
            <p className={NODE_SECTION_LABEL}>Prompt</p>
            <MentionsTextarea
              value={d.prompt ?? ""}
              onChange={onPromptChange}
              mentionables={mentionables}
              placeholder="三视图描述，@ 引用上游角色文本或参考图"
              rows={3}
              className={NODE_THREE_VIEW_PROMPT_CLASS}
            />
          </div>

          <div className="flex min-h-[180px] min-h-0 flex-1 flex-col gap-1">
            <p className={NODE_SECTION_LABEL}>
              三视图
              {activeFrameNum != null ? ` · #${activeFrameNum}` : ""}
            </p>
            <div className="min-h-0 flex-1 rounded-lg border border-white/10 bg-black/40 p-1">
              {activePreviewUrl ? (
                <NodeMediaStage fill>
                  <MediaHoverBox
                    src={activePreviewUrl}
                    variant="generated"
                    alt={title}
                    fit="contain"
                    clickToPreview
                    compareContext={
                      canCompare
                        ? {
                            tasks: history,
                            referenceImages,
                            focusTaskId: activeTask?.id,
                          }
                        : undefined
                    }
                  />
                </NodeMediaStage>
              ) : activeModelUrl ? (
                <NodeMediaStage fill>
                  <NodeMediaEmpty
                    icon={
                      <a
                        href={activeModelUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={NODE_BTN_GHOST}
                      >
                        <Download className="size-3" /> 下载 3D 模型
                      </a>
                    }
                    message="已生成 3D 模型，无栅格预览图"
                  />
                </NodeMediaStage>
              ) : (
                <NodeMediaStage fill>
                  <NodeMediaEmpty
                    icon={<ImageIcon className="size-5 opacity-40" />}
                    message={isGenerating ? "生成中…" : "点击底部「生成」"}
                  />
                </NodeMediaStage>
              )}
            </div>
          </div>

          {historyStrip}
          {errorBlock}
        </div>
      </NodeEngineLayout>
    </NodeShell>
  );
}
