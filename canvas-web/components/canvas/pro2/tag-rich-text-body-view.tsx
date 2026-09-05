"use client";

import { MarkdownView } from "@/components/canvas/markdown-view";
import {
  ensureTagRichTextHtmlDocument,
  isTagRichTextHtml,
} from "@/lib/canvas/tag-rich-text-migrate";
import { cn } from "@/lib/utils";

import {
  TAG_RICH_TEXT_PROSE_CLASS,
  TagRichTextStaticView,
} from "./tag-rich-text-editor";

/** 标签节点正文 · 旧 Markdown 走 MarkdownView，TipTap HTML 走静态 HTML */
export function TagRichTextBodyView({
  storedBody,
  htmlDraft,
  className,
}: {
  /** 存盘原文（可能是 Markdown 或 HTML） */
  storedBody: string;
  /** 编辑中的 HTML draft（TipTap） */
  htmlDraft: string;
  className?: string;
}) {
  const proseClass = cn(TAG_RICH_TEXT_PROSE_CLASS, className);

  if (isTagRichTextHtml(storedBody)) {
    return (
      <TagRichTextStaticView
        html={ensureTagRichTextHtmlDocument(htmlDraft)}
        className={className}
      />
    );
  }

  return (
    <MarkdownView
      content={storedBody}
      variant="darkPreview"
      inheritFontSize
      inlineStyles
      className={proseClass}
    />
  );
}
