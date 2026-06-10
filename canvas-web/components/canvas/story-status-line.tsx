"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import {
  STORY_CHROME_GREEN_CLASS,
  STORY_ERROR_LINE_CLASS,
  STORY_HINT_GOLD_CLASS,
} from "@/lib/canvas/story-column-sync";

/** 节点内错误条自动收起（与 story-engine-node  toast 一致） */
export const STORY_ERROR_AUTO_DISMISS_MS = 8000;

/** 错误信息：单行省略，悬停即时展示全文（portal，避免被节点 overflow 裁切） */
export function StoryErrorLine({
  message,
  className,
  autoDismissMs = STORY_ERROR_AUTO_DISMISS_MS,
}: {
  message: string;
  className?: string;
  /** 默认 8s 后自动隐藏；传 0 则常驻 */
  autoDismissMs?: number;
}) {
  const elRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(
    null,
  );

  useEffect(() => {
    setVisible(true);
    if (!message.trim() || autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => setVisible(false), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [message, autoDismissMs]);

  const showTip = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTipPos({ left: r.left, top: r.top - 6 });
  }, []);

  const hideTip = useCallback(() => setTipPos(null), []);

  if (!message.trim() || !visible) return null;

  return (
    <>
      <span
        ref={elRef}
        className={cn(
          "block min-w-0 max-w-full cursor-help truncate",
          STORY_ERROR_LINE_CLASS,
          className,
        )}
        title={message}
        role="alert"
        aria-label={message}
        tabIndex={0}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
      >
        {message}
      </span>
      {tipPos && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[9999] max-w-[min(92vw,420px)] rounded-md border border-red-400/35 bg-black/95 px-2.5 py-1.5 text-[10px] leading-snug text-red-100 shadow-xl"
              style={{
                left: tipPos.left,
                top: tipPos.top,
                transform: "translateY(-100%)",
              }}
            >
              {message}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** 说明 / 前置条件类提示（图 2 金黄） */
export function StoryHintLine({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] leading-relaxed",
        STORY_HINT_GOLD_CLASS,
        className,
      )}
      title={message}
    >
      {message}
    </p>
  );
}

/** 节点内状态 / 区块说明（绿色） */
export function StoryStatusLine({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] leading-relaxed",
        STORY_CHROME_GREEN_CLASS,
        className,
      )}
      title={message}
    >
      {message}
    </p>
  );
}
