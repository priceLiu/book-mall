"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { MentionableItem } from "./MentionsTextarea";
import { findAllMentionRangesInDisplay } from "@/lib/canvas/mention-at-display-index";
import {
  INLINE_MENTION_BADGE_GAP_PX,
  INLINE_MENTION_THUMB_PX,
  inlineMentionThumbReserveSpaces,
} from "@/lib/canvas/mention-inline-thumb-metrics";
import {
  mapDisplayIndexToRawIndex,
  stripMentionThumbSlots,
} from "@/lib/canvas/mention-inline-thumb-placeholder";
import { LIBTV_INPUT_DOCK_BG } from "@/lib/canvas/libtv-node-chrome";
import { useLibtvInputDockUi } from "@/lib/canvas/libtv-input-dock-ui-context";
import { getTextareaCaretClientRect } from "@/lib/canvas/textarea-caret-rect";
import { useCanvasStore } from "@/lib/canvas/store";
import { cn } from "@/lib/utils";

const REMEASURE_DEBOUNCE_MS = 80;
const MEASURE_RETRY_MAX = 6;

export type MentionInlineThumbMirrorHandle = {
  resolveThumbAtPoint: (
    clientX: number,
    clientY: number,
  ) => { item: MentionableItem; anchorRect: DOMRect } | null;
  remeasure: () => void;
};

const THUMB_HIT_PAD = 2;
const BADGE_HEIGHT_PX = 24;

type BadgePlacement = {
  item: MentionableItem;
  label: string;
  rangeStart: number;
  left: number;
  top: number;
  maskWidth: number;
};

function thumbBorderClass(edition: "pro2" | "sbv1"): string {
  return edition === "sbv1"
    ? "border-cyan-400/70"
    : "border-violet-400/70";
}

function toRawIndex(raw: string, clean: string, displayIndex: number): number {
  if (clean.length === raw.length) return displayIndex;
  return mapDisplayIndexToRawIndex(raw, displayIndex);
}

/** 在 scrollTop/Left=0 下测量内容坐标；滚动由 overlay transform 同步 */
function measureBadgePlacements(
  textarea: HTMLTextAreaElement,
  mentionables: MentionableItem[],
): BadgePlacement[] {
  const wrapper = textarea.parentElement;
  if (!wrapper) return [];

  const wrapperRect = wrapper.getBoundingClientRect();
  const raw = textarea.value;
  const clean = stripMentionThumbSlots(raw);
  const ranges = findAllMentionRangesInDisplay(clean, mentionables);
  const out: BadgePlacement[] = [];
  const measureScroll = { measureScrollTop: 0, measureScrollLeft: 0 };

  for (const range of ranges) {
    if (!range.item.previewUrl) continue;

    const rawStart = toRawIndex(raw, clean, range.start);
    const rawEnd = toRawIndex(raw, clean, range.end);
    const start = getTextareaCaretClientRect(textarea, rawStart, measureScroll);
    const end = getTextareaCaretClientRect(textarea, rawEnd, measureScroll);
    if (!start || !end) continue;

    const fontSizePx = parseFloat(window.getComputedStyle(textarea).fontSize) || 13;
    const tailSpaces = clean.slice(range.end).match(/^ */)?.[0]?.length ?? 0;
    const reserveSpaces = inlineMentionThumbReserveSpaces(fontSizePx);
    const hideTail = Math.min(tailSpaces, reserveSpaces);
    const maskEndCaret =
      hideTail > 0
        ? getTextareaCaretClientRect(
            textarea,
            toRawIndex(raw, clean, range.end + hideTail),
            measureScroll,
          )
        : end;
    const maskRight = maskEndCaret?.left ?? end.left;

    const lineH = start.height || BADGE_HEIGHT_PX;
    out.push({
      item: range.item,
      label: clean.slice(range.start, range.end),
      rangeStart: range.start,
      left: start.left - wrapperRect.left,
      top: start.top - wrapperRect.top + (lineH - BADGE_HEIGHT_PX) / 2,
      maskWidth: Math.max(maskRight - start.left, start.height * 0.5),
    });
  }

  return out;
}

function placementKey(p: BadgePlacement): string {
  return [p.item.id, p.rangeStart, p.label].join("|");
}

function syncBadgeDom(
  root: HTMLDivElement,
  placements: BadgePlacement[],
  edition: "pro2" | "sbv1",
): void {
  const borderClass = thumbBorderClass(edition);
  const wanted = new Set(placements.map((p) => placementKey(p)));

  for (const child of [...root.children]) {
    const id = (child as HTMLElement).dataset.mentionHostId;
    if (id && !wanted.has(id)) child.remove();
  }

  for (const p of placements) {
    const hostId = placementKey(p);
    let host: HTMLElement | null = null;
    for (const child of root.children) {
      const el = child as HTMLElement;
      if (el.dataset.mentionHostId === hostId) {
        host = el;
        break;
      }
    }
    if (!host) {
      host = document.createElement("div");
      host.dataset.mentionHostId = hostId;
      host.className = "absolute flex items-center";
      host.style.height = `${BADGE_HEIGHT_PX}px`;

      const mask = document.createElement("span");
      mask.className = "absolute inset-y-0 left-0";
      mask.style.backgroundColor = LIBTV_INPUT_DOCK_BG;
      host.appendChild(mask);

      const badge = document.createElement("span");
      badge.dataset.mentionInlineBadge = "";
      badge.dataset.mentionId = p.item.id;
      badge.className = cn(
        "relative inline-flex h-6 max-w-[200px] shrink-0 items-center rounded-lg border border-white/10 px-1 text-[13px] leading-none text-white/90",
        borderClass,
      );
      badge.style.backgroundColor = LIBTV_INPUT_DOCK_BG;
      badge.style.gap = `${INLINE_MENTION_BADGE_GAP_PX}px`;

      const img = document.createElement("img");
      img.draggable = false;
      img.dataset.mentionThumb = "";
      img.className = "shrink-0 rounded-[4px] object-cover";
      img.style.width = `${INLINE_MENTION_THUMB_PX}px`;
      img.style.height = `${INLINE_MENTION_THUMB_PX}px`;
      img.referrerPolicy = "no-referrer";

      const label = document.createElement("span");
      label.className = "mention-inline-label min-w-0 truncate";

      badge.appendChild(img);
      badge.appendChild(label);
      host.appendChild(badge);
      root.appendChild(host);
    }

    host.style.left = `${p.left}px`;
    host.style.top = `${p.top}px`;

    const maskEl = host.firstElementChild as HTMLElement | null;
    if (maskEl) maskEl.style.width = `${p.maskWidth}px`;

    const badgeEl = host.querySelector<HTMLElement>("[data-mention-inline-badge]");
    const imgEl = host.querySelector<HTMLImageElement>("img[data-mention-thumb]");
    const labelEl = host.querySelector<HTMLElement>(".mention-inline-label");
    if (badgeEl) badgeEl.dataset.mentionId = p.item.id;
    if (imgEl && p.item.previewUrl && imgEl.src !== p.item.previewUrl) {
      imgEl.src = p.item.previewUrl;
    }
    if (labelEl) labelEl.textContent = p.label;
  }
}

/**
 * 内联 mention badge · LibTV 同款 [16px 图 + @label] overlay，textarea 保留纯文本。
 * DOM 直写 placement，避免输入时 React 重绘闪烁。
 */
export const MentionInlineThumbOverlay = forwardRef<
  MentionInlineThumbMirrorHandle,
  {
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    displayValue: string;
    mentionables: MentionableItem[];
    enabled: boolean;
    edition?: "pro2" | "sbv1";
  }
>(function MentionInlineThumbOverlay(
  {
    textareaRef,
    displayValue,
    mentionables,
    enabled,
    edition = "pro2",
  },
  ref,
) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const measureRetryRef = useRef(0);
  const viewportMoving = useCanvasStore((s) => s.canvasViewportMoving);
  const { expanded: dockExpanded } = useLibtvInputDockUi();

  const syncScrollOffset = useCallback(() => {
    const ta = textareaRef.current;
    const overlay = overlayRef.current;
    if (!ta || !overlay) return;
    overlay.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
  }, [textareaRef]);

  const remeasure = useCallback(() => {
    const root = overlayRef.current;
    const ta = textareaRef.current;
    if (!root || !ta || !enabled) {
      if (root) root.replaceChildren();
      return;
    }

    const next = measureBadgePlacements(ta, mentionables);
    const clean = stripMentionThumbSlots(ta.value);
    const expected = findAllMentionRangesInDisplay(clean, mentionables).filter(
      (r) => r.item.previewUrl,
    ).length;

    if (expected === 0) {
      root.replaceChildren();
      syncScrollOffset();
      measureRetryRef.current = 0;
      return;
    }

    if (next.length === 0 && expected > 0) {
      root.replaceChildren();
      syncScrollOffset();
      if (measureRetryRef.current < MEASURE_RETRY_MAX) {
        measureRetryRef.current += 1;
        window.setTimeout(() => {
          remeasure();
        }, 32 * measureRetryRef.current);
      }
      return;
    }

    measureRetryRef.current = 0;
    syncBadgeDom(root, next, edition);
    syncScrollOffset();
  }, [textareaRef, mentionables, enabled, edition, syncScrollOffset]);

  const scheduleRemeasure = useCallback(() => {
    if (viewportMoving) return;
    if (debounceRef.current !== null) return;
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        remeasure();
      });
    }, REMEASURE_DEBOUNCE_MS);
  }, [remeasure, viewportMoving]);

  useLayoutEffect(() => {
    remeasure();
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      syncScrollOffset();
      remeasure();
      raf2 = requestAnimationFrame(() => {
        syncScrollOffset();
        remeasure();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);
    };
  }, [displayValue, mentionables, remeasure, syncScrollOffset, dockExpanded]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!enabled || !ta) return;

    const onScroll = () => {
      syncScrollOffset();
    };
    syncScrollOffset();

    ta.addEventListener("input", scheduleRemeasure);
    ta.addEventListener("compositionend", scheduleRemeasure);
    ta.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(scheduleRemeasure);
    ro.observe(ta);
    const dockShell = ta.closest("[data-libtv-input-dock]");
    if (dockShell) ro.observe(dockShell);

    const dockScroll = ta.closest(".pro2-dock-scroll");
    dockScroll?.addEventListener("scroll", scheduleRemeasure, { passive: true });
    window.addEventListener("resize", scheduleRemeasure);

    return () => {
      ta.removeEventListener("input", scheduleRemeasure);
      ta.removeEventListener("compositionend", scheduleRemeasure);
      ta.removeEventListener("scroll", onScroll);
      dockScroll?.removeEventListener("scroll", scheduleRemeasure);
      window.removeEventListener("resize", scheduleRemeasure);
      ro.disconnect();
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, scheduleRemeasure, syncScrollOffset, textareaRef]);

  useLayoutEffect(() => {
    if (!enabled || viewportMoving) return;
    scheduleRemeasure();
  }, [enabled, viewportMoving, scheduleRemeasure]);

  useImperativeHandle(
    ref,
    () => ({
      remeasure,
      resolveThumbAtPoint(clientX, clientY) {
        const overlay = overlayRef.current;
        if (!overlay) return null;
        const badges = overlay.querySelectorAll<HTMLElement>(
          "[data-mention-inline-badge]",
        );
        for (const badge of badges) {
          const id = badge.dataset.mentionId;
          if (!id) continue;
          const item = mentionables.find((m) => m.id === id);
          if (!item?.previewUrl) continue;
          const rect = badge.getBoundingClientRect();
          if (
            clientX >= rect.left - THUMB_HIT_PAD &&
            clientX <= rect.right + THUMB_HIT_PAD &&
            clientY >= rect.top - THUMB_HIT_PAD &&
            clientY <= rect.bottom + THUMB_HIT_PAD
          ) {
            return { item, anchorRect: rect };
          }
        }
        return null;
      },
    }),
    [mentionables, remeasure],
  );

  if (!enabled) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
    />
  );
});

/** @deprecated 使用 MentionInlineThumbOverlay */
export const MentionInlineThumbMirror = MentionInlineThumbOverlay;

/** mentionInlineThumb 时 textarea 正常显示文字 */
export const MENTION_INLINE_THUMB_TEXTAREA_CLASS = "";

/** @deprecated */
export function MentionInlineThumbs(props: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  wrapperRef: RefObject<HTMLElement | null>;
  displayValue: string;
  mentionables: MentionableItem[];
  enabled: boolean;
  edition?: "pro2" | "sbv1";
  textareaClassName?: string;
}): ReactNode {
  if (!props.enabled) return null;
  return (
    <MentionInlineThumbOverlay
      textareaRef={props.textareaRef}
      displayValue={props.displayValue}
      mentionables={props.mentionables}
      enabled={props.enabled}
      edition={props.edition}
    />
  );
}
