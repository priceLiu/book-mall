"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import {
  Download,
  ImageIcon,
  Play,
  RefreshCw,
  Split,
  Trash2,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import type { ImageEngineNodeData } from "@/lib/canvas/types";
import {
  deleteCanvasTask,
  listCanvasProjectTasks,
  type CanvasTaskRecord,
} from "@/lib/canvas-api";
import { RF_NODE_SCROLL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";
import { resolveReferencedNodeIds } from "@/lib/canvas/referenced-nodes";
import { NodeShell } from "../node-shell";
import { CompareModal } from "../compare-modal";
import { EnginePicker } from "../engine-picker";
import { MediaHoverBox } from "../media-hover-box";
import { PromptTemplatePicker } from "../prompt-template-picker";
import type { AppliedPromptTemplate } from "@/lib/canvas-prompt-templates-api";
import {
  MentionsTextarea,
  type MentionableItem,
} from "../mentions/MentionsTextarea";
import { UpstreamChipRow, useUpstreamChips, sortUpstreamChips } from "../upstream-chips";

export function ImageEngineNode({ id, data, selected }: NodeProps) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { doubleConfirm, alert } = useDialogs();

  const [history, setHistory] = useState<CanvasTaskRecord[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const d = data as unknown as ImageEngineNodeData;

  const refreshHistory = useCallback(async () => {
    if (!base || !projectId) return;
    try {
      const tasks = await listCanvasProjectTasks(base, projectId, [id]);
      setHistory(tasks);
    } catch {
      // ignore
    }
  }, [base, projectId, id]);

  // 首次加载 + 每次 runtime 变化时刷新历史
  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory, d.runtime?.taskId, d.runtime?.status]);

  // 历史里 active task 的 OSS URL（不在 runtime 时回退到最新）
  const activeTask = useMemo(() => {
    if (!history.length) return null;
    if (d.activeTaskId) {
      const t = history.find((x) => x.id === d.activeTaskId);
      if (t) return t;
    }
    return history.find((t) => t.status === "SUCCEEDED" && t.ossUrl) ?? null;
  }, [history, d.activeTaskId]);

  const oss = activeTask?.ossUrl ?? d.runtime?.ossUrl ?? "";

  const hasGenerated =
    Boolean(oss) ||
    d.runtime?.status === "done" ||
    history.some((t) => t.status === "SUCCEEDED" && t.ossUrl);

  const chips = sortUpstreamChips(useUpstreamChips(id));
  const mentionables = useMemo<MentionableItem[]>(
    () => chips.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
    [chips],
  );

  const referenced = useMemo(
    () => resolveReferencedNodeIds(d.prompt ?? "", chips),
    [d.prompt, chips],
  );

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

  return (
    <>
      <NodeShell
        title="生图引擎"
        subtitle={d.modelKey || "未选模型"}
        selected={selected}
        runtime={d.runtime}
        engine
        minWidth={360}
        minHeight={520}
        inputs={[
          { id: "in_text", label: "Prompt 上游", kind: "text" },
          { id: "in_image", label: "参考图（多）", kind: "image" },
        ]}
        outputs={[{ id: "image", label: "生成图", kind: "image" }]}
        footer={
          <div className="flex items-center justify-between">
            <span>{history.length} 次历史 · 重新生成不会覆盖</span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[var(--canvas-muted)]">
              IMAGE
            </span>
          </div>
        }
      >
        <div className="flex h-full flex-col gap-2">
          {/* 1. 上游 chip 行 */}
          {chips.length > 0 ? (
            <UpstreamChipRow chips={chips} referenced={referenced} />
          ) : null}

          {/* 2. prompt 输入 */}
          <MentionsTextarea
            value={d.prompt ?? ""}
            onChange={onPromptChange}
            mentionables={mentionables}
            placeholder="prompt（可来自上游 AI 方案 / 用户编辑），@ 可引用"
            rows={4}
            className={`${RF_NODE_SCROLL} max-h-[160px] min-h-[72px] w-full resize-y rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[12px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
          />
          <PromptTemplatePicker
            engine="IMAGE"
            currentPrompt={d.prompt ?? ""}
            onApply={onApplyTemplate}
          />

          {/* 3. 结果预览（占据剩余空间） */}
          <div className="min-h-[180px] flex-1 overflow-hidden rounded-lg border border-white/10 bg-black">
            <MediaHoverBox
              src={oss || undefined}
              variant="generated"
              alt="生成结果"
              placeholder={
                <div className="flex h-full items-center justify-center text-[var(--canvas-muted)]">
                  <ImageIcon className="size-6 opacity-40" />
                </div>
              }
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {oss ? (
              <a
                href={oss}
                target="_blank"
                rel="noopener noreferrer"
                className="nodrag inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/80 hover:border-white/30 hover:text-white"
              >
                <Download className="size-3" /> 下载
              </a>
            ) : null}
            {history.filter((t) => t.status === "SUCCEEDED" && t.ossUrl).length >= 2 ? (
              <button
                type="button"
                onClick={() => setCompareOpen(true)}
                className="nodrag inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/80 hover:border-white/30 hover:text-white"
              >
                <Split className="size-3" /> 对比
              </button>
            ) : null}
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

          {d.runtime?.failMessage ? (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 p-2 text-[10px] text-red-200">
              {d.runtime?.failCode ? <code className="mr-1">{d.runtime.failCode}</code> : null}
              {d.runtime.failMessage}
            </p>
          ) : null}

          {/* 5. 模型选择 + 生成按钮（贴底） */}
          <div className="mt-1 space-y-1.5 border-t border-white/5 pt-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
              选择模型
            </p>
            <EnginePicker
              role="IMAGE"
              providerId={d.providerId}
              modelKey={d.modelKey}
              params={d.params ?? {}}
              onChange={onPickEngine}
            />
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
                  <Play className="size-3" /> 生成
                </>
              )}
            </button>
          </div>
        </div>
      </NodeShell>

      {compareOpen ? (
        <CompareModal tasks={history} onClose={() => setCompareOpen(false)} />
      ) : null}
    </>
  );
}
