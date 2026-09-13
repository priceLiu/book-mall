"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * 助手侧栏固定底栏容器：预留圆角裁切区 + AI 小智 FAB 避让。
 * 须作为 EcomWorkspaceLayout assistantFooter 的直接子节点。
 */
export function EcomAssistantComposerDock({ children, className }: Props) {
  return (
    <div
      className={cn(
        "shrink-0 min-h-[4.5rem] pr-14 pb-6 pt-2",
        className,
      )}
      data-ecom-assistant-composer-dock
    >
      {children}
    </div>
  );
}
