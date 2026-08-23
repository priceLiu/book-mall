import StarterKit from "@tiptap/starter-kit";
import {
  Color,
  FontSize,
  TextStyle,
} from "@tiptap/extension-text-style";
import type { Editor } from "@tiptap/react";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

export const TAG_RICH_TEXT_FONT_SIZES = ["10px", "11px", "13px", "14px", "16px", "18px", "20px"] as const;

export const TAG_RICH_TEXT_COLOR_PRESETS = [
  { label: "白", value: "#ffffff" },
  { label: "黄", value: "#fbbf24" },
  { label: "橙", value: "#fb923c" },
  { label: "红", value: "#f87171" },
  { label: "绿", value: "#4ade80" },
  { label: "蓝", value: "#60a5fa" },
  { label: "紫", value: "#c084fc" },
  { label: "粉", value: "#f472b6" },
] as const;

export function createTagRichTextExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Underline,
    TextStyle,
    Color,
    FontSize,
    Placeholder.configure({
      placeholder: placeholder ?? "输入标注内容…",
      emptyEditorClass: "tag-rich-text-empty",
    }),
  ];
}

export function applyTagRichTextFontSize(editor: Editor, fontSize: string): void {
  editor
    .chain()
    .focus()
    .extendMarkRange("textStyle")
    .setFontSize(fontSize)
    .run();
}

export function applyTagRichTextColor(editor: Editor, color: string): void {
  editor.chain().focus().extendMarkRange("textStyle").setColor(color).run();
}
