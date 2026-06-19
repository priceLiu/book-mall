"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { MentionableItem } from "./MentionsTextarea";
import { findAllMentionRangesInDisplay } from "@/lib/canvas/mention-at-display-index";
import {
  countMentionThumbSlotsAt,
  MENTION_THUMB_SLOT_CHAR,
  skipMentionThumbSlotRun,
} from "@/lib/canvas/mention-inline-thumb-placeholder";
import { cn } from "@/lib/utils";

export type MentionInlineThumbMirrorHandle = {
  resolveThumbAtPoint: (
    clientX: number,
    clientY: number,
  ) => { item: MentionableItem; anchorRect: DOMRect } | null;
};

const THUMB_HIT_PAD = 2;

/** 相对字号 em · 与正文行高对齐 */
const THUMB_SIZE_DEFAULT = 0.82;
const THUMB_SIZE_SBV1 = 0.86;

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

const MIRROR_LAYOUT_PROPS = [
  "boxSizing",
  "direction",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "overflowWrap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "tabSize",
  "textAlign",
  "textTransform",
  "whiteSpace",
  "wordBreak",
  "wordSpacing",
] as const;

function InlineMentionThumb({
  item,
  sizeEm,
  borderClass,
}: {
  item: MentionableItem;
  sizeEm: number;
  borderClass: string;
}) {
  if (!item.previewUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.previewUrl}
      alt=""
      draggable={false}
      data-mention-thumb=""
      data-mention-id={item.id}
      className={cn(
        "inline-block rounded-[2px] border object-cover",
        borderClass,
      )}
      style={{
        width: `${sizeEm}em`,
        height: `${sizeEm}em`,
        marginLeft: "0.08em",
        marginRight: "0.06em",
        verticalAlign: "-0.12em",
      }}
      referrerPolicy="no-referrer"
    />
  );
}

function buildMirrorContent(
  displayValue: string,
  mentionables: MentionableItem[],
  edition: "pro2" | "sbv1",
  thumbSizeEm: number,
  borderClass: string,
): ReactNode[] {
  const ranges = findAllMentionRangesInDisplay(displayValue, mentionables);
  if (ranges.length === 0) return [displayValue];

  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push(displayValue.slice(cursor, range.start));
    }
    parts.push(displayValue.slice(range.start, range.end));
    cursor = range.end;

    const slotCount = countMentionThumbSlotsAt(displayValue, cursor, edition);
    if (slotCount > 0 && range.item.previewUrl) {
      cursor += skipMentionThumbSlotRun(displayValue, cursor);
      parts.push(
        <InlineMentionThumb
          key={`thumb-${range.start}-${key++}`}
          item={range.item}
          sizeEm={thumbSizeEm}
          borderClass={borderClass}
        />,
      );
    }
  }

  if (cursor < displayValue.length) {
    const tail = displayValue.slice(cursor);
    if (
      tail.includes(MENTION_THUMB_SLOT_CHAR) ||
      tail.includes("\u2002")
    ) {
      parts.push(
        tail.replace(
          /[\u2002\u2003]+/g,
          "",
        ),
      );
    } else {
      parts.push(tail);
    }
  }

  return parts;
}

/**
 * textarea 透明字 + mirror 分段渲染：@label 后 em space 占位符 → 内联缩略图（与 textarea 同宽换行）。
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

  const thumbSizeEm =
    edition === "sbv1" ? THUMB_SIZE_SBV1 : THUMB_SIZE_DEFAULT;
  const borderClass = thumbBorderClass(edition);

  const mirrorContent = useMemo(
    () =>
      buildMirrorContent(
        displayValue,
        mentionables,
        edition,
        thumbSizeEm,
        borderClass,
      ),
    [displayValue, mentionables, edition, thumbSizeEm, borderClass],
  );

  const syncMirrorScroll = useCallback(() => {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;

    const cs = window.getComputedStyle(ta);
    for (const prop of MIRROR_LAYOUT_PROPS) {
      mirror.style[prop] = cs[prop];
    }
    mirror.scrollTop = ta.scrollTop;
    mirror.scrollLeft = ta.scrollLeft;

    const h = ta.style.height;
    mirror.style.height = h || `${ta.offsetHeight}px`;
  }, [textareaRef]);

  useLayoutEffect(() => {
    if (!enabled) return;
    syncMirrorScroll();
    const rafId = requestAnimationFrame(syncMirrorScroll);
    return () => cancelAnimationFrame(rafId);
  }, [displayValue, enabled, syncMirrorScroll]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!enabled || !ta) return;

    const schedule = () => {
      requestAnimationFrame(syncMirrorScroll);
    };

    ta.addEventListener("input", schedule);
    ta.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(ta);

    const dockScroll = ta.closest(".pro2-dock-scroll");
    dockScroll?.addEventListener("scroll", schedule, { passive: true });

    return () => {
      ta.removeEventListener("input", schedule);
      ta.removeEventListener("scroll", schedule);
      dockScroll?.removeEventListener("scroll", schedule);
      ro.disconnect();
    };
  }, [enabled, syncMirrorScroll, textareaRef]);

  useImperativeHandle(
    ref,
    () => ({
      resolveThumbAtPoint(clientX, clientY) {
        const mirror = mirrorRef.current;
        if (!mirror) return null;
        const thumbs = mirror.querySelectorAll<HTMLImageElement>(
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
    <div
      ref={mirrorRef}
      aria-hidden
      className={cn(
        textareaClassName,
        "pointer-events-none absolute inset-0 z-[1] overflow-hidden text-white",
      )}
    >
      {mirrorContent}
    </div>
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
