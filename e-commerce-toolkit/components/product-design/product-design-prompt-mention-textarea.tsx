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

import { EcomPromptMentionRefBar } from "@/components/media/ecom-prompt-mention-ref-bar";
import {
  buildPromptEditableFragment,
  createEcomImageRefMentionNode,
  ECOM_IMAGE_REF_BADGE_ATTR,
  ECOM_IMAGE_REF_TOKEN_ATTR,
  filterEcomPromptImageRefsUsedInPrompt,
  resolveCaretTextAnchor,
  scanImageRefTriggerBeforeCursor,
  serializePromptEditable,
  type EcomMentionBadgeVariant,
  type EcomPromptImageRef,
} from "@/lib/ecom-prompt-mention";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import { mentionRefRoleLabel } from "@/lib/product-design-mention-refs";
import { cn } from "@/lib/utils";

type TriggerAnchor = { node: Text; at: number };

type PickerPosition = { left: number; top: number; width: number };

const PICKER_GAP = 8;
const PICKER_Z = 5000;
const PICKER_EST_HEIGHT = 280;
const PICKER_MAX_WIDTH = 420;
const HOVER_PREVIEW_Z = 5100;
const HOVER_PREVIEW_MAX = 240;

function resolveRefFromBadgeEl(
  badge: Element,
  refs: EcomPromptImageRef[],
): EcomPromptImageRef | undefined {
  const token = badge.getAttribute(ECOM_IMAGE_REF_TOKEN_ATTR);
  if (token) {
    const normalized = token.startsWith("@") ? token : `@${token}`;
    const byToken = refs.find((r) => r.token === normalized);
    if (byToken) return byToken;
  }
  const idxRaw = badge.getAttribute(ECOM_IMAGE_REF_BADGE_ATTR);
  const idx = idxRaw ? Number.parseInt(idxRaw, 10) : NaN;
  if (Number.isFinite(idx) && idx > 0) {
    return refs.find((r) => r.index === idx);
  }
  return undefined;
}

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
  /** 表格/面板顶栏已有参考图条时设为 false，避免重复 */
  showTopRefBar?: boolean;
  /** top-bar-bound：顶栏绑定带图，正文只显示代号；thumbnail/token-only 为旧模式 */
  mentionBadgeVariant?: EcomMentionBadgeVariant;
  /** 为 true 时顶栏参考资产条仅展示 Prompt 内仍存在的 @ 引用（上传区不受影响） */
  syncRefBarWithPrompt?: boolean;
  /** 顶栏参考资产说明文案 */
  refBarHint?: string;
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
  showTopRefBar = true,
  mentionBadgeVariant = "top-bar-bound",
  syncRefBarWithPrompt = false,
  refBarHint,
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
  const badgeVariantRef = useRef(mentionBadgeVariant);
  badgeVariantRef.current = mentionBadgeVariant;
  const suppressInlineQuickInsert =
    hideQuickInsert || mentionBadgeVariant === "top-bar-bound";

  const refBarImages = useMemo(() => {
    if (!syncRefBarWithPrompt) return referenceImages;
    return filterEcomPromptImageRefsUsedInPrompt(value, referenceImages);
  }, [syncRefBarWithPrompt, value, referenceImages]);

  const showEmbeddedRefBar =
    showTopRefBar &&
    refBarImages.length > 0 &&
    (mentionBadgeVariant === "top-bar-bound" || syncRefBarWithPrompt);

  const [isEmpty, setIsEmpty] = useState(!value);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverFilter, setPopoverFilter] = useState("");
  const [popoverIndex, setPopoverIndex] = useState(0);
  const [anchorTick, setAnchorTick] = useState(0);
  const [pickerPos, setPickerPos] = useState<PickerPosition | null>(null);
  const [pickerHeight, setPickerHeight] = useState(PICKER_EST_HEIGHT);
  const [hoverPreview, setHoverPreview] = useState<{
    url: string;
    label: string;
    left: number;
    top: number;
  } | null>(null);
  const hoverPreviewRef = useRef<HTMLDivElement>(null);

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
      root.replaceChildren(
        buildPromptEditableFragment(value, refsRef.current, undefined, {
          badgeVariant: badgeVariantRef.current,
        }),
      );
      return;
    }
    root.replaceChildren(
      buildPromptEditableFragment(value, refsRef.current, undefined, {
        badgeVariant: badgeVariantRef.current,
      }),
    );
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
      const node = createEcomImageRefMentionNode(item, imageIndex, {
        variant: badgeVariantRef.current,
        boundInTopBar: Boolean(item),
      });
      const space = document.createTextNode("\u00a0");
      const frag = document.createDocumentFragment();
      frag.appendChild(node);
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
    const root = editorRef.current;
    if (!root) return;

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const badge = target.closest(`[${ECOM_IMAGE_REF_BADGE_ATTR}], [${ECOM_IMAGE_REF_TOKEN_ATTR}]`);
      if (!badge || !root.contains(badge)) return;
      const item = resolveRefFromBadgeEl(badge, refsRef.current);
      if (!item?.url?.trim()) return;
      const rect = badge.getBoundingClientRect();
      const width = Math.min(HOVER_PREVIEW_MAX, window.innerWidth - 24);
      let left = rect.left + rect.width / 2 - width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      const spaceBelow = window.innerHeight - rect.bottom - PICKER_GAP;
      const spaceAbove = rect.top - PICKER_GAP;
      const openAbove = spaceBelow < width * 0.75 && spaceAbove > spaceBelow;
      const top = openAbove ? rect.top - PICKER_GAP - width * 0.75 : rect.bottom + PICKER_GAP;
      setHoverPreview({
        url: item.url.trim(),
        label: item.label || item.token,
        left,
        top: Math.max(12, Math.min(top, window.innerHeight - width * 0.75 - 12)),
      });
    };

    const onMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget;
      if (related instanceof Node) {
        if (root.contains(related)) return;
        if (hoverPreviewRef.current?.contains(related)) return;
      }
      setHoverPreview(null);
    };

    root.addEventListener("mouseover", onMouseOver);
    root.addEventListener("mouseout", onMouseOut);
    return () => {
      root.removeEventListener("mouseover", onMouseOver);
      root.removeEventListener("mouseout", onMouseOut);
    };
  }, [referenceImages]);

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
      {showEmbeddedRefBar ? (
        <div className="mb-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2.5 py-2">
          <EcomPromptMentionRefBar refs={refBarImages} hint={refBarHint} />
        </div>
      ) : null}
      {!suppressInlineQuickInsert && referenceImages.length > 0 ? (
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
                src={buildEcomOssThumbUrl(item.url)}
                alt=""
                className="h-4 w-4 rounded object-cover"
                referrerPolicy="no-referrer"
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
          {mentionBadgeVariant === "top-bar-bound"
            ? "输入 @ 插入代号（如 人物A）；参考图见上方顶栏"
            : "输入 @ 引用参考图，或点上方缩略图快速插入"}
        </p>
      ) : null}
      {typeof document !== "undefined" && pickerPanel
        ? createPortal(pickerPanel, document.body)
        : null}
      {typeof document !== "undefined" && hoverPreview
        ? createPortal(
            <div
              ref={hoverPreviewRef}
              className="pointer-events-none overflow-hidden rounded-xl border border-[#e8e8ed] bg-white shadow-xl"
              style={{
                position: "fixed",
                left: hoverPreview.left,
                top: hoverPreview.top,
                width: HOVER_PREVIEW_MAX,
                zIndex: HOVER_PREVIEW_Z,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hoverPreview.url}
                alt={hoverPreview.label}
                className="aspect-[3/4] w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <p className="truncate px-2 py-1.5 text-[11px] text-[#6e6e73]">{hoverPreview.label}</p>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
