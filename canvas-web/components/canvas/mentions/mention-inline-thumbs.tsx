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

type MirrorSegment =
  | { kind: "text"; key: string; value: string }
  | {
      kind: "mention";
      key: string;
      label: string;
      item: MentionableItem;
    };

function buildMirrorSegments(
  text: string,
  mentionables: MentionableItem[],
): MirrorSegment[] {
  if (!text) return [];
  const ranges = findAllMentionRangesInDisplay(text, mentionables);
  if (!ranges.length) return [{ kind: "text", key: "t0", value: text }];

  const out: MirrorSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      out.push({
        kind: "text",
        key: `t-${cursor}`,
        value: text.slice(cursor, range.start),
      });
    }
    out.push({
      kind: "mention",
      key: `m-${range.start}-${range.item.id}`,
      label: text.slice(range.start, range.end),
      item: range.item,
    });
    cursor = range.end;
  }
  if (cursor < text.length) {
    out.push({ kind: "text", key: `t-${cursor}`, value: text.slice(cursor) });
  }
  return out;
}

function MentionInlineMirrorContent({
  segments,
  edition,
}: {
  segments: MirrorSegment[];
  edition: "pro2" | "sbv1";
}) {
  const thumbSize = edition === "sbv1" ? THUMB_SIZE_SBV1 : THUMB_SIZE_DEFAULT;
  const borderClass =
    edition === "sbv1"
      ? "border-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
      : "border-violet-400/70 shadow-[0_0_0_1px_rgba(167,139,250,0.35)]";

  return (
    <>
      {segments.map((seg) => {
        if (seg.kind === "text") {
          return <span key={seg.key}>{seg.value}</span>;
        }
        return (
          <span key={seg.key}>
            {seg.label}
            {seg.item.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={seg.item.previewUrl}
                alt=""
                draggable={false}
                data-mention-thumb=""
                data-mention-id={seg.item.id}
                className={cn(
                  "ml-0.5 inline-block rounded-[3px] border object-cover align-text-bottom",
                  borderClass,
                )}
                style={{ width: thumbSize, height: thumbSize }}
                referrerPolicy="no-referrer"
              />
            ) : null}
          </span>
        );
      })}
    </>
  );
}

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

/** textarea 透明字 + mirror 内联缩略图（与输入框同排版，避免 caret 测量漂移） */
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

  const previewKey = useMemo(
    () =>
      mentionables
        .map((m) => `${m.id}:${m.previewUrl ?? ""}:${m.label}`)
        .join("|"),
    [mentionables],
  );

  const segments = useMemo(
    () => buildMirrorSegments(displayValue, mentionables),
    [displayValue, mentionables, previewKey],
  );

  const syncMirror = useCallback(() => {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;
    mirror.scrollTop = ta.scrollTop;
    mirror.scrollLeft = ta.scrollLeft;
    const h = ta.style.height;
    if (h) mirror.style.height = h;
    else mirror.style.height = `${ta.offsetHeight}px`;
  }, [textareaRef]);

  useLayoutEffect(() => {
    if (!enabled) return;
    syncMirror();
  }, [displayValue, previewKey, enabled, syncMirror, segments.length]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!enabled || !ta) return;

    const onScroll = () => syncMirror();
    ta.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => syncMirror());
    ro.observe(ta);

    return () => {
      ta.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [enabled, syncMirror, textareaRef]);

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
        "pointer-events-none absolute inset-0 z-[1] overflow-hidden whitespace-pre-wrap break-words text-white",
      )}
    >
      <MentionInlineMirrorContent segments={segments} edition={edition} />
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
