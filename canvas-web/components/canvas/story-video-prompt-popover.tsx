"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type { StoryEdition } from "@/lib/canvas/story-edition-chrome";

const TIP_WIDTH = 520;
const TIP_HIDE_MS = 280;

/** 分镜视频列：Tip 始终在锚点右侧；贴屏幕右缘时向内收，不翻到左侧 */
export function computeStoryVideoPromptTipPosition(rect: DOMRect): {
  top: number;
  left: number;
} {
  const width = Math.min(TIP_WIDTH, window.innerWidth - 32);
  const tipMaxH = Math.min(560, window.innerHeight - 24);
  let left = rect.right + 14;
  if (left + width > window.innerWidth - 16) {
    left = window.innerWidth - width - 16;
  }
  if (left < rect.right + 8) {
    left = Math.max(12, rect.right + 8);
  }
  const top = Math.min(rect.top, window.innerHeight - tipMaxH);
  return { top: Math.max(12, top), left: Math.max(12, left) };
}

function TipBody({
  prompt,
  refLabels,
  edition,
}: {
  prompt: string;
  refLabels: string[];
  edition: StoryEdition;
}) {
  const accent =
    edition === "pro" ? "text-cyan-300/95" : "text-[#60a5fa]";
  return (
    <div className="space-y-3 font-mono text-[12px] leading-[1.6]">
      <div>
        <div
          className={cn(
            "mb-1 font-sans text-[13px] font-medium",
            accent,
          )}
        >
          prompt:
        </div>
        <pre className="canvas-story-video-tip__pre whitespace-pre-wrap break-words text-white/85">
          {prompt}
        </pre>
      </div>
      {refLabels.length ? (
        <div className="font-sans text-[11px] text-white/45">
          <span className="font-medium text-white/60">@ 参考：</span>
          {refLabels.join("、")}
        </div>
      ) : null}
      <p className="font-sans text-[10px] text-white/40">
        主图 = 分镜图 · 三视图 = 参考
      </p>
    </div>
  );
}

function TipPortal({
  pos,
  prompt,
  refLabels,
  edition,
  onEnter,
  onLeave,
}: {
  pos: { top: number; left: number };
  prompt: string;
  refLabels: string[];
  edition: StoryEdition;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="canvas-story-video-prompt-tip nodrag"
      style={{ top: pos.top, left: pos.left }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="视频生成提示词"
    >
      <div className="canvas-story-video-prompt-tip__body">
        <TipBody prompt={prompt} refLabels={refLabels} edition={edition} />
      </div>
    </div>
  );
}

/** 悬停锚点 · Portal 右侧大面板（卡片内不铺全文） */
export function useStoryVideoPromptTip(anchorRef: RefObject<HTMLElement | null>) {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setPos(null);
    }, TIP_HIDE_MS);
  }, [clearHideTimer]);

  const showTip = useCallback(() => {
    clearHideTimer();
    const el = anchorRef.current;
    if (!el) return;
    setPos(computeStoryVideoPromptTipPosition(el.getBoundingClientRect()));
    setOpen(true);
  }, [anchorRef, clearHideTimer]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  useEffect(() => {
    if (!open) return;
    const onReflow = () => {
      const el = anchorRef.current;
      if (!el) return;
      setPos(computeStoryVideoPromptTipPosition(el.getBoundingClientRect()));
    };
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, anchorRef]);

  return {
    open,
    pos,
    showTip,
    scheduleHide,
    clearHideTimer,
  };
}

export function StoryVideoPromptTipPortal({
  open,
  pos,
  prompt,
  refLabels = [],
  edition = "comic",
  onEnter,
  onLeave,
}: {
  open: boolean;
  pos: { top: number; left: number } | null;
  prompt: string;
  refLabels?: string[];
  edition?: StoryEdition;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const text = prompt.trim();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open || !text || !pos) return null;

  return createPortal(
    <TipPortal
      pos={pos}
      prompt={text}
      refLabels={refLabels}
      edition={edition}
      onEnter={onEnter}
      onLeave={onLeave}
    />,
    document.body,
  );
}
