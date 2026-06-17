"use client";

import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import type { MentionableItem } from "./MentionsTextarea";
import { findAllMentionRangesInDisplay } from "@/lib/canvas/mention-at-display-index";
import { getMentionRangeClientRect } from "@/lib/canvas/textarea-caret-rect";
import { cn } from "@/lib/utils";

const THUMB_SIZE = 16;
const THUMB_GAP = 4;

export type MentionInlineThumbAnchor = {
  id: string;
  url: string;
  left: number;
  top: number;
};

export function MentionInlineThumbs({
  textareaRef,
  wrapperRef,
  displayValue,
  mentionables,
  enabled,
  edition = "pro2",
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  wrapperRef: RefObject<HTMLElement | null>;
  displayValue: string;
  mentionables: MentionableItem[];
  enabled: boolean;
  edition?: "pro2" | "sbv1";
}) {
  const [anchors, setAnchors] = useState<MentionInlineThumbAnchor[]>([]);

  const recompute = useCallback(() => {
    const el = textareaRef.current;
    const wrap = wrapperRef.current;
    if (!enabled || !el || !wrap) {
      setAnchors([]);
      return;
    }

    const wrapRect = wrap.getBoundingClientRect();
    const next: MentionInlineThumbAnchor[] = [];

    for (const range of findAllMentionRangesInDisplay(displayValue, mentionables)) {
      if (!range.item.previewUrl) continue;
      const rect = getMentionRangeClientRect(el, range.start, range.end);
      if (!rect) continue;
      next.push({
        id: range.item.id,
        url: range.item.previewUrl,
        left: rect.right - wrapRect.left + THUMB_GAP,
        top: rect.top - wrapRect.top + (rect.height - THUMB_SIZE) / 2,
      });
    }

    setAnchors(next);
  }, [displayValue, mentionables, enabled, textareaRef, wrapperRef]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!enabled || !el) return;

    const onScroll = () => recompute();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    window.addEventListener("resize", onScroll);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled, recompute, textareaRef]);

  if (!enabled || !anchors.length) return null;

  const borderClass =
    edition === "sbv1"
      ? "border-cyan-400/70 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
      : "border-violet-400/70 shadow-[0_0_0_1px_rgba(167,139,250,0.35)]";

  return (
    <>
      {anchors.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={a.id}
          src={a.url}
          alt=""
          className={cn(
            "pointer-events-none absolute z-[2] rounded-[3px] border object-cover",
            borderClass,
          )}
          style={{
            left: a.left,
            top: a.top,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
          }}
        />
      ))}
    </>
  );
}
