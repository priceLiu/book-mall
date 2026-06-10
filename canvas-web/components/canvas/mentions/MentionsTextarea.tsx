"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
  type CSSProperties,
} from "react";

import { RF_FORM_CONTROL } from "@/lib/canvas/react-flow-classes";
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
  onChange: (value: string, referencedIds: string[]) => void;
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
    },
    ref,
  ) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const mentionAnchorRef = useRef<MentionAnchor | null>(null);
    const pendingCaretRef = useRef<number | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [popoverFilter, setPopoverFilter] = useState("");
    const [popoverIndex, setPopoverIndex] = useState(0);

    const displayValue = useMemo(
      () => promptToDisplay(value, mentionables),
      [value, mentionables],
    );

    const setRef = (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    };

    const emit = useCallback(
      (display: string) => {
        const canonical = promptFromDisplay(display, mentionables);
        onChange(canonical, parseReferencedIds(canonical));
      },
      [mentionables, onChange],
    );

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
            if (display[i] === "@") {
              start = i;
              break;
            }
            if (/\s/.test(display[i])) break;
          }
        }

        const token = `@${item.label} `;
        const next = `${display.slice(0, start)}${token}${display.slice(end)}`;
        pendingCaretRef.current = start + token.length;
        emit(next);
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
      [displayValue, emit],
    );

    const onTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      const nextDisplay = e.target.value;
      const cursor = e.target.selectionStart ?? nextDisplay.length;
      pendingCaretRef.current = cursor;
      emit(nextDisplay);
      let i = cursor - 1;
      while (i >= 0 && !/\s/.test(nextDisplay[i])) {
        if (nextDisplay[i] === "@") {
          const tail = nextDisplay.slice(i + 1, cursor);
          const matched = mentionables.some((m) => m.label === tail);
          if (!matched && !tail.startsWith("<")) {
            mentionAnchorRef.current = { at: i, cursor };
            setPopoverOpen(true);
            setPopoverFilter(tail);
            setPopoverIndex(0);
            return;
          }
        }
        i--;
      }
      closePopover();
    };

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

    return (
      <div
        ref={wrapperRef}
        className={
          wrapperClassName
            ? `relative ${fillHeight ? "flex h-full min-h-0 flex-col " : ""}${wrapperClassName}`
            : `relative${fillHeight ? " flex h-full min-h-0 flex-col" : ""}`
        }
      >
        <textarea
          ref={setRef}
          value={displayValue}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          autoFocus={autoFocus}
          rows={fillHeight ? 1 : rows}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          className={
            className ??
            `${RF_FORM_CONTROL} w-full resize-none overflow-hidden rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-snug text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none${fillHeight ? " min-h-0 flex-1 h-full overflow-y-auto" : ""}`
          }
          style={style}
        />
        <MentionPickerPortal
          open={popoverOpen}
          anchorEl={wrapperRef.current}
          items={filtered}
          selectedIndex={popoverIndex}
          emptyHint="暂无已生成的角色图，请先在角色列生成。"
          onSelect={insertToken}
          onHoverIndex={setPopoverIndex}
          onClose={closePopover}
        />
      </div>
    );
  },
);
