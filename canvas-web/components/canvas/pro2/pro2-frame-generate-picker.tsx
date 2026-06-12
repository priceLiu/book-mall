"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, X } from "lucide-react";
import {
  isEmptyStoryboardCell,
  type StoryboardTableRow,
} from "@/lib/canvas/parse-md-tables";
import {
  PRO2_FRAME_IMAGE_MODEL_KEYS,
  pickDefaultPro2FrameImageEngine,
  type Pro2FrameBatchImagePick,
} from "@/lib/canvas/pro2-frame-batch-image";
import { PRO2_DOCK_BORDER, PRO2_DOCK_SHELL_BG } from "@/lib/canvas/story-pro2-node-chrome";
import { RF_FORM_CONTROL } from "@/lib/canvas/react-flow-classes";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import { EnginePicker } from "../engine-picker";

export type Pro2FrameGenerateResult = {
  frameIndices: number[];
  batchImage: Pro2FrameBatchImagePick;
};

export type Pro2FrameGeneratePickerProps = {
  open: boolean;
  rows: StoryboardTableRow[];
  initialBatchImage?: Pro2FrameBatchImagePick | null;
  onClose: () => void;
  onConfirm: (result: Pro2FrameGenerateResult) => void;
};

function cellText(value: string | undefined, fallback = "—"): string {
  const t = (value ?? "").trim();
  if (!t || isEmptyStoryboardCell(t)) return fallback;
  return t;
}

const GRID_HEAD =
  "grid grid-cols-[28px_52px_72px_72px_52px_minmax(140px,1.4fr)_minmax(100px,1fr)_minmax(160px,1.6fr)] gap-x-2 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-white/40";

const GRID_ROW =
  "grid grid-cols-[28px_52px_72px_72px_52px_minmax(140px,1.4fr)_minmax(100px,1fr)_minmax(160px,1.6fr)] gap-x-2 px-3 py-2.5";

/** 生成分镜图 · 选择镜号 + IMAGE 模型（可全选） */
export function Pro2FrameGeneratePicker({
  open,
  rows,
  initialBatchImage,
  onClose,
  onConfirm,
}: Pro2FrameGeneratePickerProps) {
  const { providers } = useUserProviders();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [providerId, setProviderId] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>({});

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.frameIndex - b.frameIndex),
    [rows],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(sorted.map((r) => r.frameIndex)));
    const seed =
      initialBatchImage ??
      pickDefaultPro2FrameImageEngine(providers) ??
      null;
    if (seed) {
      setProviderId(seed.providerId);
      setModelKey(seed.modelKey);
      setParams(seed.params ?? {});
    }
  }, [open, sorted, initialBatchImage, providers]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open || !sorted.length) return null;

  const allSelected = selected.size === sorted.length;
  const checked = sorted.filter((r) => selected.has(r.frameIndex));
  const hasImageModel = Boolean(providerId.trim() && modelKey.trim());

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
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: PRO2_DOCK_BORDER,
          background: PRO2_DOCK_SHELL_BG,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-violet-200/80" />
            <p className="text-[14px] font-medium text-white/90">
              选择要生成的分镜
            </p>
          </div>
          <button
            type="button"
            className="nodrag rounded-md p-1.5 text-white/45 hover:bg-white/8"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-2">
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
          <span className="text-[11px] text-white/45">
            已选 {checked.length} / {sorted.length} 镜
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className={cn(GRID_HEAD, "sticky top-0 z-[1] border-b border-white/[0.06] bg-[#1a1a22]")}>
            <span />
            <span>镜号</span>
            <span>景别</span>
            <span>运镜</span>
            <span>时长</span>
            <span>画面描述</span>
            <span>对白</span>
            <span>AI视频提示词</span>
          </div>
          <ul>
            {sorted.map((row) => {
              const on = selected.has(row.frameIndex);
              return (
                <li
                  key={row.frameIndex}
                  className={cn(
                    "border-b border-white/[0.04] transition hover:bg-white/[0.03]",
                    on && "bg-violet-500/[0.08]",
                  )}
                >
                  <label className={cn(GRID_ROW, "cursor-pointer items-start")}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={on}
                      onChange={() => toggle(row.frameIndex)}
                    />
                    <span className="text-[12px] font-semibold text-white/85">
                      {row.frameIndex}
                    </span>
                    <span className="text-[11px] text-white/65">
                      {cellText(row.shotSize)}
                    </span>
                    <span className="text-[11px] text-white/55">
                      {cellText(row.cameraMove)}
                    </span>
                    <span className="text-[11px] text-white/55">
                      {cellText(row.duration)}
                    </span>
                    <span className="line-clamp-3 text-[11px] leading-snug text-white/70">
                      {cellText(row.description, "（无画面描述）")}
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-snug text-white/50">
                      {cellText(row.dialogue)}
                    </span>
                    <span className="line-clamp-3 text-[11px] leading-snug text-violet-100/55">
                      {cellText(row.aiVideoPrompt, "（无提示词）")}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="flex flex-col gap-3 border-t border-white/[0.06] px-5 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
              分镜图模型
            </p>
            <div className={cn("nodrag max-w-md", RF_FORM_CONTROL)}>
              <EnginePicker
                role="IMAGE"
                allowedModelKeys={PRO2_FRAME_IMAGE_MODEL_KEYS}
                providerId={providerId}
                modelKey={modelKey}
                params={params}
                onChange={(next) => {
                  setProviderId(next.providerId);
                  setModelKey(next.modelKey);
                  setParams(next.params);
                }}
              />
            </div>
            {!hasImageModel ? (
              <p className="mt-1 text-[10px] text-amber-200/90">
                请先选择 IMAGE 模型后再生成
              </p>
            ) : null}
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
              disabled={!checked.length || !hasImageModel}
              className="rounded-lg bg-white px-4 py-1.5 text-[12px] font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                onConfirm({
                  frameIndices: checked.map((r) => r.frameIndex),
                  batchImage: { providerId, modelKey, params },
                });
                onClose();
              }}
            >
              生成 {checked.length} 镜
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
