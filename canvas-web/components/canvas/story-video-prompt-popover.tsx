"use client";

import { cn } from "@/lib/utils";

/** hover 展示传给视频模型的完整提示词与输入说明 */
export function StoryVideoPromptPopover({
  prompt,
  refLabels = [],
  className,
  groupHoverClass = "group-hover/slot:block",
}: {
  prompt: string;
  refLabels?: string[];
  className?: string;
  /** 与父级 group 名一致，如 group-hover/frame-prompt:block */
  groupHoverClass?: string;
}) {
  const text = prompt.trim();
  if (!text) return null;

  return (
    <div
      className={cn(
        "nodrag pointer-events-auto absolute left-[calc(100%+8px)] top-0 z-30 hidden w-[min(380px,calc(100vw-300px))] max-h-[min(72vh,560px)] flex-col overflow-hidden rounded-lg border border-white/15 bg-black/94 shadow-2xl",
        groupHoverClass,
        className,
      )}
    >
      <p className="shrink-0 border-b border-white/10 px-3 py-2 text-[10px] leading-snug text-[#60a5fa]">
        视频生成提示词 ·{" "}
        <span className="text-white/55">主图 = 分镜图 · 三视图 = 参考</span>
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 text-[11px] leading-relaxed text-white/85 whitespace-pre-wrap">
        {text}
      </div>
      {refLabels.length ? (
        <p className="shrink-0 border-t border-white/10 px-3 py-2 text-[10px] text-white/45">
          @ 参考：{refLabels.join("、")}
        </p>
      ) : null}
    </div>
  );
}
