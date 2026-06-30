"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  type Ref,
} from "react";

import {
  handleLibtvDockWheelScroll,
  LIBTV_INPUT_DOCK_SELECTOR,
} from "@/lib/canvas/canvas-form-wheel";
import {
  buildEditableFragment,
  createMentionBadge,
  MENTION_BADGE_ATTR,
  serializeEditable,
} from "@/lib/canvas/mention-editable-dom";
import {
  resolveCaretTextAnchor,
  scanMentionTriggerBeforeCursor,
} from "@/lib/canvas/mention-editable-trigger";
import { getMentionDragId, hasMentionDrag } from "@/lib/canvas/mention-drag";
import {
  PRO2_DOCK_TEXTAREA_INSET_CLASS,
  PRO2_DOCK_TEXTAREA_SCROLL_CLASS,
} from "@/lib/canvas/story-pro2-node-chrome";
import { useDeferredTextCommit } from "@/lib/canvas/use-deferred-text-commit";
import { cn } from "@/lib/utils";
import {
  parseReferencedIds,
  type MentionableItem,
  type MentionsTextareaCommitHandle,
} from "./MentionsTextarea";
import { MentionHoverPreviewPortal } from "./mention-hover-preview";
import { MentionPickerPortal } from "./mention-picker-portal";

/**
 * 基于 `contenteditable` 的 @mention 输入框（LibTV 同款）：
 * @mention 是真实内联原子节点（[16px 图][@标签]），随文字自然排版与滚动，
 * 不再需要 textarea + 镜像测量 overlay。是 `MentionsTextarea` 的 contenteditable 重写。
 */
export type MentionsEditableProps = {
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
  wrapperClassName?: string;
  style?: CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
  fillHeight?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
  onPaste?: (e: ClipboardEvent<HTMLDivElement>) => void;
  onKeyDownCapture?: (e: KeyboardEvent<HTMLDivElement>) => void;
  mentionPickerTitle?: string;
  mentionPickerEmptyHint?: string;
  /** 悬停 @mention 显示大图预览 */
  mentionHoverPreview?: boolean;
  /** 兼容旧 API：contenteditable 下内联缩略图始终开启，无需该开关 */
  mentionInlineThumb?: boolean;
  mentionInlineThumbHoverOnText?: boolean;
  mentionEdition?: "pro2" | "sbv1";
  /** LibTV Dock 内 placeholder 与正文共用 inset（默认 Pro2 大左侧留白） */
  dockInsetClassName?: string;
  commitHandleRef?: Ref<MentionsTextareaCommitHandle>;
};

type TriggerAnchor = {
  /** @ 所在文本节点 */
  node: Text;
  /** @ 在该文本节点内的偏移 */
  at: number;
};

function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof doc.caretRangeFromPoint === "function") {
    return doc.caretRangeFromPoint(x, y);
  }
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      const r = document.createRange();
      r.setStart(pos.offsetNode, pos.offset);
      r.collapse(true);
      return r;
    }
  }
  return null;
}

function placeCaretAtStart(root: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

export const MentionsEditable = forwardRef<HTMLDivElement, MentionsEditableProps>(
  function MentionsEditable(
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
      mentionEdition = "pro2",
      dockInsetClassName,
      commitHandleRef,
    },
    ref,
  ) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const triggerAnchorRef = useRef<TriggerAnchor | null>(null);
    const focusedRef = useRef(false);
    const hoverRafRef = useRef<number | null>(null);
    const lastValueRef = useRef<string>("\u0000"); // 强制首次渲染

    const [isEmpty, setIsEmpty] = useState(!value);
    const [libtvDock, setLibtvDock] = useState(false);
    const [dropCaret, setDropCaret] = useState<{
      left: number;
      top: number;
      height: number;
    } | null>(null);
    const dragRafRef = useRef<number | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [popoverFilter, setPopoverFilter] = useState("");
    const [popoverIndex, setPopoverIndex] = useState(0);
    const [anchorTick, setAnchorTick] = useState(0);
    const [hoverPreview, setHoverPreview] = useState<{
      item: MentionableItem;
      anchorRect: DOMRect;
      clientX: number;
      clientY: number;
    } | null>(null);

    const mentionablesRef = useRef(mentionables);
    mentionablesRef.current = mentionables;

    const emit = useCallback(
      (store: string, commit: boolean) => {
        onChange(store, parseReferencedIds(store), { commit });
      },
      [onChange],
    );

    const { schedule, flush, onFocus, onBlur: deferOnBlur } =
      useDeferredTextCommit(value, (store, meta) => emit(store, meta.commit));

    /** 把当前 DOM 序列化并调度提交 */
    const syncFromDom = useCallback(
      (mode: "schedule" | "flush") => {
        const root = editorRef.current;
        if (!root) return;
        const store = serializeEditable(root);
        lastValueRef.current = store;
        setIsEmpty(store.length === 0);
        if (mode === "flush") flush(store);
        else schedule(store);
      },
      [flush, schedule],
    );

    /** 外部 value / mentionables 变化时重建 DOM（聚焦中不动，避免破坏光标） */
    useEffect(() => {
      const root = editorRef.current;
      if (!root) return;
      if (focusedRef.current) return;
      if (value === lastValueRef.current) {
        // 仅 mentionables 元数据可能变化（标签/缩略图）——重建以刷新徽标
      }
      root.replaceChildren(
        buildEditableFragment(value, mentionablesRef.current, mentionEdition),
      );
      lastValueRef.current = value;
      setIsEmpty(value.length === 0);
    }, [value, mentionables, mentionEdition]);

    const setEditorRef = useCallback(
      (el: HTMLDivElement | null) => {
        editorRef.current = el;
        if (el) setLibtvDock(!!el.closest(LIBTV_INPUT_DOCK_SELECTOR));
        if (typeof ref === "function") ref(el);
        else if (ref)
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
      },
      [ref],
    );

    useImperativeHandle(
      commitHandleRef,
      () => ({
        flushDraft: () => {
          const root = editorRef.current;
          if (root) flush(serializeEditable(root));
        },
      }),
      [flush],
    );

    // ---- @ 触发检测 ----
    const filtered = useMemo(() => {
      if (!popoverFilter) return mentionables;
      const f = popoverFilter.toLowerCase();
      return mentionables.filter(
        (m) =>
          m.label.toLowerCase().includes(f) || m.id.toLowerCase().includes(f),
      );
    }, [mentionables, popoverFilter]);

    useEffect(() => {
      if (popoverIndex >= filtered.length) setPopoverIndex(0);
    }, [filtered.length, popoverIndex]);

    const closePopover = useCallback(() => {
      setPopoverOpen(false);
      setPopoverFilter("");
      setPopoverIndex(0);
      triggerAnchorRef.current = null;
    }, []);

    const detectTrigger = useCallback(() => {
      const root = editorRef.current;
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return closePopover();
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return closePopover();

      const anchor = resolveCaretTextAnchor(root, range);
      if (!anchor) return closePopover();

      const textBefore = (anchor.node.textContent ?? "").slice(0, anchor.offset);
      const hit = scanMentionTriggerBeforeCursor(
        textBefore,
        mentionablesRef.current,
      );
      if (!hit) return closePopover();

      triggerAnchorRef.current = { node: anchor.node, at: hit.at };
      setPopoverFilter(hit.filter);
      setPopoverOpen(true);
      setPopoverIndex(0);
      setAnchorTick((t) => t + 1);
    }, [closePopover]);

    const getAnchorRect = useCallback(() => {
      void anchorTick;
      const anchor = triggerAnchorRef.current;
      const root = editorRef.current;
      if (!root) return null;
      try {
        const range = document.createRange();
        if (anchor && root.contains(anchor.node)) {
          const len = anchor.node.textContent?.length ?? 0;
          range.setStart(anchor.node, Math.min(anchor.at, len));
          range.collapse(true);
        } else {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0).cloneRange();
            range.setStart(r.startContainer, r.startOffset);
            range.collapse(true);
          } else {
            return null;
          }
        }
        const rect = range.getBoundingClientRect();
        return { left: rect.left, top: rect.top, bottom: rect.bottom };
      } catch {
        return null;
      }
    }, [anchorTick]);

    const getDockShellRect = useCallback(() => {
      const shell = editorRef.current?.closest(
        LIBTV_INPUT_DOCK_SELECTOR,
      ) as HTMLElement | null;
      return shell?.getBoundingClientRect() ?? null;
    }, []);

    /** 在给定 range 处放入徽标 + 尾随空格，光标落到空格后 */
    const insertBadgeAtRange = useCallback(
      (item: MentionableItem, range: Range, opts?: { padBefore?: boolean }) => {
        const frag = document.createDocumentFragment();
        if (opts?.padBefore) {
          const c = range.startContainer;
          if (c.nodeType === Node.TEXT_NODE) {
            const before = (c.textContent ?? "").slice(0, range.startOffset);
            if (before.length > 0 && !/\s$/.test(before)) {
              frag.appendChild(document.createTextNode("\u00a0"));
            }
          }
        }
        const badge = createMentionBadge(item.id, item, mentionEdition);
        const space = document.createTextNode("\u00a0");
        frag.appendChild(badge);
        frag.appendChild(space);
        range.deleteContents();
        range.insertNode(frag);

        const after = document.createRange();
        after.setStart(space, space.length);
        after.collapse(true);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(after);

        syncFromDom("flush");
      },
      [mentionEdition, syncFromDom],
    );

    /** 选中 mention：把 @filter 文本替换为徽标 + 尾随空格 */
    const insertMention = useCallback(
      (item: MentionableItem) => {
        const root = editorRef.current;
        const anchor = triggerAnchorRef.current;
        if (!root) return;
        root.focus();

        const range = document.createRange();
        const sel = window.getSelection();

        if (anchor && root.contains(anchor.node)) {
          const node = anchor.node;
          const caretOffset =
            sel && sel.rangeCount > 0 && sel.getRangeAt(0).startContainer === node
              ? sel.getRangeAt(0).startOffset
              : (node.textContent?.length ?? anchor.at + 1);
          range.setStart(node, Math.min(anchor.at, node.textContent?.length ?? 0));
          range.setEnd(
            node,
            Math.min(
              Math.max(caretOffset, anchor.at),
              node.textContent?.length ?? 0,
            ),
          );
        } else if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          range.setStart(r.startContainer, r.startOffset);
          range.setEnd(r.endContainer, r.endOffset);
        } else {
          return;
        }

        closePopover();
        insertBadgeAtRange(item, range);
      },
      [closePopover, insertBadgeAtRange],
    );

    // ---- 拖拽参考图缩略图到正文 → 落点处插入 @mention ----
    const updateDropCaret = useCallback((x: number, y: number) => {
      const root = editorRef.current;
      const wrap = wrapperRef.current;
      if (!root || !wrap) return;
      const range = caretRangeFromPoint(x, y);
      if (!range || !root.contains(range.startContainer)) {
        setDropCaret(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      setDropCaret({
        left: rect.left - wr.left,
        top: rect.top - wr.top,
        height: rect.height || 18,
      });
    }, []);

    const clearDropCaret = useCallback(() => {
      if (dragRafRef.current != null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      setDropCaret(null);
    }, []);

    const onDragOver = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        if (disabled || !hasMentionDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const { clientX, clientY } = e;
        if (dragRafRef.current != null) cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null;
          updateDropCaret(clientX, clientY);
        });
      },
      [disabled, updateDropCaret],
    );

    const onDragLeave = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        const root = editorRef.current;
        const rt = e.relatedTarget as Node | null;
        if (root && rt && root.contains(rt)) return;
        clearDropCaret();
      },
      [clearDropCaret],
    );

    const onDrop = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        clearDropCaret();
        if (disabled) return;
        const id = getMentionDragId(e.dataTransfer);
        if (!id) return;
        e.preventDefault();
        const item = mentionablesRef.current.find((m) => m.id === id);
        if (!item) return;
        const root = editorRef.current;
        if (!root) return;
        root.focus();
        const range =
          caretRangeFromPoint(e.clientX, e.clientY) ??
          (() => {
            const r = document.createRange();
            r.selectNodeContents(root);
            r.collapse(false);
            return r;
          })();
        if (!root.contains(range.startContainer)) {
          range.selectNodeContents(root);
          range.collapse(false);
        }
        closePopover();
        insertBadgeAtRange(item, range, { padBefore: true });
      },
      [clearDropCaret, closePopover, disabled, insertBadgeAtRange],
    );

    const detectTriggerRafRef = useRef<number | null>(null);
    const scheduleDetectTrigger = useCallback(() => {
      if (detectTriggerRafRef.current != null) {
        cancelAnimationFrame(detectTriggerRafRef.current);
      }
      detectTriggerRafRef.current = requestAnimationFrame(() => {
        detectTriggerRafRef.current = null;
        detectTrigger();
      });
    }, [detectTrigger]);

    // ---- 事件 ----
    const onInput = useCallback(() => {
      syncFromDom("schedule");
      scheduleDetectTrigger();
    }, [scheduleDetectTrigger, syncFromDom]);

    const onKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (popoverOpen) {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            setPopoverIndex((i) => Math.min(filtered.length - 1, i + 1));
            return;
          }
          if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            setPopoverIndex((i) => Math.max(0, i - 1));
            return;
          }
          if (e.key === "Enter") {
            const item = filtered[popoverIndex];
            if (item) {
              e.preventDefault();
              insertMention(item);
              return;
            }
          }
          if (e.key === "Escape") {
            e.preventDefault();
            closePopover();
            return;
          }
        }

        if (
          e.key === "Enter" &&
          !e.nativeEvent.isComposing &&
          !e.shiftKey
        ) {
          // Dock 内 Enter 换行；阻止冒泡避免触达画布快捷键/生成逻辑
          e.preventDefault();
          e.stopPropagation();
          document.execCommand("insertLineBreak");
          syncFromDom("schedule");
        } else if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          document.execCommand("insertLineBreak");
          syncFromDom("schedule");
        }
      },
      [
        closePopover,
        filtered,
        insertMention,
        popoverIndex,
        popoverOpen,
        syncFromDom,
      ],
    );

    const onPasteInternal = useCallback(
      (e: ClipboardEvent<HTMLDivElement>) => {
        onPaste?.(e);
        if (e.defaultPrevented) return;
        // 仅插入纯文本，避免富文本 / base64 图片进入 contenteditable
        const text = e.clipboardData.getData("text/plain");
        if (text) {
          e.preventDefault();
          document.execCommand("insertText", false, text);
          syncFromDom("schedule");
        }
      },
      [onPaste, syncFromDom],
    );

    const clearHoverPreview = useCallback(() => {
      setHoverPreview(null);
    }, []);

    const onMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!mentionHoverPreview || disabled || popoverOpen) return;
        const target = e.target as HTMLElement;
        const badge = target.closest(
          `[${MENTION_BADGE_ATTR}]`,
        ) as HTMLElement | null;
        if (!badge) {
          if (hoverPreview) clearHoverPreview();
          return;
        }
        const id = badge.getAttribute(MENTION_BADGE_ATTR);
        const item = mentionablesRef.current.find((m) => m.id === id);
        if (!item?.previewUrl) {
          if (hoverPreview) clearHoverPreview();
          return;
        }
        const rect = badge.getBoundingClientRect();
        const { clientX, clientY } = e;
        if (hoverRafRef.current != null) cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = null;
          setHoverPreview({ item, anchorRect: rect, clientX, clientY });
        });
      },
      [mentionHoverPreview, disabled, popoverOpen, hoverPreview, clearHoverPreview],
    );

    const onMouseLeave = useCallback(() => {
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      clearHoverPreview();
    }, [clearHoverPreview]);

    const handleFocus = useCallback(() => {
      focusedRef.current = true;
      onFocus();
      const root = editorRef.current;
      if (root && libtvDock && !serializeEditable(root).length) {
        requestAnimationFrame(() => {
          const el = editorRef.current;
          if (!el || serializeEditable(el).length) return;
          placeCaretAtStart(el);
        });
      }
    }, [onFocus, libtvDock]);

    const handleClick = useCallback(() => {
      const root = editorRef.current;
      if (!root || !libtvDock || serializeEditable(root).length) return;
      requestAnimationFrame(() => placeCaretAtStart(root));
    }, [libtvDock]);

    const handleBlur = useCallback(() => {
      focusedRef.current = false;
      const root = editorRef.current;
      deferOnBlur(root ? serializeEditable(root) : value);
      closePopover();
      onBlur?.();
    }, [closePopover, deferOnBlur, onBlur, value]);

    // 全局 flush（生成按钮等）
    useEffect(() => {
      const onFlush = () => {
        const root = editorRef.current;
        if (root) flush(serializeEditable(root));
      };
      window.addEventListener("canvas:flush-text-drafts", onFlush);
      return () =>
        window.removeEventListener("canvas:flush-text-drafts", onFlush);
    }, [flush]);

    // Dock 内滚轮滚动（与 textarea 版一致）
    useEffect(() => {
      const el = editorRef.current;
      if (!el?.closest(LIBTV_INPUT_DOCK_SELECTOR)) return;
      const onWheel = (ev: WheelEvent) => handleLibtvDockWheelScroll(ev);
      el.addEventListener("wheel", onWheel, { capture: true, passive: false });
      return () => el.removeEventListener("wheel", onWheel, { capture: true });
    }, []);

    useEffect(() => {
      if (popoverOpen) clearHoverPreview();
    }, [popoverOpen, clearHoverPreview]);

    useEffect(() => {
      if (!autoFocus) return;
      editorRef.current?.focus();
    }, [autoFocus]);

    useEffect(
      () => () => {
        if (hoverRafRef.current != null)
          cancelAnimationFrame(hoverRafRef.current);
        if (dragRafRef.current != null)
          cancelAnimationFrame(dragRafRef.current);
        if (detectTriggerRafRef.current != null)
          cancelAnimationFrame(detectTriggerRafRef.current);
      },
      [],
    );

    const stretchInParent = fillHeight || libtvDock;

    const editorStyle: CSSProperties = {
      ...(stretchInParent ? null : { minHeight: `${Math.max(1, rows) * 1.6}em` }),
      ...style,
    };

    const editorClassName = cn(
      className ??
        "w-full rounded-md border border-white/10 bg-black/30 p-2 text-[13px] leading-relaxed text-white focus:border-[var(--canvas-accent)]/60 focus:outline-none",
      "whitespace-pre-wrap break-words outline-none",
      stretchInParent && "min-h-0 h-full flex-1 overflow-y-auto",
      libtvDock && PRO2_DOCK_TEXTAREA_SCROLL_CLASS,
    );

    return (
      <div
        ref={wrapperRef}
        className={cn(
          "relative overflow-visible",
          stretchInParent && "flex h-full min-h-0 flex-1 flex-col",
          wrapperClassName,
        )}
      >
        <div
          ref={setEditorRef}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          contentEditable={!disabled}
          suppressContentEditableWarning
          spellCheck={false}
          className={editorClassName}
          style={editorStyle}
          onInput={onInput}
          onKeyDown={onKeyDown}
          onKeyDownCapture={onKeyDownCapture}
          onPaste={onPasteInternal}
          onFocus={handleFocus}
          onClick={handleClick}
          onBlur={handleBlur}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
        {dropCaret ? (
          <div
            className="pointer-events-none absolute z-10 w-0.5 animate-pulse rounded-full bg-[var(--canvas-accent)] shadow-[0_0_6px_var(--canvas-accent)]"
            style={{
              left: dropCaret.left,
              top: dropCaret.top,
              height: dropCaret.height,
            }}
            aria-hidden
          />
        ) : null}
        {isEmpty && placeholder ? (
          <div
            className={cn(
              "pointer-events-none absolute left-0 top-0 right-0 select-none text-[13px] leading-relaxed text-white/30",
              libtvDock
                ? dockInsetClassName ?? PRO2_DOCK_TEXTAREA_INSET_CLASS
                : "p-2",
            )}
          >
            {placeholder}
          </div>
        ) : null}

        <MentionPickerPortal
          open={popoverOpen}
          anchorEl={wrapperRef.current}
          getAnchorRect={getAnchorRect}
          getDockShellRect={getDockShellRect}
          items={filtered}
          selectedIndex={popoverIndex}
          headerTitle={mentionPickerTitle}
          emptyHint={mentionPickerEmptyHint}
          onSelect={insertMention}
          onHoverIndex={setPopoverIndex}
          onClose={closePopover}
        />
        <MentionHoverPreviewPortal
          item={hoverPreview?.item ?? null}
          anchorRect={hoverPreview?.anchorRect ?? null}
          pointerX={hoverPreview?.clientX}
          pointerY={hoverPreview?.clientY}
        />
      </div>
    );
  },
);
