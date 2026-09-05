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
import { splitTagMarkdownInlineStyles } from "@/lib/canvas/libtv-markdown-inline-style";
import { cn } from "@/lib/utils";

function MarkdownProse({
  content,
  className,
  variant,
  tableVariant,
  isDoc,
  isNodePreview,
  isDarkPreview,
  isLightDoc,
  inheritFontSize = false,
  inlineFlow = false,
}: {
  content: string;
  className: string;
  variant: "inline" | "document" | "nodePreview" | "darkPreview";
  tableVariant: StoryMdTableVariant;
  isDoc: boolean;
  isNodePreview: boolean;
  isDarkPreview: boolean;
  isLightDoc: boolean;
  inheritFontSize?: boolean;
  /** 标签节点：段内 markdown 与彩色 span 同行混排 */
  inlineFlow?: boolean;
}) {
  const tablePad = isLightDoc ? "px-4 py-2.5" : "px-2 py-1";
  const darkInherit = isDarkPreview && inheritFontSize;
  const inlinePara = inlineFlow
    ? "inline [overflow-wrap:anywhere]"
    : undefined;

  return (
    <div className={`w-full min-w-0 max-w-full overflow-x-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className={
                inlineFlow
                  ? "mb-2 mt-3 block border-b border-white/15 pb-1 text-[1.45em] font-bold leading-snug text-white first:mt-0"
                  : isDoc
                  ? "mb-6 border-b border-neutral-200 pb-3 text-[28px] font-bold leading-tight text-neutral-900"
                  : isDarkPreview
                    ? darkInherit
                      ? "mb-2 mt-5 border-b border-white/15 pb-1 text-[1.45em] font-bold leading-snug text-white first:mt-0"
                      : "mb-2 mt-5 border-b border-white/15 pb-1 text-[16px] font-bold leading-snug text-white first:mt-0"
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
                      ? darkInherit
                        ? "mb-2 mt-5 border-b border-white/15 pb-1 text-[1.28em] font-semibold leading-snug text-white first:mt-0"
                        : "mb-2 mt-5 border-b border-white/15 pb-1 text-[14px] font-semibold leading-snug text-white first:mt-0"
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
                      ? darkInherit
                        ? "mb-2 mt-4 text-[1.12em] font-semibold leading-snug text-white/95"
                        : "mb-2 mt-4 text-[13px] font-semibold leading-snug text-white/95"
                      : undefined
              }
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className={
                inlinePara
                  ? inlinePara + (isDarkPreview ? " text-white/90" : "")
                  : isDoc
                  ? "mb-4 break-words text-[17px] leading-[1.85] text-neutral-800 [overflow-wrap:anywhere]"
                  : isNodePreview
                    ? "mb-3 break-words text-[13px] leading-[1.75] text-neutral-700 [overflow-wrap:anywhere]"
                    : isDarkPreview
                      ? darkInherit
                        ? "mb-3 break-words leading-[1.75] text-white/90 [overflow-wrap:anywhere]"
                        : "mb-3 break-words text-[13px] leading-[1.75] text-white/90 [overflow-wrap:anywhere]"
                      : undefined
              }
            >
              {children}
            </p>
          ),
          li: ({ children }) => (
            <li
              className={
                inlineFlow
                  ? "leading-[1.7] text-white/90"
                  : isDoc
                  ? "text-[17px] leading-[1.75]"
                  : isNodePreview
                    ? "text-[13px] leading-[1.7]"
                    : isDarkPreview
                      ? darkInherit
                        ? "leading-[1.7] text-white/90"
                        : "text-[13px] leading-[1.7] text-white/90"
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
  /** 为 true 时不写死 text-[13px]，继承父级字号（标签节点等） */
  inheritFontSize = false,
  /** 标签节点：渲染 `{{14px|#fff}}局部样式{{/}}` */
  inlineStyles = false,
  /** 已由调用方 prepare 过时设为 true，避免重复处理 */
  prepared = false,
}: {
  content: string;
  className?: string;
  /** inline=暗色节点；nodePreview=节点内白纸预览；document=全屏 Word 式阅读；darkPreview=黑底白字节点预览 */
  variant?: "inline" | "document" | "nodePreview" | "darkPreview";
  inheritFontSize?: boolean;
  inlineStyles?: boolean;
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

  const wrapClass = "break-words [overflow-wrap:anywhere]";
  const proseClass = isDoc
    ? `max-w-none text-[17px] leading-[1.75] text-neutral-900 ${wrapClass} ${className}`
    : isNodePreview
      ? `max-w-none text-[13px] leading-[1.7] text-neutral-800 ${wrapClass} ${className}`
      : isDarkPreview
        ? `max-w-none leading-[1.75] text-white ${wrapClass} ${
            inheritFontSize
              ? "text-inherit [&_p]:text-[length:inherit] [&_li]:text-[length:inherit]"
              : "text-[13px]"
          } ${className}`
        : `${RF_NODE_SCROLL} prose prose-invert prose-sm max-w-none text-[12px] ${wrapClass} ${className}`;

  const useRichPreview =
    variant === "document" || variant === "nodePreview" || variant === "darkPreview";
  const md =
    useRichPreview && !prepared ? prepareMarkdownForPreview(content) : content;

  if (inlineStyles) {
    const segments = splitTagMarkdownInlineStyles(md);
    return (
      <div className={cn(proseClass, "inline-flow-tag-preview")}>
        {segments.map((seg, i) => {
          if (seg.kind === "styled") {
            const style: React.CSSProperties = {};
            if (seg.style.fontSizePx) style.fontSize = `${seg.style.fontSizePx}px`;
            if (seg.style.color) style.color = seg.style.color;
            return (
              <span
                key={`styled-${i}`}
                style={style}
                className="inline [overflow-wrap:anywhere]"
              >
                {seg.text}
              </span>
            );
          }
          if (!seg.text) return null;
          return (
            <MarkdownProse
              key={`md-${i}`}
              content={seg.text}
              className="inline"
              variant={variant}
              tableVariant={tableVariant}
              isDoc={isDoc}
              isNodePreview={isNodePreview}
              isDarkPreview={isDarkPreview}
              isLightDoc={isLightDoc}
              inheritFontSize={inheritFontSize}
              inlineFlow
            />
          );
        })}
      </div>
    );
  }

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
      inheritFontSize={inheritFontSize}
    />
  );
}
