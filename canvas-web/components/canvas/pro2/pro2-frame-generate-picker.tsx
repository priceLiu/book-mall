"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, Sparkles, X } from "lucide-react";
import {
  type StoryboardTableRow,
} from "@/lib/canvas/parse-md-tables";
import {
  PRO2_FRAME_IMAGE_MODEL_KEYS,
  pickDefaultPro2FrameImageEngine,
  type Pro2FrameBatchImagePick,
} from "@/lib/canvas/pro2-frame-batch-image";
import {
  pro2BatchImageAsSbv1Settings,
  sbv1EngineToBatchImage,
} from "@/lib/canvas/pro2-three-view-engine";
import { PRO2_DOCK_BORDER, PRO2_DOCK_SHELL_BG } from "@/lib/canvas/story-pro2-node-chrome";
import {
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import {
  LIBTV_DOCK_TOOLBAR_SCREEN_SCALE,
  LibtvDockToolbarMetricsContext,
} from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import type { Sbv1ImageNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { cn } from "@/lib/utils";
import {
  Sbv1ImageDockModelPicker,
  Sbv1ImageDockParamsPicker,
} from "../sbv1/sbv1-image-dock-pickers";

/** @deprecated 使用 Pro2StoryboardSpawnResult */
export type Pro2FrameGenerateResult = Pro2StoryboardSpawnResult;

export type Pro2StoryboardSpawnResult = {
  frameIndices: number[];
  rows: StoryboardTableRow[];
  batchImage?: Pro2FrameBatchImagePick | null;
};

export type Pro2FrameGeneratePickerProps = {
  open: boolean;
  rows: StoryboardTableRow[];
  initialBatchImage?: Pro2FrameBatchImagePick | null;
  generatingPrompts?: boolean;
  onClose: () => void;
  onConfirm: (result: Pro2StoryboardSpawnResult) => void;
  onGeneratePrompts?: (frameIndices: number[]) => void;
};

const GRID =
  "grid grid-cols-[28px_44px_64px_72px_72px_44px_minmax(100px,1fr)_minmax(72px,0.8fr)_minmax(72px,0.7fr)_minmax(120px,1.1fr)_minmax(120px,1.1fr)] gap-x-1.5 px-3";

function normalizeRow(row: StoryboardTableRow): StoryboardTableRow {
  return {
    ...row,
    lighting: row.lighting ?? "",
    sfxNote: row.sfxNote ?? "",
    frameImagePrompt:
      row.frameImagePrompt?.trim() ||
      row.aiImagePrompt?.trim() ||
      "",
    aiImagePrompt:
      row.frameImagePrompt?.trim() ||
      row.aiImagePrompt?.trim() ||
      "",
    videoPrompt: row.videoPrompt?.trim() || row.aiVideoPrompt?.trim() || "",
    aiVideoPrompt: row.videoPrompt?.trim() || row.aiVideoPrompt?.trim() || "",
  };
}

function cellInputClassName(extra?: string) {
  return cn(
    "nodrag w-full resize-y rounded border border-white/10 bg-black/20 px-1.5 py-1 text-[10px] leading-snug text-white/80 outline-none focus:border-violet-400/40",
    extra,
  );
}

/** 生成分镜 · 可编辑导演表 + Pass2 提示词 + 创建双组（spawn-only） */
export function Pro2FrameGeneratePicker({
  open,
  rows,
  initialBatchImage,
  generatingPrompts = false,
  onClose,
  onConfirm,
  onGeneratePrompts,
}: Pro2FrameGeneratePickerProps) {
  const { providers } = useUserProviders();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editRows, setEditRows] = useState<StoryboardTableRow[]>([]);
  const [dockMenu, setDockMenu] = useState<"model" | "params" | null>(null);
  const [settingsData, setSettingsData] = useState<Sbv1ImageNodeData>({
    aspectRatio: "16:9",
    imageQuality: "standard",
    resolution: "2K",
    outputCount: 1,
  });

  const sorted = useMemo(
    () => [...editRows].sort((a, b) => a.frameIndex - b.frameIndex),
    [editRows],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const openInitRef = useRef(false);

  useEffect(() => {
    if (!open) {
      openInitRef.current = false;
      return;
    }
    if (openInitRef.current) return;
    openInitRef.current = true;
    setEditRows(rows.map(normalizeRow));
    setSelected(new Set(rows.map((r) => r.frameIndex)));
    const seedBatch =
      initialBatchImage ?? pickDefaultPro2FrameImageEngine(providers) ?? null;
    setSettingsData(
      pro2BatchImageAsSbv1Settings(seedBatch, {
        aspectRatio: "16:9",
        imageQuality: "standard",
        resolution: "2K",
        outputCount: 1,
      }),
    );
    setDockMenu(null);
  }, [open, rows, initialBatchImage, providers]);

  useEffect(() => {
    if (!open) return;
    setEditRows((prev) => {
      const byIndex = new Map(prev.map((r) => [r.frameIndex, r] as const));
      return rows.map((incoming) => {
        const prevRow = byIndex.get(incoming.frameIndex);
        if (!prevRow) return normalizeRow(incoming);
        return normalizeRow({
          ...prevRow,
          frameImagePrompt:
            incoming.frameImagePrompt?.trim() ||
            incoming.aiImagePrompt?.trim() ||
            prevRow.frameImagePrompt,
          aiImagePrompt:
            incoming.frameImagePrompt?.trim() ||
            incoming.aiImagePrompt?.trim() ||
            prevRow.aiImagePrompt,
          videoPrompt:
            incoming.videoPrompt?.trim() ||
            incoming.aiVideoPrompt?.trim() ||
            prevRow.videoPrompt,
          aiVideoPrompt:
            incoming.videoPrompt?.trim() ||
            incoming.aiVideoPrompt?.trim() ||
            prevRow.aiVideoPrompt,
        });
      });
    });
  }, [open, rows]);

  const modalActive = open && sorted.length > 0;
  useModalBodyScrollLock(modalActive);
  useModalEscapeClose(onClose, { active: modalActive });

  const patchSettings = useCallback((patch: Partial<Sbv1ImageNodeData>) => {
    setSettingsData((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchRow = useCallback(
    (frameIndex: number, patch: Partial<StoryboardTableRow>) => {
      setEditRows((prev) =>
        prev.map((r) => (r.frameIndex === frameIndex ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  if (!mounted || !open || !sorted.length) return null;

  const allSelected = selected.size === sorted.length;
  const checked = sorted.filter((r) => selected.has(r.frameIndex));
  const batchImage = sbv1EngineToBatchImage(settingsData);

  const toggle = (frameIndex: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(frameIndex)) next.delete(frameIndex);
      else next.add(frameIndex);
      return next;
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="生成分镜"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[min(1200px,96vw)] flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: PRO2_DOCK_BORDER,
          background: PRO2_DOCK_SHELL_BG,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-violet-200/80" />
            <p className="text-[14px] font-medium text-white/90">生成分镜</p>
          </div>
          <button
            type="button"
            className="nodrag rounded-md p-1.5 text-white/45 hover:bg-white/8"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-2">
          <button
            type="button"
            className="text-[11px] text-violet-200/80 hover:text-violet-100"
            onClick={() =>
              setSelected(
                allSelected
                  ? new Set()
                  : new Set(sorted.map((r) => r.frameIndex)),
              )
            }
          >
            {allSelected ? "取消全选" : "全选"}
          </button>
          <div className="flex items-center gap-2">
            {onGeneratePrompts ? (
              <button
                type="button"
                disabled={!checked.length || generatingPrompts}
                className="inline-flex items-center gap-1 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-100 hover:bg-violet-500/20 disabled:opacity-40"
                onClick={() =>
                  onGeneratePrompts(checked.map((r) => r.frameIndex))
                }
              >
                <Sparkles className="size-3" />
                {generatingPrompts ? "生成提示词中…" : "生成提示词"}
              </button>
            ) : null}
            <span className="text-[11px] text-white/45">
              已选 {checked.length} / {sorted.length} 镜
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div
            className={cn(
              GRID,
              "sticky top-0 z-[1] min-w-[980px] border-b border-white/[0.06] bg-[#1a1a22] py-1.5 text-[9px] font-medium uppercase tracking-wide text-white/40",
            )}
          >
            <span />
            <span>镜号</span>
            <span>景别</span>
            <span>光影</span>
            <span>运镜</span>
            <span>时长</span>
            <span>画面描述</span>
            <span>对白</span>
            <span>音效</span>
            <span>分镜图提示词</span>
            <span>分镜视频提示词</span>
          </div>
          <ul className="min-w-[980px]">
            {sorted.map((row) => {
              const on = selected.has(row.frameIndex);
              return (
                <li
                  key={row.frameIndex}
                  className={cn(
                    "border-b border-white/[0.04]",
                    on && "bg-violet-500/[0.06]",
                  )}
                >
                  <div className={cn(GRID, "items-start py-2")}>
                    <input
                      type="checkbox"
                      className="mt-2"
                      checked={on}
                      onChange={() => toggle(row.frameIndex)}
                    />
                    <span className="pt-1 text-[12px] font-semibold text-white/85">
                      {row.frameIndex}
                    </span>
                    <textarea
                      rows={2}
                      className={cellInputClassName()}
                      value={row.shotSize}
                      onChange={(e) =>
                        patchRow(row.frameIndex, { shotSize: e.target.value })
                      }
                    />
                    <textarea
                      rows={2}
                      className={cellInputClassName()}
                      value={row.lighting}
                      onChange={(e) =>
                        patchRow(row.frameIndex, { lighting: e.target.value })
                      }
                    />
                    <textarea
                      rows={2}
                      className={cellInputClassName()}
                      value={row.cameraMove}
                      onChange={(e) =>
                        patchRow(row.frameIndex, { cameraMove: e.target.value })
                      }
                    />
                    <input
                      className={cellInputClassName("min-h-[32px]")}
                      value={row.duration}
                      onChange={(e) =>
                        patchRow(row.frameIndex, { duration: e.target.value })
                      }
                    />
                    <textarea
                      rows={3}
                      className={cellInputClassName()}
                      value={row.description}
                      onChange={(e) =>
                        patchRow(row.frameIndex, { description: e.target.value })
                      }
                    />
                    <textarea
                      rows={2}
                      className={cellInputClassName()}
                      value={row.dialogue}
                      onChange={(e) =>
                        patchRow(row.frameIndex, { dialogue: e.target.value })
                      }
                    />
                    <textarea
                      rows={2}
                      className={cellInputClassName()}
                      value={row.sfxNote}
                      onChange={(e) =>
                        patchRow(row.frameIndex, { sfxNote: e.target.value })
                      }
                    />
                    <textarea
                      rows={3}
                      className={cellInputClassName("text-emerald-100/80")}
                      value={row.frameImagePrompt || row.aiImagePrompt}
                      placeholder="Pass 2 · 分镜图"
                      onChange={(e) =>
                        patchRow(row.frameIndex, {
                          frameImagePrompt: e.target.value,
                          aiImagePrompt: e.target.value,
                        })
                      }
                    />
                    <textarea
                      rows={3}
                      className={cellInputClassName("text-violet-100/80")}
                      value={row.videoPrompt || row.aiVideoPrompt}
                      placeholder="Pass 2 · 分镜视频"
                      onChange={(e) =>
                        patchRow(row.frameIndex, {
                          videoPrompt: e.target.value,
                          aiVideoPrompt: e.target.value,
                        })
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="flex flex-col gap-3 border-t border-white/[0.06] px-5 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
              分镜图默认模型（组内 Dock 可改）
            </p>
            <LibtvDockToolbarMetricsContext.Provider
              value={LIBTV_DOCK_TOOLBAR_SCREEN_SCALE}
            >
              <div className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-black/25 px-1 py-1">
                <Sbv1ImageDockModelPicker
                  data={settingsData}
                  allowedModelKeys={PRO2_FRAME_IMAGE_MODEL_KEYS}
                  open={dockMenu === "model"}
                  onOpenChange={(next) => setDockMenu(next ? "model" : null)}
                  onPatch={patchSettings}
                />
                <Sbv1ImageDockParamsPicker
                  data={settingsData}
                  open={dockMenu === "params"}
                  onOpenChange={(next) => setDockMenu(next ? "params" : null)}
                  onPatch={patchSettings}
                />
              </div>
            </LibtvDockToolbarMetricsContext.Provider>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-[12px] text-white/55 hover:bg-white/6"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              disabled={!checked.length}
              className="rounded-lg bg-white px-4 py-1.5 text-[12px] font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                const pickedRows = sorted.filter((r) =>
                  selected.has(r.frameIndex),
                );
                onConfirm({
                  frameIndices: pickedRows.map((r) => r.frameIndex),
                  rows: editRows.map((r) => {
                    const frameImagePrompt =
                      r.frameImagePrompt?.trim() || r.aiImagePrompt?.trim() || "";
                    const videoPrompt =
                      r.videoPrompt?.trim() || r.aiVideoPrompt?.trim() || "";
                    return {
                      ...r,
                      frameImagePrompt,
                      aiImagePrompt: frameImagePrompt,
                      videoPrompt,
                      aiVideoPrompt: videoPrompt,
                    };
                  }),
                  batchImage: batchImage ?? null,
                });
                onClose();
              }}
            >
              创建分镜 {checked.length} 镜
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
