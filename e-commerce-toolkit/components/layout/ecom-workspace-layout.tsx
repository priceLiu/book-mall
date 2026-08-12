"use client";

import { cn } from "@/lib/utils";

type Props = {
  /** 右侧栏：创作助手、选项与输入 */
  assistant?: React.ReactNode;
  /** 助手栏顶部（标题、参考图等） */
  assistantHeader?: React.ReactNode;
  /** 主内容与助手之间的进度轨 */
  progress?: React.ReactNode;
  /** 左侧主内容（结果、画布、资产列表等） */
  children: React.ReactNode;
  contentClassName?: string;
  /** 无助手时内容占满 */
  fullWidth?: boolean;
  /** 助手栏加宽（输入区聚焦或手动展开） */
  assistantWide?: boolean;
};

/**
 * 电商工具箱工作区：内容（~70%）+ 可选进度轨 + 助手（~30%，最右）。
 * 站点侧栏仍在 EcomAppShell 最左侧。
 */
export function EcomWorkspaceLayout({
  assistant,
  assistantHeader,
  progress,
  children,
  contentClassName,
  fullWidth,
  assistantWide = false,
}: Props) {
  const hasAssistant = Boolean(assistant) && !fullWidth;

  return (
    <div className="flex h-full min-h-0 w-full flex-col md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden md:h-full">
        <main
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white",
            contentClassName,
          )}
        >
          {children}
        </main>

        {hasAssistant && progress ? (
          <div className="hidden h-full shrink-0 flex-col md:flex">{progress}</div>
        ) : null}
      </div>

      {hasAssistant ? (
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col overflow-hidden border-t border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bg)] transition-[width,max-width] duration-200 ease-out md:h-full md:border-l md:border-t-0",
            assistantWide
              ? "md:w-[44%] md:min-w-[320px] md:max-w-[640px]"
              : "md:w-[30%] md:min-w-[260px] md:max-w-[400px]",
          )}
        >
          {assistantHeader ? (
            <div className="shrink-0 border-b border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bg)] px-4 py-3">
              {assistantHeader}
            </div>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden max-h-[min(42vh,360px)] md:max-h-none">
            {assistant}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
