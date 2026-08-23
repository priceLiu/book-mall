"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Copy,
  Italic,
  List,
  ListOrdered,
  Maximize2,
  Minus,
  Palette,
  Pilcrow,
  RemoveFormatting,
  Trash2,
  Underline as UnderlineIcon,
} from "lucide-react";

import {
  TAG_RICH_TEXT_COLOR_PRESETS,
  TAG_RICH_TEXT_FONT_SIZES,
  applyTagRichTextColor,
  applyTagRichTextFontSize,
} from "@/lib/canvas/tag-rich-text-extensions";
import {
  PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_ICON_BTN_CLASS,
  PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
} from "@/components/canvas/pro2/pro2-image-node-toolbar";
import { cn } from "@/lib/utils";

function Btn({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
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
  return <div className={PRO2_IMAGE_NODE_TOOLBAR_DIVIDER_CLASS} aria-hidden />;
}

export type TagRichTextToolbarProps = {
  editor: Editor | null;
  onExpand?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
};

export function TagRichTextToolbar({
  editor,
  onExpand,
  onDelete,
  onDuplicate,
}: TagRichTextToolbarProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  if (!editor) return null;

  const run = (fn: () => void) => {
    fn();
    editor.commands.focus();
  };

  const hasNodeActions = Boolean(onExpand || onDelete || onDuplicate);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={cn(PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS, "nodrag gap-0.5")}>
        <Btn
          title="清除格式"
          onClick={() =>
            run(() => {
              editor.chain().focus().unsetAllMarks().clearNodes().run();
            })
          }
        >
          <RemoveFormatting className="size-5" />
        </Btn>
        <Divider />
        <Btn
          title="标题 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        >
          <span className="text-[15px] font-semibold leading-none">H1</span>
        </Btn>
        <Btn
          title="标题 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        >
          <span className="text-[15px] font-semibold leading-none">H2</span>
        </Btn>
        <Btn
          title="标题 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        >
          <span className="text-[15px] font-semibold leading-none">H3</span>
        </Btn>
        <Btn
          title="正文段落"
          onClick={() => run(() => editor.chain().focus().setParagraph().run())}
        >
          <Pilcrow className="size-5" />
        </Btn>
        <Divider />
        <Btn
          title="粗体"
          active={editor.isActive("bold")}
          onClick={() => run(() => editor.chain().focus().toggleBold().run())}
        >
          <Bold className="size-5" />
        </Btn>
        <Btn
          title="斜体"
          active={editor.isActive("italic")}
          onClick={() => run(() => editor.chain().focus().toggleItalic().run())}
        >
          <Italic className="size-5" />
        </Btn>
        <Btn
          title="下划线"
          active={editor.isActive("underline")}
          onClick={() => run(() => editor.chain().focus().toggleUnderline().run())}
        >
          <UnderlineIcon className="size-5" />
        </Btn>
        <Divider />
        <Btn
          title="无序列表"
          active={editor.isActive("bulletList")}
          onClick={() => run(() => editor.chain().focus().toggleBulletList().run())}
        >
          <List className="size-5" />
        </Btn>
        <Btn
          title="有序列表"
          active={editor.isActive("orderedList")}
          onClick={() => run(() => editor.chain().focus().toggleOrderedList().run())}
        >
          <ListOrdered className="size-5" />
        </Btn>
        <Btn
          title="分隔线"
          onClick={() => run(() => editor.chain().focus().setHorizontalRule().run())}
        >
          <Minus className="size-5" />
        </Btn>
        <Divider />
        <Btn
          title={paletteOpen ? "收起颜色与字号" : "颜色与字号"}
          active={paletteOpen}
          onClick={() => setPaletteOpen((open) => !open)}
        >
          <Palette className="size-5" />
        </Btn>

        {hasNodeActions ? (
          <>
            <Divider />
            {onExpand ? (
              <Btn title="放大编辑" onClick={() => onExpand()}>
                <Maximize2 className="size-5" />
              </Btn>
            ) : null}
            {onDelete ? (
              <Btn title="删除标签节点" onClick={() => onDelete()}>
                <Trash2 className="size-5 text-red-300/80" />
              </Btn>
            ) : null}
            {onDuplicate ? (
              <Btn title="复制节点" onClick={() => onDuplicate()}>
                <Copy className="size-5" />
              </Btn>
            ) : null}
          </>
        ) : null}
      </div>

      {paletteOpen ? (
        <div
          className={cn(
            PRO2_IMAGE_NODE_TOOLBAR_SHELL_CLASS,
            "nodrag flex-wrap items-center justify-center gap-1 px-2 py-1.5",
          )}
        >
          {TAG_RICH_TEXT_FONT_SIZES.map((px) => (
            <Btn
              key={px}
              title={`字号 ${px}`}
              onClick={() => run(() => applyTagRichTextFontSize(editor, px))}
            >
              <span className="text-[12px] font-medium leading-none tabular-nums">
                {px.replace("px", "")}
              </span>
            </Btn>
          ))}
          <Divider />
          {TAG_RICH_TEXT_COLOR_PRESETS.map((preset) => (
            <Btn
              key={preset.value}
              title={`颜色 ${preset.label}`}
              onClick={() => run(() => applyTagRichTextColor(editor, preset.value))}
            >
              <span
                className="block size-4 shrink-0 rounded-full border border-white/25"
                style={{ backgroundColor: preset.value }}
              />
            </Btn>
          ))}
        </div>
      ) : null}
    </div>
  );
}
