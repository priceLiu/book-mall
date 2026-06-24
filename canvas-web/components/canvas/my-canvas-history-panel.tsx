"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, History, Loader2, RotateCcw, Trash2, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { CanvasPanelShellLoading } from "@/components/canvas/canvas-panel-shell-loading";
import { CanvasToolbarSidePanelShell } from "@/components/canvas/canvas-toolbar-side-panel-shell";
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
import {
  CANVAS_PANEL_SHELL_BODY_CLASS,
  CANVAS_PANEL_SHELL_EMPTY_CLASS,
  CANVAS_PANEL_SHELL_ERROR_CLASS,
  CANVAS_PANEL_SHELL_FOOTER_CLASS,
  CANVAS_PANEL_SHELL_HEADER_CLASS,
  CANVAS_PANEL_SHELL_LINK_BTN_CLASS,
  CANVAS_PANEL_SHELL_LINK_BTN_DANGER_CLASS,
  CANVAS_PANEL_SHELL_LIST_ITEM_CLASS,
  CANVAS_PANEL_SHELL_SELECT_CLASS,
  CANVAS_PANEL_SHELL_SETTINGS_BLOCK_CLASS,
  CANVAS_PANEL_SHELL_TABS_ROW_CLASS,
  CANVAS_PANEL_SHELL_THUMB_LG_CLASS,
  CANVAS_PANEL_TAB_ACTIVE_CLASS,
  CANVAS_PANEL_TAB_IDLE_CLASS,
} from "@/lib/canvas/canvas-chrome-semantics";
import {
  fetchToolbarPanelWithSwr,
  invalidateToolbarPanelCache,
  toolbarPanelCacheKey,
} from "@/lib/canvas/toolbar-panel-cache";
import { cn } from "@/lib/utils";

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

  const reload = useCallback(async (opts?: { force?: boolean }) => {
    if (!base || !projectId) return;
    const cacheKey = toolbarPanelCacheKey("canvas-history", {
      projectId,
      tab,
    });
    await fetchToolbarPanelWithSwr({
      cacheKey,
      force: opts?.force,
      fetch: async () => {
        const data = await listCanvasProjectHistory(base, projectId, { source: tab });
        return { items: data.items, meta: data.meta };
      },
      onLoading: setLoading,
      onData: (cached) => {
        setItems(cached.items);
        setMeta(cached.meta);
        setListError(null);
      },
      onError: (e) => {
        if (e == null) return;
        setItems([]);
        setMeta(null);
        setListError(formatCanvasApiError(e instanceof Error ? e.message : String(e)));
      },
    });
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
      invalidateToolbarPanelCache("canvas-history|");
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
        : formatCanvasApiError(raw);
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
      invalidateToolbarPanelCache("canvas-history|");
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

  const tabCount =
    tab === "manual" ? meta?.manualCount ?? items.length : meta?.autosaveCount ?? items.length;

  return (
    <CanvasToolbarSidePanelShell
      open={open}
      onClose={onClose}
      ariaLabel="我的历史"
    >
      <header className={CANVAS_PANEL_SHELL_HEADER_CLASS}>
        <div className="flex items-center gap-2">
          <History className="size-4 text-[var(--canvas-accent)]" />
          <div>
            <p className="text-sm font-medium">我的历史</p>
            <p className="text-[10px] text-white/45">
              自动与手动各保留 {CANVAS_PROJECT_HISTORY_MAX} 条
            </p>
          </div>
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

      <div className={CANVAS_PANEL_SHELL_TABS_ROW_CLASS}>
        <button
          type="button"
          onClick={() => setTab("autosave")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[11px]",
            tab === "autosave"
              ? CANVAS_PANEL_TAB_ACTIVE_CLASS
              : CANVAS_PANEL_TAB_IDLE_CLASS,
          )}
        >
          自动保存 ({meta?.autosaveCount ?? 0}/{CANVAS_PROJECT_HISTORY_MAX})
        </button>
        <button
          type="button"
          onClick={() => setTab("manual")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[11px]",
            tab === "manual"
              ? CANVAS_PANEL_TAB_ACTIVE_CLASS
              : CANVAS_PANEL_TAB_IDLE_CLASS,
          )}
        >
          手动保存 ({meta?.manualCount ?? 0}/{CANVAS_PROJECT_HISTORY_MAX})
        </button>
      </div>

      <div className={CANVAS_PANEL_SHELL_SETTINGS_BLOCK_CLASS}>
        <div className="flex items-center gap-2 text-[11px] text-white/55">
          <Clock className="size-3.5" />
          <span>自动保存间隔</span>
        </div>
        <select
          value={String(intervalMs)}
          onChange={(e) => onIntervalChange(Number.parseInt(e.target.value, 10))}
          className={cn("nodrag mt-2", CANVAS_PANEL_SHELL_SELECT_CLASS)}
        >
          {CANVAS_AUTOSAVE_INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.ms}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[10px] leading-relaxed text-white/40">
          {intervalMs === 0
            ? "当前：仅手动保存会写入「手动保存」历史。"
            : `当前：编辑停顿约 ${CANVAS_AUTOSAVE_DEBOUNCE_MS / 1000} 秒后写入「自动保存」；另约每 ${formatCanvasAutosaveIntervalLabel(intervalMs)} 补一条备份。`}
        </p>
      </div>

      <div className={CANVAS_PANEL_SHELL_BODY_CLASS}>
        {listError ? (
          <p className={cn("mb-3", CANVAS_PANEL_SHELL_ERROR_CLASS)}>{listError}</p>
        ) : null}
        {loading ? (
          <CanvasPanelShellLoading label="加载历史…" />
        ) : items.length === 0 ? (
          <p className={CANVAS_PANEL_SHELL_EMPTY_CLASS}>
            {tab === "manual"
              ? "还没有手动保存。点击工具栏「手动保存」后，版本会出现在这里。"
              : intervalMs <= 0
                ? "已关闭自动保存历史。可在上方改间隔。"
                : "还没有自动保存记录。编辑停顿约 1.5 秒后会写入一条快照。"}
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className={CANVAS_PANEL_SHELL_LIST_ITEM_CLASS}
              >
                {item.thumbnailUrl ? (
                  <button
                    type="button"
                    className={cn(
                      CANVAS_PANEL_SHELL_THUMB_LG_CLASS,
                      "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
                    )}
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
                  <div className={cn(CANVAS_PANEL_SHELL_THUMB_LG_CLASS, "flex items-center justify-center text-[10px] text-white/30")}>
                    无预览
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-white/90">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/40">
                    {new Date(item.createdAt).toLocaleString("zh-CN")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={restoringId === item.id}
                      onClick={() => void onRestoreItem(item)}
                      className={cn(
                        "inline-flex items-center gap-0.5 disabled:opacity-40",
                        CANVAS_PANEL_SHELL_LINK_BTN_CLASS,
                      )}
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
                        className={CANVAS_PANEL_SHELL_LINK_BTN_DANGER_CLASS}
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
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className={CANVAS_PANEL_SHELL_FOOTER_CLASS}>
        <button
          type="button"
          onClick={() => void reload({ force: true })}
          className="text-[10px] text-white/70 hover:underline"
        >
          刷新列表 ({tabCount})
        </button>
      </footer>
      <ProjectAssetHoverPreviewLayer state={hoverPreview} />
    </CanvasToolbarSidePanelShell>
  );
}
