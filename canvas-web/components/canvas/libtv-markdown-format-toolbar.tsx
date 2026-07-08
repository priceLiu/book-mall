"use client";

import type { RefObject } from "react";
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
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
} from "@/components/canvas/pro2/pro2-image-node-toolbar";
import { cn } from "@/lib/utils";

function ToolbarBtn({
  title,
  onClick,
  children,
  disabled,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS}
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
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
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  onExpand?: () => void;
  onCopied?: () => void;
}) {
  const run = (action: MarkdownFormatAction) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const result = applyMarkdownFormatAction(action, value, start, end);
    onChange(result.next);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
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
    <div className={cn(PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS, "nodrag")}>
      <ToolbarBtn title="清除格式" onClick={() => run("clear")}>
        <RemoveFormatting className="size-5" />
      </ToolbarBtn>
      <Divider />
      <ToolbarBtn title="标题 1" onClick={() => run("h1")}>
        <span className="text-[15px] font-semibold leading-none">H1</span>
      </ToolbarBtn>
      <ToolbarBtn title="标题 2" onClick={() => run("h2")}>
        <span className="text-[15px] font-semibold leading-none">H2</span>
      </ToolbarBtn>
      <ToolbarBtn title="标题 3" onClick={() => run("h3")}>
        <span className="text-[15px] font-semibold leading-none">H3</span>
      </ToolbarBtn>
      <ToolbarBtn title="正文段落" onClick={() => run("paragraph")}>
        <Pilcrow className="size-5" />
      </ToolbarBtn>
      <Divider />
      <ToolbarBtn title="粗体" onClick={() => run("bold")}>
        <Bold className="size-5" />
      </ToolbarBtn>
      <ToolbarBtn title="斜体" onClick={() => run("italic")}>
        <Italic className="size-5" />
      </ToolbarBtn>
      <Divider />
      <ToolbarBtn title="无序列表" onClick={() => run("ul")}>
        <List className="size-5" />
      </ToolbarBtn>
      <ToolbarBtn title="有序列表" onClick={() => run("ol")}>
        <ListOrdered className="size-5" />
      </ToolbarBtn>
      <ToolbarBtn title="分隔线" onClick={() => run("hr")}>
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
  );
}
