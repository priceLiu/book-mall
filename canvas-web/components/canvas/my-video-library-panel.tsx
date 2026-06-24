"use client";

import { useCallback, useEffect, useState } from "react";
import { Film, Loader2, Play, Trash2, X } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  deleteVideoLibraryItem,
  listVideoLibrary,
} from "@/lib/canvas-video-library";
import type { VideoLibraryItem } from "@/lib/canvas-video-library-types";
import {
  CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS,
  canvasToolbarSidePanelAsideClass,
} from "@/lib/canvas/canvas-toolbar-side-panel";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modeLabel(mode: string): string {
  if (mode === "i2v") return "图生视频";
  if (mode === "ref") return "参考生视频";
  if (mode === "t2v") return "文生视频";
  return mode;
}

export function MyVideoLibraryPanel({
  open,
  onClose,
  refreshKey = 0,
}: {
  open: boolean;
  onClose: () => void;
  refreshKey?: number;
}) {
  const base = useBookMallBaseUrl();
  const { doubleConfirm, alert } = useDialogs();
  const [items, setItems] = useState<VideoLibraryItem[]>([]);
  const [quota, setQuota] = useState<{ max: number; used: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<VideoLibraryItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const data = await listVideoLibrary(base);
      setItems(data.items);
      setQuota(data.quota);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setItems([]);
      setQuota(null);
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load, refreshKey]);

  useEffect(() => {
    const onChanged = () => {
      if (open) void load();
    };
    window.addEventListener("canvas:video-library-changed", onChanged);
    return () =>
      window.removeEventListener("canvas:video-library-changed", onChanged);
  }, [open, load]);

  const onDelete = async (item: VideoLibraryItem) => {
    if (!base) return;
    const ok = await doubleConfirm({
      first: {
        title: "删除视频？",
        message: "将从「我的视频库」移除此条记录。",
        confirmLabel: "继续",
        danger: true,
      },
      second: {
        title: "再次确认 · 不可恢复",
        message:
          "将删除库记录，并尝试删除云端 OSS 中的对应视频文件。",
        confirmLabel: "永久删除",
        danger: true,
      },
    });
    if (!ok) return;
    setBusyId(item.id);
    try {
      await deleteVideoLibraryItem(base, item.id);
      if (preview?.id === item.id) setPreview(null);
      await load();
    } catch (e) {
      await alert({
        title: "删除失败",
        message: e instanceof Error ? e.message : String(e),
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (!open && !preview) return null;

  return (
    <>
      {open ? (
        <div
          className={`${CANVAS_TOOLBAR_SIDE_PANEL_OVERLAY_CLASS} z-[60]`}
          onClick={onClose}
          role="presentation"
        >
          <aside
            className={canvasToolbarSidePanelAsideClass(
              "border-l border-white/10",
            )}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="我的视频库"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Film className="size-4 text-[var(--canvas-accent)]" />
                <div>
                  <p className="text-sm font-medium">我的视频库</p>
                  {quota ? (
                    <p className="text-[10px] text-white/45">
                      已用 {quota.used} / {quota.max} 条 · 建议保留约 7 天
                    </p>
                  ) : null}
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

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-white/50">
                  <Loader2 className="size-4 animate-spin" /> 加载中…
                </div>
              ) : error ? (
                <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
                  {error}
                </p>
              ) : items.length === 0 ? (
                <p className="py-12 text-center text-[12px] text-white/45">
                  暂无保存的视频。在画布视频节点上点击「保存到视频库」即可入库。
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex gap-3 rounded-lg border border-white/10 bg-black/25 p-2"
                    >
                      <button
                        type="button"
                        className="relative size-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/50"
                        onClick={() => setPreview(item)}
                        aria-label="播放预览"
                      >
                        <video
                          src={item.videoUrl}
                          className="size-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                          <Play className="size-5 fill-white text-white" />
                        </span>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-white/90">
                          {modeLabel(item.mode)}
                          {item.modelLabel ? ` · ${item.modelLabel}` : ""}
                        </p>
                        <p className="mt-0.5 text-[10px] text-white/40">
                          {item.resolution} · {item.durationSec}s ·{" "}
                          {formatDate(item.createdAt)}
                        </p>
                        {item.prompt ? (
                          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/55">
                            {item.prompt}
                          </p>
                        ) : null}
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="text-[10px] text-emerald-300/90 hover:underline"
                            onClick={() => setPreview(item)}
                          >
                            播放
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 text-[10px] text-red-300/80 hover:underline disabled:opacity-40"
                            disabled={busyId === item.id}
                            onClick={() => void onDelete(item)}
                          >
                            {busyId === item.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                            删除
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {preview ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="视频预览"
          >
            <button
              type="button"
              className="absolute right-2 top-2 z-10 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
              onClick={() => setPreview(null)}
              aria-label="关闭预览"
            >
              <X className="size-4" />
            </button>
            <video
              src={preview.videoUrl}
              className="max-h-[80vh] w-full bg-black"
              controls
              autoPlay
              playsInline
            />
            {preview.prompt ? (
              <p className="max-h-24 overflow-y-auto border-t border-white/10 px-3 py-2 text-[11px] leading-relaxed text-white/70">
                {preview.prompt}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
