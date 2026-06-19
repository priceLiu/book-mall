"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, History, Loader2, RotateCcw, Trash2, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  ProjectAssetHoverPreviewLayer,
  useProjectAssetHoverPreview,
} from "@/components/canvas/project-asset-hover-preview";
import { ProjectCoverMedia } from "@/components/canvas/project-cover-media";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  deleteCanvasProjectHistoryEntry,
  formatCanvasApiError,
  getCanvasProjectHistoryEntry,
  listCanvasProjectHistory,
  type CanvasProjectHistoryMeta,
  type CanvasProjectHistorySummary,
} from "@/lib/canvas-api";
import {
  CANVAS_AUTOSAVE_DEBOUNCE_MS,
  CANVAS_AUTOSAVE_INTERVAL_OPTIONS,
  CANVAS_PROJECT_HISTORY_MAX,
  formatCanvasAutosaveIntervalLabel,
  getCanvasAutosaveIntervalMs,
  setCanvasAutosaveIntervalMs,
} from "@/lib/canvas/canvas-autosave-settings";

type HistoryTab = "autosave" | "manual";

export function MyCanvasHistoryPanel({
  open,
  onClose,
  projectId,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onRestore: (canvas: unknown) => void | Promise<void>;
}) {
  const base = useBookMallBaseUrl();
  const { alert, doubleConfirm } = useDialogs();
  const { hoverPreview, showHoverPreview, hideHoverPreview } =
    useProjectAssetHoverPreview(true);
  const [tab, setTab] = useState<HistoryTab>("autosave");
  const [items, setItems] = useState<CanvasProjectHistorySummary[]>([]);
  const [meta, setMeta] = useState<CanvasProjectHistoryMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [intervalMs, setIntervalMs] = useState(getCanvasAutosaveIntervalMs);
  const openRef = useRef(open);
  openRef.current = open;

  const reload = useCallback(async () => {
    if (!base || !projectId) return;
    setLoading(true);
    try {
      const data = await listCanvasProjectHistory(base, projectId, { source: tab });
      setItems(data.items);
      setMeta(data.meta);
      setListError(null);
    } catch (e) {
      setItems([]);
      setMeta(null);
      setListError(formatCanvasApiError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [base, projectId, tab]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  useEffect(() => {
    const sync = () => setIntervalMs(getCanvasAutosaveIntervalMs());
    window.addEventListener("canvas:autosave-interval-changed", sync);
    return () =>
      window.removeEventListener("canvas:autosave-interval-changed", sync);
  }, []);

  useEffect(() => {
    const onHistoryUpdated = () => {
      if (openRef.current) void reload();
    };
    window.addEventListener("canvas:history-updated", onHistoryUpdated);
    return () =>
      window.removeEventListener("canvas:history-updated", onHistoryUpdated);
  }, [reload]);

  const onIntervalChange = (ms: number) => {
    setCanvasAutosaveIntervalMs(ms);
    setIntervalMs(ms);
  };

  const onRestoreItem = async (item: CanvasProjectHistorySummary) => {
    if (!base) return;
    const ok = await doubleConfirm({
      first: {
        title: "恢复此历史版本？",
        message: `将用「${item.label}」（${new Date(item.createdAt).toLocaleString("zh-CN")}）覆盖当前画布。`,
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 不可撤销",
        message:
          "恢复后当前未保存的编辑会丢失。建议先手动保存当前状态。是否继续？",
        confirmLabel: "恢复此版本",
        danger: true,
      },
    });
    if (!ok) return;

    setRestoringId(item.id);
    try {
      const detail = await getCanvasProjectHistoryEntry(base, projectId, item.id);
      await onRestore(detail.canvas);
      onClose();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const message = raw.includes("history not found")
        ? "该历史版本已不存在（可能已被新版本顶出）。请刷新列表后重试。"
        : raw.includes("404")
          ? formatCanvasApiError(raw)
          : raw;
      await alert({
        title: "恢复失败",
        message,
        variant: "error",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const onDeleteItem = async (item: CanvasProjectHistorySummary) => {
    if (!base) return;
    const ok = await doubleConfirm({
      first: {
        title: "删除此手动保存？",
        message: `将删除「${item.label}」（${new Date(item.createdAt).toLocaleString("zh-CN")}）。`,
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 不可恢复",
        message: "删除后无法从列表恢复该版本。是否继续？",
        confirmLabel: "删除",
        danger: true,
      },
    });
    if (!ok) return;

    setDeletingId(item.id);
    try {
      await deleteCanvasProjectHistoryEntry(base, projectId, item.id);
      await reload();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (!open) return null;

  const tabCount =
    tab === "manual" ? meta?.manualCount ?? items.length : meta?.autosaveCount ?? items.length;

  return (
    <div
      className="fixed inset-0 z-[1450] flex justify-end bg-black/45"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-violet-400/15 bg-[var(--canvas-surface)] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="我的历史"
      >
        <header className="flex items-center justify-between border-b border-violet-400/15 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-violet-300" />
            <p className="text-sm font-medium">我的历史</p>
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
            onClick={() => setTab("autosave")}
            className={`rounded-md px-3 py-1.5 text-[11px] ${
              tab === "autosave"
                ? "bg-violet-500/20 text-violet-100"
                : "text-white/55 hover:bg-white/8"
            }`}
          >
            自动保存 ({meta?.autosaveCount ?? 0}/{CANVAS_PROJECT_HISTORY_MAX})
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`rounded-md px-3 py-1.5 text-[11px] ${
              tab === "manual"
                ? "bg-violet-500/20 text-violet-100"
                : "text-white/55 hover:bg-white/8"
            }`}
          >
            手动保存 ({meta?.manualCount ?? 0}/{CANVAS_PROJECT_HISTORY_MAX})
          </button>
        </div>

        <div className="border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] text-white/55">
            <Clock className="size-3.5" />
            <span>自动保存间隔</span>
          </div>
          <select
            value={String(intervalMs)}
            onChange={(e) => onIntervalChange(Number.parseInt(e.target.value, 10))}
            className="nodrag mt-2 w-full rounded-lg border border-white/12 bg-black/40 px-3 py-2 text-[12px] text-white focus:border-violet-400/50 focus:outline-none"
          >
            {CANVAS_AUTOSAVE_INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.ms}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[10px] leading-relaxed text-white/40">
            自动与手动各保留 {CANVAS_PROJECT_HISTORY_MAX} 条，互不影响。手动保存满
            {CANVAS_PROJECT_HISTORY_MAX} 条时，继续保存会提示覆盖最旧一条，也可在此删除旧版本。
            {intervalMs === 0
              ? " 当前：仅手动保存会写入「手动保存」历史。"
              : ` 当前：编辑停顿约 ${CANVAS_AUTOSAVE_DEBOUNCE_MS / 1000} 秒后写入「自动保存」；另约每 ${formatCanvasAutosaveIntervalLabel(intervalMs)} 补一条备份。`}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {listError ? (
            <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
              {listError}
            </p>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-white/45">
              <Loader2 className="size-4 animate-spin" />
              加载历史…
            </div>
          ) : items.length === 0 ? (
            <p className="text-[12px] leading-relaxed text-[var(--canvas-muted)]">
              {tab === "manual"
                ? "还没有手动保存。点击工具栏「手动保存」后，版本会出现在这里（最多 20 条）。"
                : intervalMs <= 0
                  ? "已关闭自动保存历史。可在上方改间隔；画布仍会在编辑后自动落盘到项目。"
                  : "还没有自动保存记录。编辑停顿约 1.5 秒后会写入一条快照（最多 20 条）。"}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-violet-400/15 bg-violet-950/20 p-3"
                >
                  <div className="flex items-start gap-3">
                    {item.thumbnailUrl ? (
                      <button
                        type="button"
                        className="relative size-14 shrink-0 overflow-hidden rounded-md border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
                        aria-label={`预览 ${item.label}`}
                        onMouseEnter={(e) =>
                          showHoverPreview({
                            url: item.thumbnailUrl,
                            title: item.label,
                            anchor: e.currentTarget,
                          })
                        }
                        onMouseLeave={hideHoverPreview}
                      >
                        <ProjectCoverMedia
                          url={item.thumbnailUrl}
                          alt={item.label}
                          className="size-full object-cover"
                          placeholderLetter={item.label}
                        />
                      </button>
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30 text-[10px] text-white/30">
                        无预览
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-violet-50">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-violet-200/55">
                        {new Date(item.createdAt).toLocaleString("zh-CN")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={restoringId === item.id}
                          onClick={() => void onRestoreItem(item)}
                          className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/15 px-2 py-1 text-[11px] text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                        >
                          {restoringId === item.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3" />
                          )}
                          恢复
                        </button>
                        {tab === "manual" ? (
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => void onDeleteItem(item)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            {deletingId === item.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                            删除
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-white/8 px-4 py-3">
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-md border border-white/12 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/8"
          >
            刷新列表 ({tabCount})
          </button>
        </footer>
      </aside>
      <ProjectAssetHoverPreviewLayer state={hoverPreview} />
    </div>
  );
}
