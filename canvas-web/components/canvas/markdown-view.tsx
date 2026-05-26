"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";

export function MarkdownView({
  content,
  className = "",
  variant = "inline",
}: {
  content: string;
  className?: string;
  /** inline=暗色节点；nodePreview=节点内白纸预览；document=全屏 Word 式阅读 */
  variant?: "inline" | "document" | "nodePreview";
}) {
  if (!content.trim()) {
    return (
      <p className="text-[11px] text-[var(--canvas-muted)]">（暂无 Markdown 内容）</p>
    );
  }

  const isDoc = variant === "document";
  const isNodePreview = variant === "nodePreview";
  const isLightDoc = isDoc || isNodePreview;

  const tableCell =
    isDoc ? "text-[15px] leading-relaxed"
    : isNodePreview ? "text-[12px] leading-relaxed"
    : "text-[11px]";
  const tablePad =
    isDoc ? "px-4 py-2.5"
    : isNodePreview ? "px-2.5 py-1.5"
    : "px-2 py-1";

  return (
    <div
      className={
        isDoc
          ? `prose prose-neutral max-w-none text-[17px] leading-[1.75] text-neutral-900 ${className}`
          : isNodePreview
            ? `prose prose-neutral max-w-none text-[13px] leading-[1.7] text-neutral-800 ${className}`
            : `${RF_NODE_SCROLL} prose prose-invert prose-sm max-w-none text-[12px] ${className}`
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className={
                isDoc
                  ? "mb-6 border-b border-neutral-200 pb-3 text-[28px] font-bold text-neutral-900"
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
                  ? "mb-4 mt-8 text-[22px] font-semibold text-neutral-800"
                  : isNodePreview
                    ? "mb-2 mt-5 border-b border-neutral-200 pb-1 text-[15px] font-semibold text-neutral-800 first:mt-0"
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
                  ? "mb-3 mt-6 text-[18px] font-semibold text-neutral-800"
                  : isNodePreview
                    ? "mb-2 mt-4 text-[14px] font-semibold text-neutral-800"
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
                    : undefined
              }
            >
              {children}
            </p>
          ),
          li: ({ children }) => (
            <li
              className={
                isDoc ? "text-[17px] leading-[1.75]"
                : isNodePreview ? "text-[13px] leading-[1.7]"
                : undefined
              }
            >
              {children}
            </li>
          ),
          table: ({ children }) => (
            <div
              className={`overflow-x-auto ${
                isDoc ? "my-6"
                : isNodePreview ? "my-3"
                : "my-4"
              }`}
            >
              <table
                className={`min-w-full border-collapse text-left ${tableCell} ${
                  isLightDoc ? "border border-neutral-300" : ""
                }`}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className={`border font-semibold ${
                isDoc
                  ? `border-neutral-300 bg-neutral-100 ${tablePad} text-[15px] text-neutral-900`
                  : isNodePreview
                    ? `border-neutral-300 bg-neutral-100 ${tablePad} text-[12px] text-neutral-900`
                    : `border-white/15 bg-white/5 ${tablePad}`
              }`}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={`border align-top ${tablePad} ${
                isLightDoc ? "border-neutral-200 bg-white" : "border-white/10"
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
