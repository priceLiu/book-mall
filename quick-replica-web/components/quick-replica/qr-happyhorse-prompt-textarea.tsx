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

import { formatHappyHorseImageRefToken } from "@/lib/qr-template-types";

export type QrHappyHorseImageRef = {
  url: string;
  /** 1-based index for [Image N] */
  index: number;
};

type MentionAnchor = {
  start: number;
  end: number;
  query: string;
};

type PickerPosition = {
  left: number;
  top: number;
  width: number;
};

const PICKER_GAP = 8;
const PICKER_Z = 5000;
const PICKER_EST_HEIGHT = 260;

function detectMentionAnchor(text: string, cursor: number): MentionAnchor | null {
  const before = text.slice(0, cursor);
  const atIndex = before.lastIndexOf("@");
  if (atIndex === -1) return null;
  const query = before.slice(atIndex + 1);
  // 已有文字中间也可 @；仅当 @ 到光标之间出现空白，或已进入 [Image N] 括号时关闭
  if (/[\s\n\r]/.test(query)) return null;
  if (/[[\]]/.test(query)) return null;
  return { start: atIndex, end: cursor, query };
}

function filterImageRefs(items: QrHappyHorseImageRef[], query: string): QrHappyHorseImageRef[] {
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

function insertImageRefToken(
  text: string,
  anchor: MentionAnchor,
  imageIndex: number,
): { text: string; cursor: number } {
  const token = formatHappyHorseImageRefToken(imageIndex);
  const next = text.slice(0, anchor.start) + token + text.slice(anchor.end);
  return { text: next, cursor: anchor.start + token.length };
}

function resolvePickerPosition(
  anchorRect: DOMRect,
  pickerHeight: number,
): PickerPosition {
  const width = Math.min(anchorRect.width, window.innerWidth - 24);
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
  referenceImages: QrHappyHorseImageRef[];
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
  const anchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [mentionAnchor, setMentionAnchor] = useState<MentionAnchor | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [pickerPos, setPickerPos] = useState<PickerPosition | null>(null);
  const [pickerHeight, setPickerHeight] = useState(PICKER_EST_HEIGHT);

  const filteredImages = useMemo(
    () => filterImageRefs(referenceImages, mentionAnchor?.query ?? ""),
    [referenceImages, mentionAnchor?.query],
  );

  const pickerOpen = mentionAnchor !== null;

  const syncPickerPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const measured = pickerRef.current?.getBoundingClientRect().height;
    const height = measured && measured > 0 ? measured : pickerHeight;
    setPickerPos(resolvePickerPosition(anchor.getBoundingClientRect(), height));
  }, [pickerHeight]);

  const syncMentionAnchorFrom = useCallback(
    (text: string, cursor: number) => {
      if (disabled) {
        setMentionAnchor(null);
        return;
      }
      const anchor = detectMentionAnchor(text, cursor);
      setMentionAnchor(anchor);
      setHighlightIndex(0);
    },
    [disabled],
  );

  const syncMentionAnchor = useCallback(() => {
    const el = textareaRef.current;
    if (!el || disabled) {
      setMentionAnchor(null);
      return;
    }
    syncMentionAnchorFrom(value, el.selectionStart ?? value.length);
  }, [disabled, syncMentionAnchorFrom, value]);

  useLayoutEffect(() => {
    if (!pickerOpen) {
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
  }, [pickerOpen, syncPickerPosition, filteredImages.length, referenceImages.length]);

  useLayoutEffect(() => {
    if (!pickerOpen || !pickerRef.current) return;
    const nextHeight = pickerRef.current.getBoundingClientRect().height;
    if (nextHeight > 0 && Math.abs(nextHeight - pickerHeight) > 2) {
      setPickerHeight(nextHeight);
      syncPickerPosition();
    }
  }, [pickerOpen, pickerHeight, syncPickerPosition, filteredImages.length]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (pickerRef.current?.contains(target)) return;
      setMentionAnchor(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [pickerOpen]);

  useEffect(() => {
    if (highlightIndex >= filteredImages.length) {
      setHighlightIndex(Math.max(0, filteredImages.length - 1));
    }
  }, [filteredImages.length, highlightIndex]);

  const applyImageRef = useCallback(
    (imageIndex: number) => {
      if (!mentionAnchor) return;
      const { text, cursor } = insertImageRefToken(value, mentionAnchor, imageIndex);
      onChange(text.slice(0, maxLength));
      setMentionAnchor(null);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        const pos = Math.min(cursor, maxLength);
        el.setSelectionRange(pos, pos);
      });
    },
    [maxLength, mentionAnchor, onChange, value],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    const next = el.value.slice(0, maxLength);
    const cursor = el.selectionStart ?? next.length;
    onChange(next);
    syncMentionAnchorFrom(next, cursor);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!pickerOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      setMentionAnchor(null);
      return;
    }

    if (filteredImages.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % filteredImages.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + filteredImages.length) % filteredImages.length);
      return;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const picked = filteredImages[highlightIndex];
      if (picked) applyImageRef(picked.index);
    }
  };

  const pickerPanel = pickerOpen ? (
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
      aria-label="选择参考图"
    >
      {referenceImages.length === 0 ? (
        <p className="px-4 py-3 text-xs text-[var(--qr-text-muted)]">
          请先在下方上传参考图，再输入 @ 引用
        </p>
      ) : filteredImages.length === 0 ? (
        <p className="px-4 py-3 text-xs text-[var(--qr-text-muted)]">
          没有匹配的参考图
        </p>
      ) : (
        <ul className="max-h-[240px] overflow-y-auto p-2">
          {filteredImages.map((item, listIndex) => {
            const active = listIndex === highlightIndex;
            return (
              <li key={`${item.url}-${item.index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
                    active ? "bg-[rgba(59,130,246,0.18)]" : "hover:bg-white/5"
                  }`}
                  onMouseEnter={() => setHighlightIndex(listIndex)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyImageRef(item.index)}
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
    <div ref={anchorRef} className="relative mt-3">
      <textarea
        ref={textareaRef}
        id={id}
        className={`qr-input qr-textarea-resizable ${minHeightClass} w-full`}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder="对所需输出的文本描述… 输入 @ 引用下方参考图"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={syncMentionAnchor}
        onKeyUp={syncMentionAnchor}
        onSelect={syncMentionAnchor}
      />

      {typeof document !== "undefined" && pickerPanel
        ? createPortal(pickerPanel, document.body)
        : null}
    </div>
  );
}
