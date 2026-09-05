"use client";

import type { MutableRefObject, RefObject } from "react";
import {
  Bold,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minus,
  Pilcrow,
  RemoveFormatting,
} from "lucide-react";

import {
  applyMarkdownFormatAction,
  type MarkdownFormatAction,
} from "@/lib/canvas/libtv-markdown-format";
import {
  applyTagInlineStyleAction,
  TAG_INLINE_COLOR_PRESETS,
  TAG_INLINE_FONT_SIZE_OPTIONS,
  type TagInlineStyle,
} from "@/lib/canvas/libtv-markdown-inline-style";
import {
  resolveTextAreaSelection,
  type TextAreaSelectionRange,
} from "@/lib/canvas/libtv-textarea-selection";
import {
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
} from "@/components/canvas/pro2/pro2-image-node-toolbar";
import { cn } from "@/lib/utils";

function ToolbarBtn({
  title,
  onClick,
  onMouseDown,
  children,
  disabled,
  active,
}: {
  title: string;
  onClick: () => void;
  onMouseDown?: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS,
        active && "bg-white/12 ring-1 ring-white/25",
      )}
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onMouseDown?.();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS}
      aria-hidden
    />
  );
}

export function LibtvMarkdownFormatToolbar({
  textareaRef,
  value,
  onChange,
  onExpand,
  onCopied,
  enableInlineStyle = true,
  savedSelectionRef,
  onCaptureSelection,
  onApplyPlainInlineStyle,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  onExpand?: () => void;
  onCopied?: () => void;
  enableInlineStyle?: boolean;
  savedSelectionRef?: MutableRefObject<TextAreaSelectionRange | null>;
  onCaptureSelection?: () => void;
  /** 标签节点纯文本层：字号/颜色走 span 映射，不写入 {{}} 到 textarea */
  onApplyPlainInlineStyle?: (
    start: number,
    end: number,
    patch: TagInlineStyle,
  ) => { selectionStart: number; selectionEnd: number } | void;
}) {
  const capture = () => {
    onCaptureSelection?.();
  };

  const applySelection = (
    fn: (
      text: string,
      start: number,
      end: number,
    ) => { next: string; selectionStart: number; selectionEnd: number },
  ) => {
    const el = textareaRef.current;
    const { start, end } = resolveTextAreaSelection(
      el,
      savedSelectionRef?.current ?? null,
      value.length,
    );
    const result = fn(value, start, end);
    onChange(result.next);
    if (savedSelectionRef) {
      savedSelectionRef.current = {
        start: result.selectionStart,
        end: result.selectionEnd,
      };
    }
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const run = (action: MarkdownFormatAction) => {
    applySelection((text, start, end) =>
      applyMarkdownFormatAction(action, text, start, end),
    );
  };

  const runInlineStyle = (patch: { fontSizePx?: number; color?: string }) => {
    if (onApplyPlainInlineStyle) {
      const el = textareaRef.current;
      const { start, end } = resolveTextAreaSelection(
        el,
        savedSelectionRef?.current ?? null,
        value.length,
      );
      const sel = onApplyPlainInlineStyle(start, end, patch);
      if (sel) {
        if (savedSelectionRef) {
          savedSelectionRef.current = {
            start: sel.selectionStart,
            end: sel.selectionEnd,
          };
        }
        requestAnimationFrame(() => {
          const ta = textareaRef.current;
          if (!ta) return;
          ta.focus({ preventScroll: true });
          ta.setSelectionRange(sel.selectionStart, sel.selectionEnd);
        });
      }
      return;
    }
    applySelection((text, start, end) =>
      applyTagInlineStyleAction(text, start, end, patch),
    );
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      onCopied?.();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS, "nodrag")}>
        <ToolbarBtn title="清除格式" onMouseDown={capture} onClick={() => run("clear")}>
          <RemoveFormatting className="size-5" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn title="标题 1" onMouseDown={capture} onClick={() => run("h1")}>
          <span className="text-[15px] font-semibold leading-none">H1</span>
        </ToolbarBtn>
        <ToolbarBtn title="标题 2" onMouseDown={capture} onClick={() => run("h2")}>
          <span className="text-[15px] font-semibold leading-none">H2</span>
        </ToolbarBtn>
        <ToolbarBtn title="标题 3" onMouseDown={capture} onClick={() => run("h3")}>
          <span className="text-[15px] font-semibold leading-none">H3</span>
        </ToolbarBtn>
        <ToolbarBtn title="正文段落" onMouseDown={capture} onClick={() => run("paragraph")}>
          <Pilcrow className="size-5" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn title="粗体" onMouseDown={capture} onClick={() => run("bold")}>
          <Bold className="size-5" />
        </ToolbarBtn>
        <ToolbarBtn title="斜体" onMouseDown={capture} onClick={() => run("italic")}>
          <Italic className="size-5" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn title="无序列表" onMouseDown={capture} onClick={() => run("ul")}>
          <List className="size-5" />
        </ToolbarBtn>
        <ToolbarBtn title="有序列表" onMouseDown={capture} onClick={() => run("ol")}>
          <ListOrdered className="size-5" />
        </ToolbarBtn>
        <ToolbarBtn title="分隔线" onMouseDown={capture} onClick={() => run("hr")}>
          <Minus className="size-5" />
        </ToolbarBtn>
        <Divider />
        <ToolbarBtn title="复制内容" onClick={() => void onCopy()} disabled={!value.trim()}>
          <Copy className="size-5" />
        </ToolbarBtn>
        {onExpand ? (
          <ToolbarBtn title="放大编辑" onClick={onExpand}>
            <Maximize2 className="size-5" />
          </ToolbarBtn>
        ) : null}
      </div>

      {enableInlineStyle ? (
        <div
          className={cn(
            PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
            "nodrag max-w-[min(92vw,680px)] flex-nowrap items-center gap-1 overflow-x-auto px-2 py-1.5",
          )}
        >
          <span className="shrink-0 px-1 text-[11px] text-white/45">先框选</span>
          {TAG_INLINE_FONT_SIZE_OPTIONS.map((px) => (
            <ToolbarBtn
              key={px}
              title={`字号 ${px}px`}
              onMouseDown={capture}
              onClick={() => runInlineStyle({ fontSizePx: px })}
            >
              <span className="text-[12px] font-medium leading-none tabular-nums">{px}</span>
            </ToolbarBtn>
          ))}
          <Divider />
          <div className="flex shrink-0 flex-nowrap items-center gap-1">
            {TAG_INLINE_COLOR_PRESETS.map((preset) => (
              <ToolbarBtn
                key={preset.value}
                title={`颜色 ${preset.label}`}
                onMouseDown={capture}
                onClick={() => runInlineStyle({ color: preset.value })}
              >
                <span
                  className="block size-4 shrink-0 rounded-full border border-white/25"
                  style={{ backgroundColor: preset.value }}
                />
              </ToolbarBtn>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
