"use client";

/**
 * 轻量 Mentions 编辑器
 *
 * - 存储格式：`@<nodeId>`（与后端 expandMentions 兼容）
 * - 编辑显示：`@文件名` / `@文 · …`（来自 mentionables.label）
 * - 输入 `@` 弹出上游列表；在光标处插入，不会跑到文末
 */

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

import { RF_NODE_SCROLL, RF_NO_WHEEL } from "@/lib/canvas/react-flow-classes";

export type MentionableItem = {
  id: string;
  /** popover / 正文里显示的标签，如 "1.png" */
  label: string;
  kind?: string;
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
    },
    ref,
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const mentionAnchorRef = useRef<MentionAnchor | null>(null);
    /** 本地编辑后待恢复的光标（受控 value 重渲染会冲掉浏览器光标） */
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
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPopoverIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPopoverIndex((i) => Math.max(0, i - 1));
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
      <div className={wrapperClassName ? `relative ${wrapperClassName}` : "relative"}>
        <textarea
          ref={setRef}
          value={displayValue}
          onChange={onTextChange}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          className={
            className ??
            `${RF_NODE_SCROLL} w-full resize-none rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[12px] text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`
          }
          style={style}
        />
        {popoverOpen && filtered.length > 0 ? (
          <div className={`nodrag absolute left-2 top-full z-30 mt-1 max-h-64 w-72 max-w-[90vw] overflow-y-auto rounded-md border border-white/15 bg-black/95 text-[12px] shadow-2xl ${RF_NO_WHEEL}`}>
            <div className="border-b border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--canvas-muted)]">
              引用上游 · ↑↓ 选择 · Enter 插入 · Esc 取消
            </div>
            {filtered.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertToken(m);
                }}
                onMouseEnter={() => setPopoverIndex(i)}
                className={`flex w-full items-center justify-between px-2 py-1.5 text-left ${
                  i === popoverIndex
                    ? "bg-[var(--canvas-accent)]/30 text-white"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                <span className="truncate">@{m.label}</span>
                {m.kind ? (
                  <span className="ml-2 shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                    {m.kind}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  },
);
