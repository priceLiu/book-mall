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
} from "@/lib/canvas/mention-inline-thumb-metrics";
import { stripMentionThumbSlots } from "@/lib/canvas/mention-inline-thumb-placeholder";
import { LIBTV_INPUT_DOCK_BG } from "@/lib/canvas/libtv-node-chrome";
import { getTextareaCaretClientRect } from "@/lib/canvas/textarea-caret-rect";
import { cn } from "@/lib/utils";

export type MentionInlineThumbMirrorHandle = {
  resolveThumbAtPoint: (
    clientX: number,
    clientY: number,
  ) => { item: MentionableItem; anchorRect: DOMRect } | null;
};

const THUMB_HIT_PAD = 2;
const BADGE_HEIGHT_PX = 24;

type BadgePlacement = {
  item: MentionableItem;
  label: string;
  left: number;
  top: number;
  maskWidth: number;
};

function thumbBorderClass(edition: "pro2" | "sbv1"): string {
  return edition === "sbv1"
    ? "border-cyan-400/70"
    : "border-violet-400/70";
}

function measureBadgePlacements(
  textarea: HTMLTextAreaElement,
  mentionables: MentionableItem[],
): BadgePlacement[] {
  const wrapper = textarea.parentElement;
  if (!wrapper) return [];

  const wrapperRect = wrapper.getBoundingClientRect();
  // 必须用 textarea 当前 DOM 值：受控组件在 input 与 React commit 之间 prop 会滞后
  const clean = stripMentionThumbSlots(textarea.value);
  const ranges = findAllMentionRangesInDisplay(clean, mentionables);
  const out: BadgePlacement[] = [];

  for (const range of ranges) {
    if (!range.item.previewUrl) continue;

    const start = getTextareaCaretClientRect(textarea, range.start);
    const end = getTextareaCaretClientRect(textarea, range.end);
    if (!start || !end) continue;

    const lineH = start.height || BADGE_HEIGHT_PX;
    out.push({
      item: range.item,
      label: clean.slice(range.start, range.end),
      left: start.left - wrapperRect.left,
      top: start.top - wrapperRect.top + (lineH - BADGE_HEIGHT_PX) / 2,
      maskWidth: Math.max(end.left - start.left, start.height * 0.5),
    });
  }

  return out;
}

function expectedThumbMentionCount(
  textarea: HTMLTextAreaElement,
  mentionables: MentionableItem[],
): number {
  const clean = stripMentionThumbSlots(textarea.value);
  return findAllMentionRangesInDisplay(clean, mentionables).filter(
    (r) => r.item.previewUrl,
  ).length;
}

function placementKey(p: BadgePlacement): string {
  return [
    p.item.id,
    p.label,
    Math.round(p.left),
    Math.round(p.top),
    Math.round(p.maskWidth),
  ].join("|");
}

function syncBadgeDom(
  root: HTMLDivElement,
  placements: BadgePlacement[],
  edition: "pro2" | "sbv1",
): void {
  const borderClass = thumbBorderClass(edition);
  const wanted = new Set(placements.map((p) => p.item.id));

  for (const child of [...root.children]) {
    const id = (child as HTMLElement).dataset.mentionHostId;
    if (id && !wanted.has(id)) child.remove();
  }

  for (const p of placements) {
    let host = root.querySelector<HTMLElement>(
      `[data-mention-host-id="${p.item.id}"]`,
    );
    if (!host) {
      host = document.createElement("div");
      host.dataset.mentionHostId = p.item.id;
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
  const lastKeyRef = useRef("");
  const rafRef = useRef<number | null>(null);

  const remeasure = useCallback(() => {
    const root = overlayRef.current;
    const ta = textareaRef.current;
    if (!root || !ta || !enabled) {
      if (root) root.replaceChildren();
      lastKeyRef.current = "";
      return;
    }

    const next = measureBadgePlacements(ta, mentionables);
    if (next.length === 0 && expectedThumbMentionCount(ta, mentionables) > 0) {
      // caret mirror 偶发失败时保留上一帧，避免输入瞬间 badge 全消失
      return;
    }

    const key = next.map(placementKey).join(";;");
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    syncBadgeDom(root, next, edition);
  }, [textareaRef, mentionables, enabled, edition]);

  const scheduleRemeasure = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      remeasure();
    });
  }, [remeasure]);

  useLayoutEffect(() => {
    remeasure();
  }, [displayValue, remeasure]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!enabled || !ta) return;

    ta.addEventListener("input", scheduleRemeasure);
    ta.addEventListener("compositionend", scheduleRemeasure);
    ta.addEventListener("scroll", scheduleRemeasure, { passive: true });
    const ro = new ResizeObserver(scheduleRemeasure);
    ro.observe(ta);

    const dockScroll = ta.closest(".pro2-dock-scroll");
    dockScroll?.addEventListener("scroll", scheduleRemeasure, { passive: true });
    window.addEventListener("resize", scheduleRemeasure);

    const rfViewport = ta.closest(".react-flow__viewport") as HTMLElement | null;
    const viewportObserver =
      rfViewport &&
      new MutationObserver(scheduleRemeasure);
    viewportObserver?.observe(rfViewport, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      ta.removeEventListener("input", scheduleRemeasure);
      ta.removeEventListener("compositionend", scheduleRemeasure);
      ta.removeEventListener("scroll", scheduleRemeasure);
      dockScroll?.removeEventListener("scroll", scheduleRemeasure);
      window.removeEventListener("resize", scheduleRemeasure);
      viewportObserver?.disconnect();
      ro.disconnect();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, scheduleRemeasure, textareaRef]);

  useImperativeHandle(
    ref,
    () => ({
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
    [mentionables],
  );

  if (!enabled) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[2] overflow-visible"
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
