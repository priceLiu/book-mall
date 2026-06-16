"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { GenerationRecordMediaPreview } from "@/components/canvas/generation-record-media-preview";
import {
  formatCanvasApiError,
  listCanvasGenerationRecords,
  type CanvasGenerationRecord,
} from "@/lib/canvas-api";
import {
  buildGenerationRecordCanvasHref,
  canRestoreGenerationRecordCanvas,
  fetchGenerationRecordCanvas,
  generationRecordDisplayTitle,
} from "@/lib/canvas/restore-generation-record";
import { useCanvasStore } from "@/lib/canvas/store";
import { resolveGenerationRecordPreview } from "@/lib/canvas/generation-record-preview";
import {
  generationRecordNodePresentLabel,
  resolveGenerationRecordNodePresent,
} from "@/lib/canvas/generation-record-node-present";

type TabId = "project" | "today";

function statusLabel(status: CanvasGenerationRecord["status"]): string {
  switch (status) {
    case "SUCCEEDED":
      return "成功";
    case "FAILED":
      return "失败";
    case "PENDING":
      return "排队中";
    case "SUBMITTED":
      return "生成中";
    case "CANCELLED":
      return "已取消";
    default:
      return status;
  }
}

function statusTone(status: CanvasGenerationRecord["status"]): string {
  switch (status) {
    case "SUCCEEDED":
      return "text-emerald-300 border-emerald-400/30 bg-emerald-500/10";
    case "FAILED":
      return "text-red-300 border-red-400/30 bg-red-500/10";
    case "PENDING":
    case "SUBMITTED":
      return "text-violet-300 border-violet-400/30 bg-violet-500/10";
    default:
      return "text-white/60 border-white/15 bg-white/5";
  }
}

function formatFailMessage(raw: string | null | undefined): string {
  if (!raw?.trim()) return "生成失败";
  try {
    const j = JSON.parse(raw) as { error?: string; message?: string };
    return j.error ?? j.message ?? raw.slice(0, 160);
  } catch {
    return raw.slice(0, 160);
  }
}

function RecordRow({
  item,
  showProject,
  currentProjectId,
  nodePresent,
  onLocate,
  onRestoreCanvas,
  restoring,
}: {
  item: CanvasGenerationRecord;
  showProject: boolean;
  currentProjectId: string;
  nodePresent: boolean | null;
  onLocate: (item: CanvasGenerationRecord) => void;
  onRestoreCanvas: (item: CanvasGenerationRecord) => void;
  restoring: boolean;
}) {
  const title = generationRecordDisplayTitle(item);
  const hasMedia = resolveGenerationRecordPreview(item).previewMedia.length > 0;
  const canRestoreCanvas = canRestoreGenerationRecordCanvas(item);
  const nodePresentLabel = generationRecordNodePresentLabel(
    nodePresent,
    canRestoreCanvas,
  );
  const targetProjectId = item.projectId ?? currentProjectId;
  const isOtherProject = Boolean(
    item.projectId && item.projectId !== currentProjectId,
  );

  return (
    <li className="rounded-lg border border-white/10 bg-black/25 p-3">
      <div className="flex items-start gap-3">
        {hasMedia ? (
          <GenerationRecordMediaPreview item={item} title={title} />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30">
            {item.status === "FAILED" ? (
              <AlertCircle className="size-5 text-red-400/80" />
            ) : item.status === "SUCCEEDED" ? (
              <CheckCircle2 className="size-5 text-emerald-400/80" />
            ) : (
              <Loader2 className="size-5 animate-spin text-violet-300/80" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] ${statusTone(item.status)}`}
            >
              {statusLabel(item.status)}
            </span>
            <span className="truncate text-[12px] font-medium text-white/90">
              {title}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/45">
            {new Date(item.createdAt).toLocaleString("zh-CN")}
            {showProject && item.projectName
              ? ` · ${item.projectName}`
              : ""}
            {item.nodeId ? ` · 节点 ${item.nodeId.slice(0, 8)}…` : ""}
          </p>
          {nodePresentLabel ? (
            <p
              className={`mt-1 text-[11px] ${
                nodePresent
                  ? "text-emerald-200/75"
                  : canRestoreCanvas
                    ? "text-amber-200/80"
                    : "text-white/45"
              }`}
            >
              {nodePresentLabel}
            </p>
          ) : null}
          {item.status === "FAILED" ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-red-200/75">
              {formatFailMessage(item.failMessage)}
            </p>
          ) : item.textOutput?.trim() ? (
            <p className="mt-1 line-clamp-2 text-[11px] text-white/55">
              {item.textOutput.trim().slice(0, 120)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {item.nodeId ? (
              <button
                type="button"
                onClick={() => onLocate(item)}
                className="inline-flex items-center gap-1 rounded-md border border-white/12 px-2 py-1 text-[10px] text-white/70 hover:bg-white/8"
              >
                {isOtherProject ? (
                  <ExternalLink className="size-3" />
                ) : (
                  <MapPin className="size-3" />
                )}
                定位节点
              </button>
            ) : null}
            {canRestoreCanvas ? (
              <button
                type="button"
                disabled={restoring}
                onClick={() => onRestoreCanvas(item)}
                className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-100 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                {restoring ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RotateCcw className="size-3" />
                )}
                恢复画布
              </button>
            ) : (
              <span className="text-[10px] text-white/35">
                无画布快照（新发起的生成会自动保存）
              </span>
            )}
          </div>
          {isOtherProject && targetProjectId ? (
            <p className="mt-1 text-[10px] text-white/35">
              位于其他画布 ·{" "}
              <Link
                href={`/canvas/${targetProjectId}`}
                className="text-emerald-200/80 hover:underline"
              >
                打开画布
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function MyCanvasGenerationRecordsPanel({
  open,
  onClose,
  projectId,
  onRestoreCanvas,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onRestoreCanvas: (canvas: unknown) => void | Promise<void>;
}) {
  const base = useBookMallBaseUrl();
  const router = useRouter();
  const { alert, doubleConfirm } = useDialogs();
  const focusCanvasNode = useCanvasStore((s) => s.focusCanvasNode);
  const liveNodeIdList = useCanvasStore((s) => s.nodes.map((n) => n.id));
  const liveNodeIds = useMemo(() => new Set(liveNodeIdList), [liveNodeIdList]);
  const [tab, setTab] = useState<TabId>("today");
  const [projectTasks, setProjectTasks] = useState<CanvasGenerationRecord[]>(
    [],
  );
  const [todayTasks, setTodayTasks] = useState<CanvasGenerationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const reload = useCallback(async () => {
    if (!base || !projectId) return;
    setLoading(true);
    try {
      const data = await listCanvasGenerationRecords(base, projectId);
      setProjectTasks(data.projectTasks);
      setTodayTasks(data.todayTasks);
      setListError(null);
    } catch (e) {
      setProjectTasks([]);
      setTodayTasks([]);
      setListError(formatCanvasApiError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [base, projectId]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  const onLocate = useCallback(
    async (item: CanvasGenerationRecord) => {
      if (!item.nodeId) return;
      const href = buildGenerationRecordCanvasHref(item, projectId, "focus");
      if (href && item.projectId && item.projectId !== projectId) {
        onClose();
        router.push(href);
        return;
      }
      const present = resolveGenerationRecordNodePresent(
        item,
        projectId,
        liveNodeIds,
      );
      if (present === false) {
        const canRestore = canRestoreGenerationRecordCanvas(item);
        await alert({
          title: "当前画布上找不到该节点",
          message: canRestore
            ? "该节点已不在当前画布上。若需找回节点与连线，请点击本条记录的「恢复画布」。"
            : "该节点已不在当前画布上。本记录无画布快照，可尝试在「我的历史」中按时间查找。",
          variant: "warning",
        });
        return;
      }
      focusCanvasNode(item.nodeId);
      onClose();
    },
    [alert, focusCanvasNode, liveNodeIds, onClose, projectId, router],
  );

  const onRestoreCanvasItem = useCallback(
    async (item: CanvasGenerationRecord) => {
      if (!base || !canRestoreGenerationRecordCanvas(item)) return;
      const href = buildGenerationRecordCanvasHref(
        item,
        projectId,
        "restoreCanvas",
      );
      if (href && item.projectId && item.projectId !== projectId) {
        onClose();
        router.push(href);
        return;
      }

      const ok = await doubleConfirm({
        first: {
          title: "恢复此生成时的画布？",
          message: `将用 ${new Date(item.createdAt).toLocaleString("zh-CN")} 的快照覆盖当前画布（含节点、提示词与连线）。`,
          confirmLabel: "继续",
          danger: true,
        },
        second: {
          title: "再次确认 · 不可撤销",
          message:
            "恢复后当前未保存的编辑会丢失。建议先手动保存当前状态。是否继续？",
          confirmLabel: "恢复画布",
          danger: true,
        },
      });
      if (!ok) return;

      setRestoringId(item.id);
      try {
        const fetched = await fetchGenerationRecordCanvas(base, item, projectId);
        if (!fetched.ok) {
          await alert({
            title: "无法恢复画布",
            message: fetched.message,
            variant: "warning",
          });
          return;
        }
        await onRestoreCanvas(fetched.canvas);
        if (item.nodeId) {
          focusCanvasNode(item.nodeId);
        }
        onClose();
      } catch (e) {
        await alert({
          title: "恢复失败",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      } finally {
        setRestoringId(null);
      }
    },
    [
      alert,
      base,
      doubleConfirm,
      focusCanvasNode,
      onClose,
      onRestoreCanvas,
      projectId,
      router,
    ],
  );

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      if (openRef.current) void reload();
    }, 8000);
    return () => window.clearInterval(id);
  }, [open, reload]);

  if (!open) return null;

  const items = tab === "project" ? projectTasks : todayTasks;

  return (
    <div
      className="fixed inset-0 z-[1450] flex justify-end bg-black/45"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-emerald-400/15 bg-[var(--canvas-surface)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="生成记录"
      >
        <header className="flex items-center justify-between border-b border-emerald-400/15 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-300" />
            <p className="text-sm font-medium">生成记录</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--canvas-muted)] hover:bg-white/5 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex gap-1 border-b border-white/8 px-3 py-2">
          <button
            type="button"
            onClick={() => setTab("today")}
            className={`rounded-md px-3 py-1.5 text-[11px] ${
              tab === "today"
                ? "bg-emerald-500/20 text-emerald-100"
                : "text-white/55 hover:bg-white/8"
            }`}
          >
            今日全部 ({todayTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("project")}
            className={`rounded-md px-3 py-1.5 text-[11px] ${
              tab === "project"
                ? "bg-emerald-500/20 text-emerald-100"
                : "text-white/55 hover:bg-white/8"
            }`}
          >
            本项目 ({projectTasks.length})
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {listError ? (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              {listError}
            </p>
          ) : null}
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-white/45">
              <Loader2 className="size-4 animate-spin" />
              加载生成记录…
            </div>
          ) : items.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-[var(--canvas-muted)]">
              {tab === "project"
                ? "本项目还没有生成记录。在节点上点击生成后，成功与失败都会出现在这里。"
                : "今天还没有生成记录。"}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <RecordRow
                  key={item.id}
                  item={item}
                  showProject={tab === "today"}
                  currentProjectId={projectId}
                  nodePresent={resolveGenerationRecordNodePresent(
                    item,
                    projectId,
                    liveNodeIds,
                  )}
                  onLocate={(record) => void onLocate(record)}
                  onRestoreCanvas={(record) => void onRestoreCanvasItem(record)}
                  restoring={restoringId === item.id}
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/8 px-4 py-3">
          <span className="inline-flex items-center gap-1 text-[10px] text-white/40">
            <Clapperboard className="size-3" />
            含成功与失败 · 可恢复整图快照 · 每 8 秒自动刷新
          </span>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-md border border-white/12 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/8"
          >
            刷新
          </button>
        </footer>
      </aside>
    </div>
  );
}
