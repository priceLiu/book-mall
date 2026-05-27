"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { prepareMarkdownForPreview } from "@/lib/canvas/parse-md-tables";
import {
  storyMdTableTextClass,
  storyMdTableWrapperClass,
  storyMdTdClass,
  storyMdThClass,
  type StoryMdTableVariant,
} from "@/lib/canvas/story-md-table-chrome";

function MarkdownProse({
  content,
  className,
  variant,
  tableVariant,
  isDoc,
  isNodePreview,
  isDarkPreview,
  isLightDoc,
}: {
  content: string;
  className: string;
  variant: "inline" | "document" | "nodePreview" | "darkPreview";
  tableVariant: StoryMdTableVariant;
  isDoc: boolean;
  isNodePreview: boolean;
  isDarkPreview: boolean;
  isLightDoc: boolean;
}) {
  const tablePad = isLightDoc ? "px-4 py-2.5" : "px-2 py-1";

  return (
    <div className={`w-full min-w-0 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className={
                isDoc
                  ? "mb-6 border-b border-neutral-200 pb-3 text-[28px] font-bold leading-tight text-neutral-900"
                  : undefined
              }
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={
                isDoc
                  ? "mb-4 mt-8 text-[22px] font-semibold leading-snug text-neutral-800"
                  : isNodePreview
                    ? "mb-2 mt-5 border-b border-neutral-200 pb-1 text-[15px] font-semibold leading-snug text-neutral-800 first:mt-0"
                    : isDarkPreview
                      ? "mb-2 mt-5 border-b border-white/15 pb-1 text-[14px] font-semibold leading-snug text-white first:mt-0"
                      : undefined
              }
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={
                isDoc
                  ? "mb-3 mt-6 text-[18px] font-semibold leading-snug text-neutral-800"
                  : isNodePreview
                    ? "mb-2 mt-4 text-[14px] font-semibold leading-snug text-neutral-800"
                    : isDarkPreview
                      ? "mb-2 mt-4 text-[13px] font-semibold leading-snug text-white/95"
                      : undefined
              }
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className={
                isDoc
                  ? "mb-4 text-[17px] leading-[1.85] text-neutral-800"
                  : isNodePreview
                    ? "mb-3 text-[13px] leading-[1.75] text-neutral-700"
                    : isDarkPreview
                      ? "mb-3 text-[13px] leading-[1.75] text-white/90"
                      : undefined
              }
            >
              {children}
            </p>
          ),
          li: ({ children }) => (
            <li
              className={
                isDoc
                  ? "text-[17px] leading-[1.75]"
                  : isNodePreview
                    ? "text-[13px] leading-[1.7]"
                    : isDarkPreview
                      ? "text-[13px] leading-[1.7] text-white/90"
                      : undefined
              }
            >
              {children}
            </li>
          ),
          table: ({ children }) => (
            <div
              className={`max-w-full overflow-x-auto ${
                isDoc ? "my-6" : isNodePreview ? "my-3" : "my-4"
              }`}
            >
              <table
                className={`${storyMdTableWrapperClass(tableVariant)} ${storyMdTableTextClass(tableVariant)} ${
                  isLightDoc ? "" : "border border-white/10"
                }`}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className={
                isLightDoc
                  ? storyMdThClass(tableVariant)
                  : `border border-white/15 bg-white/5 font-semibold ${tablePad}`
              }
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={`align-top ${
                isLightDoc
                  ? storyMdTdClass(tableVariant)
                  : `border border-white/10 ${tablePad}`
              }`}
            >
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownView({
  content,
  className = "",
  variant = "inline",
  /** 已由调用方 prepare 过时设为 true，避免重复处理 */
  prepared = false,
}: {
  content: string;
  className?: string;
  /** inline=暗色节点；nodePreview=节点内白纸预览；document=全屏 Word 式阅读；darkPreview=黑底白字节点预览 */
  variant?: "inline" | "document" | "nodePreview" | "darkPreview";
  prepared?: boolean;
}) {
  if (!content.trim()) {
    return (
      <p className="text-[11px] text-[var(--canvas-muted)]">（暂无 Markdown 内容）</p>
    );
  }

  const isDoc = variant === "document";
  const isNodePreview = variant === "nodePreview";
  const isDarkPreview = variant === "darkPreview";
  const isLightDoc = isDoc || isNodePreview;
  const tableVariant: StoryMdTableVariant = isNodePreview ? "nodePreview" : "document";

  const proseClass = isDoc
    ? `max-w-none text-[17px] leading-[1.75] text-neutral-900 ${className}`
    : isNodePreview
      ? `max-w-none text-[13px] leading-[1.7] text-neutral-800 ${className}`
      : isDarkPreview
        ? `max-w-none text-[13px] leading-[1.75] text-white ${className}`
        : `${RF_NODE_SCROLL} prose prose-invert prose-sm max-w-none text-[12px] ${className}`;

  const useRichPreview =
    variant === "document" || variant === "nodePreview" || variant === "darkPreview";
  const md =
    useRichPreview && !prepared ? prepareMarkdownForPreview(content) : content;

  return (
    <MarkdownProse
      content={md}
      className={proseClass}
      variant={variant}
      tableVariant={tableVariant}
      isDoc={isDoc}
      isNodePreview={isNodePreview}
      isDarkPreview={isDarkPreview}
      isLightDoc={isLightDoc}
    />
  );
}
