"use client";

import { Search } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { MarkdownView } from "./markdown-view";

/** 故事主题 · 黑底只读预览（父级 flex-1 内滚） */
export function StoryThemePromptPreviewPane({
  displayMd,
  emptyHint,
  onOpen,
  disabled,
}: {
  displayMd: string;
  emptyHint: string;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const hasContent = Boolean(displayMd.trim());
  const canOpen = !disabled;

  const blockBubble = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  };

  const openPreview = (e: React.MouseEvent) => {
    blockBubble(e);
    if (!canOpen) return;
    onOpen();
  };

  return (
    <div
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      aria-label={canOpen ? "打开系统提示词审阅" : undefined}
      className={`group/paper relative h-full min-h-0 rounded-md border shadow-inner transition duration-200 ${
        canOpen
          ? hasContent
            ? "cursor-pointer border-white/15 bg-black hover:border-[#fb923c]/55 hover:shadow-[0_0_0_1px_rgba(251,146,60,0.25)]"
            : "cursor-pointer border-dashed border-white/20 bg-black/80 hover:border-[#fb923c]/40"
          : "cursor-default border-white/15 bg-black/90"
      } ${hasContent ? `${RF_NODE_SCROLL} overflow-y-auto` : "flex items-center justify-center"}`}
      onPointerDown={blockBubble}
      onMouseDown={blockBubble}
      onClick={openPreview}
      onKeyDown={(e) => {
        if (!canOpen) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          blockBubble(e);
          onOpen();
        }
      }}
    >
      <div className="px-3.5 py-3">
        {hasContent ? (
          <MarkdownView content={displayMd} variant="darkPreview" />
        ) : (
          <p className="text-center text-[12px] leading-relaxed text-white/45">
            {emptyHint}
          </p>
        )}
      </div>

      {canOpen && hasContent ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#fb923c]/0 opacity-0 transition duration-200 group-hover/paper:bg-[#fb923c]/[0.06] group-hover/paper:opacity-100"
          aria-hidden
        >
          <span className="inline-flex size-11 items-center justify-center rounded-full border border-[#fb923c]/35 bg-black/85 text-[#fdba74] shadow-md">
            <Search className="size-5" strokeWidth={2.25} />
          </span>
        </div>
      ) : null}
    </div>
  );
}
