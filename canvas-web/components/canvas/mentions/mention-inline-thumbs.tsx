"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { MentionableItem } from "./MentionsTextarea";
import { findAllMentionRangesInDisplay } from "@/lib/canvas/mention-at-display-index";
import { getMentionRangeClientRect } from "@/lib/canvas/textarea-caret-rect";
import { cn } from "@/lib/utils";

export type MentionInlineThumbMirrorHandle = {
  resolveThumbAtPoint: (
    clientX: number,
    clientY: number,
  ) => { item: MentionableItem; anchorRect: DOMRect } | null;
};

const THUMB_HIT_PAD = 2;

const THUMB_SIZE_DEFAULT = 16;
const THUMB_SIZE_SBV1 = 18;

type ThumbPosition = {
  id: string;
  item: MentionableItem;
  left: number;
  top: number;
};

function pointInRect(
  x: number,
  y: number,
  rect: DOMRect,
  pad = 0,
): boolean {
  return (
    x >= rect.left - pad &&
    x <= rect.right + pad &&
    y >= rect.top - pad &&
    y <= rect.bottom + pad
  );
}

function thumbBorderClass(edition: "pro2" | "sbv1"): string {
  return edition === "sbv1"
    ? "border-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
    : "border-violet-400/70 shadow-[0_0_0_1px_rgba(167,139,250,0.35)]";
}

/**
 * textarea 透明字 + mirror 纯文本（与 value 1:1）+ 缩略图绝对定位 overlay。
 * 禁止在 mirror 文本流内嵌 img，否则会撑开排版导致 caret 与点击位置漂移。
 */
export const MentionInlineThumbMirror = forwardRef<
  MentionInlineThumbMirrorHandle,
  {
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    displayValue: string;
    mentionables: MentionableItem[];
    enabled: boolean;
    edition?: "pro2" | "sbv1";
    textareaClassName: string;
  }
>(function MentionInlineThumbMirror(
  {
    textareaRef,
    displayValue,
    mentionables,
    enabled,
    edition = "pro2",
    textareaClassName,
  },
  ref,
) {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [thumbPositions, setThumbPositions] = useState<ThumbPosition[]>([]);

  const thumbSize = edition === "sbv1" ? THUMB_SIZE_SBV1 : THUMB_SIZE_DEFAULT;
  const borderClass = thumbBorderClass(edition);

  const previewKey = useMemo(
    () =>
      mentionables
        .map((m) => `${m.id}:${m.previewUrl ?? ""}:${m.label}`)
        .join("|"),
    [mentionables],
  );

  const syncMirrorScroll = useCallback(() => {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    const overlay = overlayRef.current;
    if (!ta || !mirror) return;
    mirror.scrollTop = ta.scrollTop;
    mirror.scrollLeft = ta.scrollLeft;
    if (overlay) {
      overlay.scrollTop = ta.scrollTop;
      overlay.scrollLeft = ta.scrollLeft;
    }
    const h = ta.style.height;
    if (h) {
      mirror.style.height = h;
      if (overlay) overlay.style.height = h;
    } else {
      const px = `${ta.offsetHeight}px`;
      mirror.style.height = px;
      if (overlay) overlay.style.height = px;
    }
  }, [textareaRef]);

  const layoutThumbPositions = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || !enabled) {
      setThumbPositions([]);
      return;
    }

    const taRect = ta.getBoundingClientRect();
    const ranges = findAllMentionRangesInDisplay(displayValue, mentionables);
    const next: ThumbPosition[] = [];

    for (const range of ranges) {
      if (!range.item.previewUrl) continue;
      const mentionRect = getMentionRangeClientRect(ta, range.start, range.end);
      if (!mentionRect) continue;
      next.push({
        id: range.item.id,
        item: range.item,
        left: mentionRect.right - taRect.left + 2,
        top:
          mentionRect.top -
          taRect.top +
          Math.max(0, (mentionRect.height - thumbSize) / 2),
      });
    }

    setThumbPositions(next);
  }, [displayValue, mentionables, enabled, textareaRef, thumbSize]);

  useLayoutEffect(() => {
    if (!enabled) return;
    syncMirrorScroll();
    layoutThumbPositions();
  }, [displayValue, previewKey, enabled, syncMirrorScroll, layoutThumbPositions]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!enabled || !ta) return;

    const onScroll = () => {
      syncMirrorScroll();
      layoutThumbPositions();
    };
    ta.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(ta);

    return () => {
      ta.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [enabled, syncMirrorScroll, layoutThumbPositions, textareaRef]);

  useImperativeHandle(
    ref,
    () => ({
      resolveThumbAtPoint(clientX, clientY) {
        const overlay = overlayRef.current;
        if (!overlay) return null;
        const thumbs = overlay.querySelectorAll<HTMLImageElement>(
          "img[data-mention-thumb]",
        );
        for (const el of thumbs) {
          const id = el.dataset.mentionId;
          if (!id) continue;
          const item = mentionables.find((m) => m.id === id);
          if (!item?.previewUrl) continue;
          const rect = el.getBoundingClientRect();
          if (pointInRect(clientX, clientY, rect, THUMB_HIT_PAD)) {
            return { item, anchorRect: rect };
          }
        }
        return null;
      },
    }),
    [mentionables],
  );

  if (!enabled) return null;

  return (
    <>
      <div
        ref={mirrorRef}
        aria-hidden
        className={cn(
          textareaClassName,
          "pointer-events-none absolute inset-0 z-[1] overflow-hidden whitespace-pre-wrap break-words text-white",
        )}
      >
        {displayValue}
      </div>
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      >
        {thumbPositions.map((pos) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={pos.id}
            src={pos.item.previewUrl}
            alt=""
            draggable={false}
            data-mention-thumb=""
            data-mention-id={pos.id}
            className={cn(
              "absolute rounded-[3px] border object-cover",
              borderClass,
            )}
            style={{
              width: thumbSize,
              height: thumbSize,
              left: pos.left,
              top: pos.top,
            }}
            referrerPolicy="no-referrer"
          />
        ))}
      </div>
    </>
  );
});

/** mentionInlineThumb 时加在 textarea 上的 class */
export const MENTION_INLINE_THUMB_TEXTAREA_CLASS =
  "relative z-[2] bg-transparent text-transparent caret-white selection:bg-white/15 [-webkit-text-fill-color:transparent]";

/** @deprecated 旧绝对定位方案 · 保留导出名避免外部引用报错 */
export function MentionInlineThumbs(props: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  wrapperRef: RefObject<HTMLElement | null>;
  displayValue: string;
  mentionables: MentionableItem[];
  enabled: boolean;
  edition?: "pro2" | "sbv1";
  textareaClassName?: string;
}): ReactNode {
  if (!props.enabled || !props.textareaClassName) return null;
  return (
    <MentionInlineThumbMirror
      textareaRef={props.textareaRef}
      displayValue={props.displayValue}
      mentionables={props.mentionables}
      enabled={props.enabled}
      edition={props.edition}
      textareaClassName={props.textareaClassName}
    />
  );
}
