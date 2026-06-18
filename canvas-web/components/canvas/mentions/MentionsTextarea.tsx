"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEventHandler,
  type CSSProperties,
  type KeyboardEventHandler,
  type MouseEvent,
  type Ref,
} from "react";

import { RF_FORM_CONTROL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { disposeTextareaCaretMirror } from "@/lib/canvas/textarea-caret-rect";
import { useDeferredTextCommit } from "@/lib/canvas/use-deferred-text-commit";
import {
  ensureMentionThumbSlots,
  MENTION_THUMB_SLOT_CHAR,
  stripMentionThumbSlots,
} from "@/lib/canvas/mention-inline-thumb-placeholder";
import { findMentionRangeAtDisplayIndex } from "@/lib/canvas/mention-at-display-index";
import {
  getMentionRangeClientRect,
  getTextareaCaretClientRect,
  getTextareaIndexFromClientPoint,
} from "@/lib/canvas/textarea-caret-rect";
import { MentionHoverPreviewPortal } from "./mention-hover-preview";
import { MentionInlineThumbMirror, MENTION_INLINE_THUMB_TEXTAREA_CLASS, type MentionInlineThumbMirrorHandle } from "./mention-inline-thumbs";
import { MentionPickerPortal } from "./mention-picker-portal";

export type MentionableItem = {
  id: string;
  /** popover / 正文里显示的标签，如 "1.png" */
  label: string;
  kind?: string;
  /** @ 列表缩略图（角色三视图等） */
  previewUrl?: string;
};

export type MentionsTextareaProps = {
  value: string;
  onChange: (
    value: string,
    referencedIds: string[],
    meta?: { commit?: boolean },
  ) => void;
  mentionables: MentionableItem[];
  rows?: number;
  placeholder?: string;
  className?: string;
  /** 外层容器 class（用于 flex 布局下撑满高度） */
  wrapperClassName?: string;
  style?: CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
  /** 在 flex 父级内撑满剩余高度（分镜行文案区） */
  fillHeight?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  onPaste?: ClipboardEventHandler<HTMLTextAreaElement>;
  onKeyDownCapture?: KeyboardEventHandler<HTMLTextAreaElement>;
  mentionPickerTitle?: string;
  mentionPickerEmptyHint?: string;
  /** 鼠标悬停 @mention 时显示缩略预览（Dock 默认开启） */
  mentionHoverPreview?: boolean;
  /** Dock：在 @ 标签右侧内联显示缩略图（非 footer pill） */
  mentionInlineThumb?: boolean;
  /** 与 mentionInlineThumb 同开：悬停 @ 文案仍显示大图（默认与图片 Dock 一致） */
  mentionInlineThumbHoverOnText?: boolean;
  /** mentionInlineThumb 边框色 · pro2 紫 / sbv1 cyan */
  mentionEdition?: "pro2" | "sbv1";
  /** 提交前 flush 本地 draft（生成按钮 / Enter 发送） */
  commitHandleRef?: Ref<MentionsTextareaCommitHandle>;
};

export type MentionsTextareaCommitHandle = {
  flushDraft: () => void;
};

const TOKEN_RE = /@<([^>\s]+)>/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 存储 → 编辑区展示（nodeId 换成可读 label） */
export function promptToDisplay(
  raw: string,
  mentionables: MentionableItem[],
): string {
  if (!raw) return "";
  let s = raw;
  for (const m of mentionables) {
    if (!m.id || !m.label) continue;
    s = s.split(`@<${m.id}>`).join(`@${m.label}`);
  }
  return s;
}

/** 编辑区 → 存储（@label 换回 @<nodeId>） */
export function promptFromDisplay(
  display: string,
  mentionables: MentionableItem[],
): string {
  if (!display) return "";
  let s = display;
  const sorted = [...mentionables].sort(
    (a, b) => b.label.length - a.label.length,
  );
  for (const m of sorted) {
    if (!m.id || !m.label) continue;
    s = s.replace(new RegExp(`@${escapeRegExp(m.label)}`, "g"), `@<${m.id}>`);
  }
  return s;
}

export function parseReferencedIds(value: string): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(value)) !== null) {
    if (m[1] && !seen[m[1]]) {
      seen[m[1]] = true;
      out.push(m[1]);
    }
  }
  return out;
}

type MentionAnchor = { at: number; cursor: number };

export const MentionsTextarea = forwardRef<HTMLTextAreaElement, MentionsTextareaProps>(
  function MentionsTextarea(
    {
      value,
      onChange,
      mentionables,
      rows = 6,
      placeholder,
      className,
      wrapperClassName,
      style,
      disabled,
      ariaLabel,
      fillHeight = false,
      onBlur,
      autoFocus,
      onPaste,
      onKeyDownCapture,
      mentionPickerTitle,
      mentionPickerEmptyHint = "暂无已生成的角色图，请先在角色列生成。",
      mentionHoverPreview = true,
      mentionInlineThumb = false,
      mentionInlineThumbHoverOnText = false,
      mentionEdition = "pro2",
      commitHandleRef,
    },
    ref,
  ) {
    const inlineThumbEnabled = mentionInlineThumb && !disabled;
    /** 内联缩略图已有时默认不做 @ 文案悬停（避免 mirror 测量拖垮主线程） */
    const textHoverPreviewEnabled =
      mentionHoverPreview &&
      (!mentionInlineThumb || mentionInlineThumbHoverOnText);
    const inlineThumbHoverEnabled =
      mentionHoverPreview && inlineThumbEnabled;
    const hoverPreviewEnabled =
      textHoverPreviewEnabled || inlineThumbHoverEnabled;
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const inlineThumbMirrorRef = useRef<MentionInlineThumbMirrorHandle | null>(
      null,
    );
    const mentionAnchorRef = useRef<MentionAnchor | null>(null);
    const pendingCaretRef = useRef<number | null>(null);
    const hoverRafRef = useRef<number | null>(null);
    const hoverIdRef = useRef<string | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [popoverFilter, setPopoverFilter] = useState("");
    const [popoverIndex, setPopoverIndex] = useState(0);
    const [anchorTick, setAnchorTick] = useState(0);
    const [hoverPreview, setHoverPreview] = useState<{
      item: MentionableItem;
      anchorRect: DOMRect;
    } | null>(null);

    const getMentionAnchorRect = useCallback(() => {
      const el = innerRef.current;
      if (!el) return null;
      const pos =
        mentionAnchorRef.current?.cursor ??
        el.selectionStart ??
        el.selectionEnd ??
        0;
      return getTextareaCaretClientRect(el, pos);
    }, [anchorTick]);

    const externalDisplay = useMemo(() => {
      const base = promptToDisplay(value, mentionables);
      if (!inlineThumbEnabled) return base;
      return ensureMentionThumbSlots(base, mentionables, mentionEdition);
    }, [value, mentionables, inlineThumbEnabled, mentionEdition]);

    const emit = useCallback(
      (display: string, commit: boolean) => {
        const cleaned = inlineThumbEnabled
          ? stripMentionThumbSlots(display)
          : display;
        const canonical = promptFromDisplay(cleaned, mentionables);
        onChange(canonical, parseReferencedIds(canonical), { commit });
      },
      [inlineThumbEnabled, mentionables, onChange],
    );

    const {
      draft: displayValue,
      setDraft: setDisplayDraft,
      schedule: scheduleEmit,
      flush: flushEmit,
      onFocus: onDraftFocus,
      onBlur: onDraftBlur,
    } = useDeferredTextCommit(externalDisplay, (display, meta) => {
      emit(display, meta.commit);
    });

    useImperativeHandle(
      commitHandleRef,
      () => ({
        flushDraft: () => {
          flushEmit(innerRef.current?.value ?? displayValue);
        },
      }),
      [displayValue, flushEmit],
    );

    const setRef = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    };

    const filtered = useMemo(() => {
      if (!popoverFilter) return mentionables;
      const f = popoverFilter.toLowerCase();
      return mentionables.filter(
        (m) =>
          m.label.toLowerCase().includes(f) ||
          m.id.toLowerCase().includes(f),
      );
    }, [mentionables, popoverFilter]);

    useEffect(() => {
      if (popoverIndex >= filtered.length) setPopoverIndex(0);
    }, [filtered.length, popoverIndex]);

    useLayoutEffect(() => {
      const pos = pendingCaretRef.current;
      const el = innerRef.current;
      if (pos == null || !el || document.activeElement !== el) return;
      const clamped = Math.min(pos, el.value.length);
      el.setSelectionRange(clamped, clamped);
      pendingCaretRef.current = null;
    }, [displayValue]);

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [displayValue]);

    const closePopover = () => {
      setPopoverOpen(false);
      setPopoverFilter("");
      setPopoverIndex(0);
      mentionAnchorRef.current = null;
    };

    const insertToken = useCallback(
      (item: MentionableItem) => {
        const el = innerRef.current;
        const anchor = mentionAnchorRef.current;
        const display = el?.value ?? displayValue;

        let start = anchor?.at ?? display.length;
        let end = anchor?.cursor ?? start + 1;

        if (anchor === null && el) {
          const cursor = el.selectionStart ?? display.length;
          end = cursor;
          start = cursor;
          for (let i = cursor - 1; i >= 0; i--) {
            const ch = display[i]!;
            if (ch === MENTION_THUMB_SLOT_CHAR) continue;
            if (ch === "@") {
              start = i;
              break;
            }
            if (/\s/.test(ch)) break;
          }
        }

        const token = `@${item.label} `;
        let next = `${display.slice(0, start)}${token}${display.slice(end)}`;
        if (inlineThumbEnabled) {
          next = ensureMentionThumbSlots(next, mentionables, mentionEdition);
        }
        pendingCaretRef.current = start + token.length;
        setDisplayDraft(next);
        flushEmit(next);
        closePopover();
        requestAnimationFrame(() => {
          if (innerRef.current) {
            const newPos = pendingCaretRef.current ?? start + token.length;
            innerRef.current.focus();
            innerRef.current.setSelectionRange(newPos, newPos);
            pendingCaretRef.current = null;
          }
        });
      },
      [displayValue, flushEmit, inlineThumbEnabled, mentionEdition, mentionables, setDisplayDraft],
    );

    const onTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      const raw = e.target.value;
      const nextDisplay = inlineThumbEnabled
        ? ensureMentionThumbSlots(raw, mentionables, mentionEdition)
        : raw;
      const cursor = e.target.selectionStart ?? nextDisplay.length;
      if (nextDisplay !== raw) {
        pendingCaretRef.current = cursor + (nextDisplay.length - raw.length);
      } else {
        pendingCaretRef.current = cursor;
      }
      scheduleEmit(nextDisplay);
      let i = cursor - 1;
      while (i >= 0) {
        const ch = nextDisplay[i]!;
        if (ch === MENTION_THUMB_SLOT_CHAR) {
          i--;
          continue;
        }
        if (/\s/.test(ch)) break;
        if (ch === "@") {
          const tail = stripMentionThumbSlots(nextDisplay.slice(i + 1, cursor));
          const matched = mentionables.some((m) => m.label === tail);
          if (!matched && !tail.startsWith("<")) {
            mentionAnchorRef.current = { at: i, cursor };
            setPopoverOpen(true);
            setPopoverFilter(tail);
            setPopoverIndex(0);
            setAnchorTick((t) => t + 1);
            return;
          }
        }
        i--;
      }
      closePopover();
    };

    useLayoutEffect(() => {
      if (!popoverOpen) return;
      setAnchorTick((t) => t + 1);
    }, [popoverOpen, displayValue, popoverFilter]);

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!popoverOpen) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setPopoverIndex((idx) => Math.min(filtered.length - 1, idx + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setPopoverIndex((idx) => Math.max(0, idx - 1));
      } else if (e.key === "Enter") {
        const item = filtered[popoverIndex];
        if (item) {
          e.preventDefault();
          insertToken(item);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        closePopover();
      }
    };

    const clearHoverPreview = useCallback(() => {
      hoverIdRef.current = null;
      setHoverPreview(null);
    }, []);

    const updateHoverPreview = useCallback(
      (clientX: number, clientY: number) => {
        if (!hoverPreviewEnabled || disabled || popoverOpen) {
          clearHoverPreview();
          return;
        }

        if (inlineThumbHoverEnabled) {
          const thumbHit =
            inlineThumbMirrorRef.current?.resolveThumbAtPoint(
              clientX,
              clientY,
            );
          if (thumbHit) {
            if (hoverIdRef.current !== thumbHit.item.id) {
              hoverIdRef.current = thumbHit.item.id;
            }
            setHoverPreview(thumbHit);
            return;
          }
        }

        if (!textHoverPreviewEnabled) {
          clearHoverPreview();
          return;
        }

        const el = innerRef.current;
        if (!el) return;

        const index = getTextareaIndexFromClientPoint(el, clientX, clientY);
        const hit = findMentionRangeAtDisplayIndex(
          displayValue,
          index,
          mentionables,
        );
        if (!hit?.item.previewUrl) {
          if (hoverIdRef.current) clearHoverPreview();
          return;
        }

        const anchorRect = getMentionRangeClientRect(el, hit.start, hit.end);
        if (!anchorRect) {
          clearHoverPreview();
          return;
        }

        if (hoverIdRef.current === hit.item.id) {
          setHoverPreview((prev) =>
            prev?.item.id === hit.item.id && prev.anchorRect === anchorRect
              ? prev
              : { item: hit.item, anchorRect },
          );
          return;
        }

        hoverIdRef.current = hit.item.id;
        setHoverPreview({ item: hit.item, anchorRect });
      },
      [
        hoverPreviewEnabled,
        inlineThumbHoverEnabled,
        textHoverPreviewEnabled,
        disabled,
        popoverOpen,
        displayValue,
        mentionables,
        clearHoverPreview,
      ],
    );

    const onMouseMove = useCallback(
      (e: MouseEvent<HTMLTextAreaElement>) => {
        if (!hoverPreviewEnabled) return;
        if (hoverRafRef.current != null) {
          cancelAnimationFrame(hoverRafRef.current);
        }
        const { clientX, clientY } = e;
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = null;
          updateHoverPreview(clientX, clientY);
        });
      },
      [hoverPreviewEnabled, updateHoverPreview],
    );

    const onMouseLeave = useCallback(() => {
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      clearHoverPreview();
    }, [clearHoverPreview]);

    useEffect(() => {
      if (popoverOpen) clearHoverPreview();
    }, [popoverOpen, clearHoverPreview]);

    useEffect(
      () => () => {
        if (hoverRafRef.current != null) {
          cancelAnimationFrame(hoverRafRef.current);
        }
        const el = innerRef.current;
        if (el) disposeTextareaCaretMirror(el);
      },
      [],
    );

    const resolvedTextareaClassName =
      className ??
      `${RF_FORM_CONTROL} w-full resize-none overflow-hidden rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-snug text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none${fillHeight ? " min-h-0 flex-1 h-full overflow-y-auto" : ""}`;

    return (
      <div
        ref={wrapperRef}
        className={
          wrapperClassName
            ? `relative overflow-visible ${fillHeight ? "flex h-full min-h-0 flex-col " : ""}${wrapperClassName}`
            : `relative overflow-visible${fillHeight ? " flex h-full min-h-0 flex-col" : ""}`
        }
      >
        <div className={cn("relative", fillHeight && "flex min-h-0 flex-1 flex-col")}>
          {inlineThumbEnabled ? (
            <MentionInlineThumbMirror
              ref={inlineThumbMirrorRef}
              textareaRef={innerRef}
              displayValue={displayValue}
              mentionables={mentionables}
              enabled={inlineThumbEnabled}
              edition={mentionEdition}
              textareaClassName={resolvedTextareaClassName}
            />
          ) : null}
          <textarea
            ref={setRef}
            value={displayValue}
            onChange={onTextChange}
            onKeyDown={onKeyDown}
            onKeyDownCapture={onKeyDownCapture}
            onPaste={onPaste}
            onFocus={onDraftFocus}
            onBlur={(e) => {
              onDraftBlur(e.currentTarget.value);
              onBlur?.();
            }}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            autoFocus={autoFocus}
            rows={fillHeight ? 1 : rows}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
              resolvedTextareaClassName,
              inlineThumbEnabled && MENTION_INLINE_THUMB_TEXTAREA_CLASS,
            )}
            style={style}
          />
        </div>
        <MentionPickerPortal
          open={popoverOpen}
          anchorEl={wrapperRef.current}
          getAnchorRect={getMentionAnchorRect}
          items={filtered}
          selectedIndex={popoverIndex}
          headerTitle={mentionPickerTitle}
          emptyHint={mentionPickerEmptyHint}
          onSelect={insertToken}
          onHoverIndex={setPopoverIndex}
          onClose={closePopover}
        />
        <MentionHoverPreviewPortal
          item={hoverPreview?.item ?? null}
          anchorRect={hoverPreview?.anchorRect ?? null}
        />
      </div>
    );
  },
);
