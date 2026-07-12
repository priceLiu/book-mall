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

import {
  buildPromptEditableFragment,
  createImageRefBadge,
  resolveCaretTextAnchor,
  scanImageRefTriggerBeforeCursor,
  serializePromptEditable,
  type QrPromptImageRef,
} from "@/lib/qr-prompt-mention-dom";

export type QrHappyHorseImageRef = QrPromptImageRef;

type TriggerAnchor = {
  node: Text;
  at: number;
};

type PickerPosition = {
  left: number;
  top: number;
  width: number;
};

const PICKER_GAP = 8;
const PICKER_Z = 5000;
const PICKER_EST_HEIGHT = 260;

function filterImageRefs(items: QrPromptImageRef[], query: string): QrPromptImageRef[] {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(({ index }) => {
    const n = String(index);
    return (
      n.startsWith(q) ||
      `image ${n}`.includes(q) ||
      `image${n}`.includes(q) ||
      `图${n}`.includes(q)
    );
  });
}

function resolvePickerPosition(
  anchorRect: DOMRect,
  pickerHeight: number,
): PickerPosition {
  const width = Math.min(Math.max(anchorRect.width, 240), window.innerWidth - 24);
  let left = anchorRect.left;
  left = Math.min(Math.max(12, left), window.innerWidth - width - 12);

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
  id?: string;
  value: string;
  maxLength: number;
  disabled?: boolean;
  referenceImages: QrPromptImageRef[];
  onChange: (value: string) => void;
  /** 默认 min-h-[180px]；文字转视频中栏可传 min-h-[360px] */
  minHeightClass?: string;
};

export function QrHappyHorsePromptTextarea({
  id,
  value,
  maxLength,
  disabled,
  referenceImages,
  onChange,
  minHeightClass = "min-h-[180px]",
}: Props) {
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
      let store = nextValue ?? serializePromptEditable(root);
      if (store.length > maxLength) {
        store = store.slice(0, maxLength);
        root.replaceChildren(buildPromptEditableFragment(store, refsRef.current));
      }
      lastValueRef.current = store;
      setIsEmpty(store.length === 0);
      onChange(store);
    },
    [maxLength, onChange],
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
          const r = sel.getRangeAt(0).cloneRange();
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
      const badge = createImageRefBadge(imageIndex, item);
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

  useLayoutEffect(() => {
    if (!popoverOpen || !pickerRef.current) return;
    const nextHeight = pickerRef.current.getBoundingClientRect().height;
    if (nextHeight > 0 && Math.abs(nextHeight - pickerHeight) > 2) {
      setPickerHeight(nextHeight);
      syncPickerPosition();
    }
  }, [popoverOpen, pickerHeight, syncPickerPosition, filteredImages.length]);

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
        return;
      }
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (text) {
      e.preventDefault();
      document.execCommand("insertText", false, text);
      syncFromDom();
      requestAnimationFrame(() => detectTrigger());
    }
  };

  const pickerPanel = popoverOpen ? (
    <div
      ref={pickerRef}
      className="overflow-hidden rounded-xl border shadow-lg"
      style={{
        position: "fixed",
        left: pickerPos?.left ?? -9999,
        top: pickerPos?.top ?? -9999,
        width: pickerPos?.width,
        zIndex: PICKER_Z,
        visibility: pickerPos ? "visible" : "hidden",
        borderColor: "var(--qr-border)",
        background: "var(--qr-bg-surface)",
      }}
      role="listbox"
      aria-label="选择引用图片"
    >
      {referenceImages.length === 0 ? (
        <p className="px-4 py-3 text-xs text-[var(--qr-text-muted)]">
          请先在下方上传引用图片，再输入 @ 引用
        </p>
      ) : filteredImages.length === 0 ? (
        <p className="px-4 py-3 text-xs text-[var(--qr-text-muted)]">
          没有匹配的引用图片
        </p>
      ) : (
        <ul className="max-h-[240px] overflow-y-auto p-2">
          {filteredImages.map((item, listIndex) => {
            const active = listIndex === popoverIndex;
            return (
              <li key={`${item.url}-${item.index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
                    active ? "bg-[rgba(59,130,246,0.18)]" : "hover:bg-white/5"
                  }`}
                  onMouseEnter={() => setPopoverIndex(listIndex)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertImageRef(item.index)}
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--qr-text-primary)]">
                      图 {item.index}
                    </span>
                    <span className="block text-xs text-[var(--qr-text-muted)]">
                      插入 [Image {item.index}]
                    </span>
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
    <div ref={wrapperRef} className="relative mt-3">
      <div
        ref={editorRef}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label="提示词"
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck={false}
        className={`qr-input qr-textarea-resizable ${minHeightClass} w-full whitespace-pre-wrap break-words outline-none`}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          closePopover();
          const root = editorRef.current;
          if (root) syncFromDom(serializePromptEditable(root));
        }}
      />
      {isEmpty ? (
        <div className="pointer-events-none absolute left-0 top-0 select-none px-[14px] py-[10px] text-sm text-[var(--qr-text-muted)]">
          对所需输出的文本描述… 输入 @ 引用下方图片
        </div>
      ) : null}

      {typeof document !== "undefined" && pickerPanel
        ? createPortal(pickerPanel, document.body)
        : null}
    </div>
  );
}
