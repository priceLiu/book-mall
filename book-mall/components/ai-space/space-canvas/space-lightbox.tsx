"use client";

/** 图片放大查看：列表里放缩略图，只有这里才加载原图 */

import { useCallback, useEffect, useState } from "react";

import type { AiSpaceBlockRefDto } from "@/lib/ai-space/ai-space-space-types";

import { AiSpaceOverlay } from "../ai-space-overlay";

export type SpaceLightboxState = {
  refs: AiSpaceBlockRefDto[];
  index: number;
} | null;

export function SpaceLightbox({
  state,
  onClose,
}: {
  state: SpaceLightboxState;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(state?.index ?? 0);

  useEffect(() => {
    setIndex(state?.index ?? 0);
  }, [state]);

  const total = state?.refs.length ?? 0;

  const step = useCallback(
    (delta: number) => {
      if (total === 0) return;
      setIndex((prev) => (prev + delta + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, onClose, step]);

  if (!state || total === 0) return null;

  const current = state.refs[Math.min(index, total - 1)];
  const resolved = current?.resolved;
  if (!resolved) return null;

  return (
    <AiSpaceOverlay
      level="lightbox"
      onClose={onClose}
      backdropClassName="flex-col bg-black/85 p-6"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolved.mediaUrl}
        alt={current.caption ?? resolved.title ?? "作品"}
        className="max-h-[82vh] max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="mt-3 flex items-center gap-4 text-xs text-white/80">
        {total > 1 ? (
          <>
            <button
              type="button"
              className="rounded border border-white/30 px-2 py-1"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
            >
              上一张
            </button>
            <span>
              {index + 1} / {total}
            </span>
            <button
              type="button"
              className="rounded border border-white/30 px-2 py-1"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
            >
              下一张
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="rounded border border-white/30 px-2 py-1"
          onClick={onClose}
        >
          关闭
        </button>
      </div>

      {current.caption ?? resolved.title ? (
        <p className="mt-2 max-w-2xl truncate text-center text-xs text-white/70">
          {current.caption ?? resolved.title}
        </p>
      ) : null}
    </AiSpaceOverlay>
  );
}
