"use client";

import { STORY_NODE_FOOTER_CONTENT_MIN_H } from "@/lib/canvas/story-node-chrome";

type StoryNodeFooterShellProps = {
  /** 主操作区：单按钮、双按钮横排、批量按钮等 */
  children: React.ReactNode;
  /** 底栏第二行提示；无内容时保留等高占位 */
  hint?: React.ReactNode;
};

/**
 * 漫剧节点统一底栏骨架：与「故事主题」左侧节点对齐。
 * - 主按钮区在上
 * - 提示行固定 16px（无文案时用占位，避免底栏黑隙高低不一）
 */
export function StoryNodeFooterShell({
  children,
  hint,
}: StoryNodeFooterShellProps) {
  return (
    <div
      className="flex w-full flex-col gap-2"
      style={{ minHeight: STORY_NODE_FOOTER_CONTENT_MIN_H }}
    >
      <div className="shrink-0">{children}</div>
      <div
        className="flex h-4 min-h-4 shrink-0 items-center text-[10px] leading-4 text-[var(--canvas-muted)]"
        aria-hidden={hint ? undefined : true}
      >
        {hint ?? <span className="inline-block w-full select-none opacity-0">.</span>}
      </div>
    </div>
  );
}
