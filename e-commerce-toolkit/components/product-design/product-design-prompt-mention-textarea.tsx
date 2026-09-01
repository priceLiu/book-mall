"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

import {
  buildPromptEditableFragment,
  createEcomImageRefBadge,
  resolveCaretTextAnchor,
  scanImageRefTriggerBeforeCursor,
  serializePromptEditable,
  type EcomPromptImageRef,
} from "@/lib/ecom-prompt-mention";
import { mentionRefRoleLabel } from "@/lib/product-design-mention-refs";
import { cn } from "@/lib/utils";

type TriggerAnchor = { node: Text; at: number };

type PickerPosition = { left: number; top: number; width: number };

const PICKER_GAP = 8;
const PICKER_Z = 5000;
const PICKER_EST_HEIGHT = 280;
const PICKER_MAX_WIDTH = 420;

function filterImageRefs(items: EcomPromptImageRef[], query: string): EcomPromptImageRef[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(({ index, label, token }) => {
    const n = String(index);
    return (
      n.startsWith(q) ||
      label.toLowerCase().includes(q) ||
      token.toLowerCase().includes(q) ||
      `图片${n}`.includes(q) ||
      `图${n}`.includes(q)
    );
  });
}

function resolvePickerPosition(anchorRect: DOMRect, pickerHeight: number): PickerPosition {
  const width = Math.min(
    PICKER_MAX_WIDTH,
    Math.max(280, Math.min(anchorRect.width, window.innerWidth - 24)),
  );
  let left = Math.min(Math.max(12, anchorRect.left), window.innerWidth - width - 12);
  const spaceBelow = window.innerHeight - anchorRect.bottom - PICKER_GAP;
  const spaceAbove = anchorRect.top - PICKER_GAP;
  const openAbove = spaceBelow < pickerHeight && spaceAbove > spaceBelow;
  let top = openAbove
    ? anchorRect.top - PICKER_GAP - pickerHeight
    : anchorRect.bottom + PICKER_GAP;
  top = Math.max(12, Math.min(top, window.innerHeight - pickerHeight - 12));
  return { left, top, width };
}

type Props = {
  value: string;
  disabled?: boolean;
  referenceImages: EcomPromptImageRef[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  minHeightClass?: string;
  /** 全屏弹层等场景提高层级，避免被遮罩挡住 */
  pickerZIndex?: number;
  /** 表格密排时隐藏格内快捷插入钮（顶部已有参考图条） */
  hideQuickInsert?: boolean;
};

export function ProductDesignPromptMentionTextarea({
  value,
  disabled,
  referenceImages,
  onChange,
  onBlur,
  className,
  minHeightClass = "min-h-[7rem]",
  pickerZIndex = PICKER_Z,
  hideQuickInsert = false,
}: Props) {
  const pathname = usePathname();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerAnchorRef = useRef<TriggerAnchor | null>(null);
  const focusedRef = useRef(false);
  const lastValueRef = useRef<string>("\u0000");
  const refsRef = useRef(referenceImages);
  refsRef.current = referenceImages;

  const [isEmpty, setIsEmpty] = useState(!value);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverFilter, setPopoverFilter] = useState("");
  const [popoverIndex, setPopoverIndex] = useState(0);
  const [anchorTick, setAnchorTick] = useState(0);
  const [pickerPos, setPickerPos] = useState<PickerPosition | null>(null);
  const [pickerHeight, setPickerHeight] = useState(PICKER_EST_HEIGHT);

  const filteredImages = useMemo(
    () => filterImageRefs(referenceImages, popoverFilter),
    [referenceImages, popoverFilter],
  );

  const syncFromDom = useCallback(
    (nextValue?: string) => {
      const root = editorRef.current;
      if (!root) return;
      const store = nextValue ?? serializePromptEditable(root);
      lastValueRef.current = store;
      setIsEmpty(store.length === 0);
      onChange(store);
    },
    [onChange],
  );

  useEffect(() => {
    const root = editorRef.current;
    if (!root || focusedRef.current) return;
    if (value === lastValueRef.current) {
      root.replaceChildren(buildPromptEditableFragment(value, refsRef.current));
      return;
    }
    root.replaceChildren(buildPromptEditableFragment(value, refsRef.current));
    lastValueRef.current = value;
    setIsEmpty(value.length === 0);
  }, [value, referenceImages]);

  const closePopover = useCallback(() => {
    setPopoverOpen(false);
    setPopoverFilter("");
    setPopoverIndex(0);
    triggerAnchorRef.current = null;
  }, []);

  const detectTrigger = useCallback(() => {
    const root = editorRef.current;
    if (!root || disabled) return closePopover();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return closePopover();
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return closePopover();
    const anchor = resolveCaretTextAnchor(root, range);
    if (!anchor) return closePopover();
    const textBefore = (anchor.node.textContent ?? "").slice(0, anchor.offset);
    const hit = scanImageRefTriggerBeforeCursor(textBefore);
    if (!hit) return closePopover();
    triggerAnchorRef.current = { node: anchor.node, at: hit.at };
    setPopoverFilter(hit.filter);
    setPopoverOpen(true);
    setPopoverIndex(0);
    setAnchorTick((t) => t + 1);
  }, [closePopover, disabled]);

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
          const r = sel.getRangeAt(0);
          range.setStart(r.startContainer, r.startOffset);
          range.collapse(true);
        } else {
          return null;
        }
      }
      const rect = range.getBoundingClientRect();
      return { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width };
    } catch {
      return null;
    }
  }, [anchorTick]);

  const insertImageRef = useCallback(
    (imageIndex: number) => {
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
          Math.min(Math.max(caretOffset, anchor.at), node.textContent?.length ?? 0),
        );
      } else if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        range.setStart(r.startContainer, r.startOffset);
        range.setEnd(r.endContainer, r.endOffset);
      } else {
        return;
      }
      closePopover();
      const item = refsRef.current.find((r) => r.index === imageIndex);
      const badge = createEcomImageRefBadge(item, imageIndex);
      const space = document.createTextNode("\u00a0");
      const frag = document.createDocumentFragment();
      frag.appendChild(badge);
      frag.appendChild(space);
      range.deleteContents();
      range.insertNode(frag);
      const after = document.createRange();
      after.setStart(space, space.length);
      after.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(after);
      syncFromDom();
    },
    [closePopover, syncFromDom],
  );

  const insertAtCursor = useCallback(
    (token: string) => {
      const root = editorRef.current;
      if (!root || disabled) return;
      root.focus();
      document.execCommand("insertText", false, token);
      syncFromDom();
    },
    [disabled, syncFromDom],
  );

  const syncPickerPosition = useCallback(() => {
    const rect = getAnchorRect();
    if (!rect) return;
    const measured = pickerRef.current?.getBoundingClientRect().height;
    const height = measured && measured > 0 ? measured : pickerHeight;
    setPickerPos(
      resolvePickerPosition(
        new DOMRect(rect.left, rect.top, rect.width, rect.bottom - rect.top),
        height,
      ),
    );
  }, [getAnchorRect, pickerHeight]);

  useLayoutEffect(() => {
    if (!popoverOpen) {
      setPickerPos(null);
      return;
    }
    syncPickerPosition();
    const onReflow = () => syncPickerPosition();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [popoverOpen, syncPickerPosition, filteredImages.length, referenceImages.length]);

  useEffect(() => {
    closePopover();
  }, [closePopover, pathname]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (pickerRef.current?.contains(target)) return;
      closePopover();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [closePopover, popoverOpen]);

  useEffect(() => {
    if (popoverIndex >= filteredImages.length) {
      setPopoverIndex(Math.max(0, filteredImages.length - 1));
    }
  }, [filteredImages.length, popoverIndex]);

  const onInput = useCallback(() => {
    syncFromDom();
    requestAnimationFrame(() => detectTrigger());
  }, [detectTrigger, syncFromDom]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (popoverOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredImages.length > 0) {
          setPopoverIndex((i) => (i + 1) % filteredImages.length);
        }
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredImages.length > 0) {
          setPopoverIndex((i) => (i - 1 + filteredImages.length) % filteredImages.length);
        }
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const picked = filteredImages[popoverIndex];
        if (picked) {
          e.preventDefault();
          insertImageRef(picked.index);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closePopover();
      }
    }
  };

  const pickerPanel = popoverOpen ? (
    <div
      ref={pickerRef}
      className="pointer-events-none overflow-hidden rounded-xl border border-[#e8e8ed] bg-white shadow-lg"
      style={{
        position: "fixed",
        left: pickerPos?.left ?? -9999,
        top: pickerPos?.top ?? -9999,
        width: pickerPos?.width,
        zIndex: pickerZIndex,
        visibility: pickerPos ? "visible" : "hidden",
      }}
      role="listbox"
      aria-label="选择引用图片"
    >
      {referenceImages.length === 0 ? (
        <p className="px-4 py-3 text-xs text-[#86868b]">
          请先上传风格参考与产品实拍，再输入 @ 引用
        </p>
      ) : filteredImages.length === 0 ? (
        <p className="px-4 py-3 text-xs text-[#86868b]">没有匹配的参考图</p>
      ) : (
        <ul className="pointer-events-auto max-h-[260px] overflow-y-auto p-2">
          {filteredImages.map((item, listIndex) => {
            const active = listIndex === popoverIndex;
            return (
              <li key={`${item.url}-${item.index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                    active ? "bg-[#f0f6ff]" : "hover:bg-[#f5f5f7]",
                  )}
                  onMouseEnter={() => setPopoverIndex(listIndex)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertImageRef(item.index)}
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#f5f5f7]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[#1d1d1f]">
                      {item.token} · {mentionRefRoleLabel(item.role, item.kind)}
                    </span>
                    <span className="block truncate text-xs text-[#86868b]">{item.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} className="relative">
      {!hideQuickInsert && referenceImages.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {referenceImages.map((item) => (
            <button
              key={item.index}
              type="button"
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-lg border border-[#e8e8ed] bg-white px-1.5 py-0.5 text-[10px] text-[#6e6e73] hover:border-[#0071e3]/35 hover:bg-[#f0f6ff] disabled:opacity-50"
              onClick={() => insertAtCursor(`${item.token} `)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                className="h-4 w-4 rounded object-cover"
              />
              {item.token.replace(/^@/, "")}
            </button>
          ))}
        </div>
      ) : null}
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck={false}
        className={cn(
          "w-full whitespace-pre-wrap break-words rounded-lg border border-[#e8e8ed] px-3 py-2 text-[12px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]/25",
          minHeightClass,
          className,
        )}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          closePopover();
          const root = editorRef.current;
          if (root) syncFromDom(serializePromptEditable(root));
          onBlur?.();
        }}
      />
      {isEmpty ? (
        <p className="mt-1 text-[10px] text-[#86868b]">
          输入 @ 引用参考图，或点上方缩略图快速插入
        </p>
      ) : null}
      {typeof document !== "undefined" && pickerPanel
        ? createPortal(pickerPanel, document.body)
        : null}
    </div>
  );
}
