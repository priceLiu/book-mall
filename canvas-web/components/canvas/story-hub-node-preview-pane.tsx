"use client";

import { Search } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { MarkdownView } from "./markdown-view";

/** 故事大纲节点 · 白纸只读预览；悬停整块高亮，点击打开审阅 */
export function StoryHubNodePreviewPane({
  content,
  emptyHint,
  onOpenPreview,
}: {
  content: string;
  emptyHint: string;
  onOpenPreview: () => void;
}) {
  const hasContent = Boolean(content.trim());

  const blockBubble = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  };

  const openFromPaper = (e: React.MouseEvent) => {
    blockBubble(e);
    if (!hasContent) return;
    onOpenPreview();
  };

  return (
    <div
      role={hasContent ? "button" : undefined}
      tabIndex={hasContent ? 0 : undefined}
      aria-label={hasContent ? "打开预览" : undefined}
      className={`nodrag nowheel group/paper relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border shadow-inner transition duration-200 ${
        hasContent
          ? "cursor-pointer border-white/15 bg-neutral-50 hover:border-[#fb923c]/55 hover:bg-neutral-100 hover:shadow-[0_0_0_1px_rgba(251,146,60,0.25),inset_0_0_0_1px_rgba(251,146,60,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#fb923c]/70"
          : "min-h-[120px] cursor-default border-white/15 bg-neutral-50/80"
      }`}
      onPointerDown={blockBubble}
      onMouseDown={blockBubble}
      onClick={openFromPaper}
      onKeyDown={(e) => {
        if (!hasContent) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          blockBubble(e);
          onOpenPreview();
        }
      }}
    >
      <div
        className={`min-h-0 flex-1 px-3.5 py-3 sm:px-4 sm:py-3.5 ${
          hasContent
            ? `overflow-y-auto ${RF_NODE_SCROLL}`
            : "flex items-center justify-center"
        }`}
      >
        {hasContent ? (
          <MarkdownView content={content} variant="nodePreview" />
        ) : (
          <p className="text-center text-[12px] leading-relaxed text-neutral-500">
            {emptyHint}
          </p>
        )}
      </div>

      {hasContent ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#fb923c]/0 opacity-0 transition duration-200 group-hover/paper:bg-[#fb923c]/[0.06] group-hover/paper:opacity-100"
          aria-hidden
        >
          <span className="inline-flex size-11 items-center justify-center rounded-full border border-[#fb923c]/35 bg-white/90 text-[#ea580c] shadow-md">
            <Search className="size-5" strokeWidth={2.25} />
          </span>
        </div>
      ) : null}
    </div>
  );
}
