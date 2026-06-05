"use client";

import { cn } from "@/lib/utils";

type Props = {
  /** 中间栏：创作助手等区域 */
  assistant?: React.ReactNode;
  /** 助手栏顶部（标题、参考图等） */
  assistantHeader?: React.ReactNode;
  /** 助手与内容区之间的进度轨 */
  progress?: React.ReactNode;
  /** 右侧主内容 */
  children: React.ReactNode;
  contentClassName?: string;
  /** 无助手时内容占满 */
  fullWidth?: boolean;
};

/**
 * 电商工具箱工作区：助手（~30%）+ 内容（~70%）。
 * 左侧导航由 EcomAppShell 提供。
 */
export function EcomWorkspaceLayout({
  assistant,
  assistantHeader,
  progress,
  children,
  contentClassName,
  fullWidth,
}: Props) {
  const hasAssistant = Boolean(assistant) && !fullWidth;

  return (
    <div className="flex h-full min-h-0 w-full">
      {hasAssistant ? (
        <aside className="flex w-[30%] min-w-[260px] max-w-[400px] shrink-0 flex-col border-r border-[#e8e8ed] bg-[#fafafa]">
          {assistantHeader ? (
            <div className="shrink-0 border-b border-[#e8e8ed] px-4 py-3">
              {assistantHeader}
            </div>
          ) : null}
          <div className="min-h-0 flex-1">{assistant}</div>
        </aside>
      ) : null}

      {hasAssistant && progress ? (
        <div className="flex shrink-0 flex-col">{progress}</div>
      ) : null}

      <main
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f5f5f7]",
          contentClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
