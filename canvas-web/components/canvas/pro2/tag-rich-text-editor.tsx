"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";

import { createTagRichTextExtensions } from "@/lib/canvas/tag-rich-text-extensions";
import { cn } from "@/lib/utils";

export const TAG_RICH_TEXT_PROSE_CLASS = cn(
  "tag-rich-text-prose min-h-0 w-full text-[11px] leading-relaxed text-white/88",
  "[&_.ProseMirror]:min-h-[3rem] [&_.ProseMirror]:outline-none",
  "[&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:mt-3 [&_.ProseMirror_h1]:border-b [&_.ProseMirror_h1]:border-white/15 [&_.ProseMirror_h1]:pb-1 [&_.ProseMirror_h1]:text-[1.45em] [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:text-white",
  "[&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:border-b [&_.ProseMirror_h2]:border-white/15 [&_.ProseMirror_h2]:pb-1 [&_.ProseMirror_h2]:text-[1.28em] [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-white",
  "[&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:text-[1.12em] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-white/95",
  "[&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p]:leading-relaxed [&_.ProseMirror_p]:text-white/90",
  "[&_.ProseMirror_ul]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5",
  "[&_.ProseMirror_ol]:mb-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5",
  "[&_.ProseMirror_li]:leading-relaxed [&_.ProseMirror_li]:text-white/90",
  "[&_.ProseMirror_hr]:my-3 [&_.ProseMirror_hr]:border-white/15",
  "[&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_strong]:text-inherit",
  "[&_.ProseMirror_em]:italic",
  "[&_.ProseMirror_u]:underline [&_.ProseMirror_u]:decoration-white/40",
  "[&_.tag-rich-text-empty:first-child]:before:pointer-events-none [&_.tag-rich-text-empty:first-child]:before:text-white/30 [&_.tag-rich-text-empty:first-child]:before:content-[attr(data-placeholder)]",
  // 只读静态 HTML（与 ProseMirror 输出结构一致）
  "[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:border-b [&_h1]:border-white/15 [&_h1]:pb-1 [&_h1]:text-[1.45em] [&_h1]:font-bold [&_h1]:text-white",
  "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:border-b [&_h2]:border-white/15 [&_h2]:pb-1 [&_h2]:text-[1.28em] [&_h2]:font-semibold [&_h2]:text-white",
  "[&_h3]:mb-2 [&_h3]:mt-2 [&_h3]:text-[1.12em] [&_h3]:font-semibold [&_h3]:text-white/95",
  "[&_p]:mb-2 [&_p]:leading-relaxed [&_p]:text-white/90",
  "[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:leading-relaxed [&_li]:text-white/90",
  "[&_hr]:my-3 [&_hr]:border-white/15",
  "[&_strong]:font-semibold [&_strong]:text-inherit",
  "[&_em]:italic [&_em]:text-white/95",
  "[&_u]:underline [&_u]:decoration-white/40",
);

/** 只读展示 · 不挂载 TipTap（SSR 安全、零编辑器开销） */
export function TagRichTextStaticView({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn(TAG_RICH_TEXT_PROSE_CLASS, className)}
      // TipTap 输出为受控 HTML，仅来自本节点编辑
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function TagRichTextEditor({
  content,
  editable,
  className,
  placeholder,
  onUpdate,
  onEditor,
  onBlur,
}: {
  content: string;
  editable: boolean;
  className?: string;
  placeholder?: string;
  onUpdate: (html: string) => void;
  onEditor?: (editor: Editor | null) => void;
  onBlur?: (html: string) => void;
}) {
  const focusedRef = useRef(false);
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createTagRichTextExtensions(placeholder),
    content,
    editable,
    editorProps: {
      attributes: {
        class: "nodrag nowheel outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onUpdate(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const onFocus = () => {
      focusedRef.current = true;
    };
    const onBlurHandler = () => {
      focusedRef.current = false;
      onBlurRef.current?.(editor.getHTML());
    };
    editor.on("focus", onFocus);
    editor.on("blur", onBlurHandler);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlurHandler);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      onEditor?.(null);
      return;
    }
    onEditor?.(editor);
    return () => onEditor?.(null);
  }, [editor, onEditor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor || focusedRef.current) return;
    const current = editor.getHTML();
    if (content !== current) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  return (
    <div className={cn(TAG_RICH_TEXT_PROSE_CLASS, className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
