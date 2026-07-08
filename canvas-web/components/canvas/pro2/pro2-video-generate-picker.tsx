"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Video, X } from "lucide-react";
import type { StoryProFrameRow } from "@/lib/canvas/story-pro-workspace-types";
import { resolveStoryFrameImageUrl } from "@/lib/canvas/story-frame-gate";
import {
  PRO2_VIDEO_MODEL_KEYS,
  pickDefaultPro2VideoEngine,
  type Pro2VideoBatchVideoPick,
} from "@/lib/canvas/pro2-video-batch-video";
import { PRO2_DOCK_BORDER, PRO2_DOCK_SHELL_BG } from "@/lib/canvas/story-pro2-node-chrome";
import { RF_FORM_CONTROL } from "@/lib/canvas/react-flow-classes";
import { useUserProviders } from "@/lib/canvas/use-user-providers";
import { cn } from "@/lib/utils";
import { EnginePicker } from "../engine-picker";

export type Pro2VideoGenerateResult = {
  frameIndices: number[];
  batchVideo: Pro2VideoBatchVideoPick;
};

export type Pro2VideoGeneratePickerProps = {
  open: boolean;
  rows: StoryProFrameRow[];
  initialBatchVideo?: Pro2VideoBatchVideoPick | null;
  onClose: () => void;
  onConfirm: (result: Pro2VideoGenerateResult) => void;
};

/** 生成视频组 · 选择已有分镜图的镜号 + VIDEO 模型 */
export function Pro2VideoGeneratePicker({
  open,
  rows,
  initialBatchVideo,
  onClose,
  onConfirm,
}: Pro2VideoGeneratePickerProps) {
  const { providers } = useUserProviders();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [providerId, setProviderId] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [params, setParams] = useState<Record<string, unknown>>({});

  const readyRows = useMemo(
    () =>
      [...rows]
        .filter((r) => Boolean(resolveStoryFrameImageUrl(r)))
        .sort((a, b) => a.frameIndex - b.frameIndex),
    [rows],
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
    setSelected(new Set(readyRows.map((r) => r.frameIndex)));
    const seed =
      initialBatchVideo ?? pickDefaultPro2VideoEngine(providers) ?? null;
    if (seed) {
      setProviderId(seed.providerId);
      setModelKey(seed.modelKey);
      setParams(seed.params ?? {});
    }
  }, [open, readyRows, initialBatchVideo, providers]);

  useEffect(() => {
    if (!open || providerId.trim()) return;
    const seed =
      initialBatchVideo ?? pickDefaultPro2VideoEngine(providers) ?? null;
    if (!seed) return;
    setProviderId(seed.providerId);
    setModelKey(seed.modelKey);
    setParams(seed.params ?? {});
  }, [open, initialBatchVideo, providers, providerId]);

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

  if (!mounted || !open) return null;

  const checked = readyRows.filter((r) => selected.has(r.frameIndex));
  const allSelected =
    readyRows.length > 0 && checked.length === readyRows.length;
  const hasVideoModel = Boolean(providerId.trim() && modelKey.trim());

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
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: PRO2_DOCK_BORDER,
          background: PRO2_DOCK_SHELL_BG,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2">
            <Video className="size-4 text-violet-200/80" />
            <p className="text-[14px] font-medium text-white/90">
              选择要生成视频的镜号
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

        {readyRows.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-white/55">
            请先生成至少一镜分镜图，再创建视频组。
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-2">
              <button
                type="button"
                className="text-[11px] text-violet-200/80 hover:text-violet-100"
                onClick={() =>
                  setSelected(
                    allSelected
                      ? new Set()
                      : new Set(readyRows.map((r) => r.frameIndex)),
                  )
                }
              >
                {allSelected ? "取消全选" : "全选"}
              </button>
              <span className="text-[11px] text-white/45">
                已选 {checked.length} / {readyRows.length} 镜（仅含已出图）
              </span>
            </div>

            <ul className="min-h-0 flex-1 overflow-auto px-3 py-1">
              {readyRows.map((row) => {
                const on = selected.has(row.frameIndex);
                return (
                  <li key={row.key}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-white/[0.04]",
                        on && "bg-violet-500/[0.08]",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={on}
                        onChange={() => toggle(row.frameIndex)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-white/85">
                          镜 {row.frameIndex}
                        </p>
                        <p className="line-clamp-2 text-[11px] leading-snug text-white/55">
                          {(row.description ?? row.prompt ?? "").trim() ||
                            "（无描述）"}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <footer className="flex flex-col gap-3 border-t border-white/[0.06] px-5 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
              视频模型
            </p>
            <div className={cn("nodrag max-w-md", RF_FORM_CONTROL)}>
              <EnginePicker
                role="VIDEO"
                allowedModelKeys={PRO2_VIDEO_MODEL_KEYS}
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
            {!hasVideoModel ? (
              <p className="mt-1 text-[10px] text-amber-200/90">
                请先选择 VIDEO 模型后再生成
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
              disabled={
                !checked.length || !hasVideoModel || !readyRows.length
              }
              className="rounded-lg bg-white px-4 py-1.5 text-[12px] font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                onConfirm({
                  frameIndices: checked.map((r) => r.frameIndex),
                  batchVideo: {
                    providerId,
                    modelKey,
                    params,
                  },
                });
                onClose();
              }}
            >
              生成 {checked.length} 镜视频组
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
