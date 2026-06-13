"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, History, Loader2, RotateCcw, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  formatCanvasApiError,
  getCanvasProjectHistoryEntry,
  listCanvasProjectHistory,
  type CanvasProjectHistorySummary,
} from "@/lib/canvas-api";
import {
  CANVAS_AUTOSAVE_INTERVAL_OPTIONS,
  formatCanvasAutosaveIntervalLabel,
  getCanvasAutosaveIntervalMs,
  setCanvasAutosaveIntervalMs,
} from "@/lib/canvas/canvas-autosave-settings";

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
  const [items, setItems] = useState<CanvasProjectHistorySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [intervalMs, setIntervalMs] = useState(getCanvasAutosaveIntervalMs);
  const openRef = useRef(open);
  openRef.current = open;

  const reload = useCallback(async () => {
    if (!base || !projectId) return;
    setLoading(true);
    try {
      const list = await listCanvasProjectHistory(base, projectId);
      setItems(list);
      setListError(null);
    } catch (e) {
      setItems([]);
      setListError(formatCanvasApiError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [base, projectId]);

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
      await alert({
        title: "恢复失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setRestoringId(null);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/45"
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
            每个项目最多保留 15 个版本。当前：
            {intervalMs === 0
              ? " 仅手动保存会写入历史"
              : ` 约每 ${formatCanvasAutosaveIntervalLabel(intervalMs)} 保存一次`}
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
              还没有历史版本。开启自动保存或点击「手动保存」后，会在此保留最近 15
              个快照，可随时恢复排列与节点内容。
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="size-14 shrink-0 rounded-md border border-white/10 object-cover"
                      />
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
                        {item.source === "manual" ? " · 手动" : " · 自动"}
                      </p>
                      <button
                        type="button"
                        disabled={restoringId === item.id}
                        onClick={() => void onRestoreItem(item)}
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/15 px-2 py-1 text-[11px] text-violet-100 hover:bg-violet-500/25 disabled:opacity-50"
                      >
                        {restoringId === item.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <RotateCcw className="size-3" />
                        )}
                        恢复此版本
                      </button>
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
            刷新列表
          </button>
        </footer>
      </aside>
    </div>
  );
}
