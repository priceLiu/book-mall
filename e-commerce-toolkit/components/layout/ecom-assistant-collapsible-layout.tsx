"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

import { EcomAssistantFloatingComposer } from "@/components/layout/ecom-assistant-floating-composer";
import { useEcomAssistantCollapseHandlers } from "@/lib/ecom-assistant-collapse";
import { cn } from "@/lib/utils";

type Props = {
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseBlocked?: boolean;
  attentionBadge?: boolean;
  /** 顶栏 + 消息区（不含 composer） */
  children: ReactNode;
  composer: ReactNode;
  /** 折叠态悬浮 composer；省略则复用 composer（须为独立 JSX 树） */
  floatingComposer?: ReactNode;
  className?: string;
};

/** 助手折叠：展开侧栏 / 右下角悬浮输入 */
export function EcomAssistantCollapsibleLayout({
  collapsed,
  onCollapsedChange,
  collapseBlocked = false,
  attentionBadge = false,
  children,
  composer,
  floatingComposer,
  className,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { tryExpand, handleAssistantBlur } = useEcomAssistantCollapseHandlers({
    collapsed,
    onCollapsedChange,
    collapseBlocked,
    rootRef,
  });

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "flex h-full min-h-0 flex-col bg-[var(--ecom-assistant-surface)]",
          collapsed && "pointer-events-none invisible absolute h-0 w-0 overflow-hidden",
          className,
        )}
        onBlur={handleAssistantBlur}
      >
        {children}
        {!collapsed ? composer : null}
      </div>
      {collapsed ? (
        <EcomAssistantFloatingComposer
          open
          attentionBadge={attentionBadge}
          onExpand={tryExpand}
        >
          <div data-ecom-floating-composer onClick={(e) => e.stopPropagation()}>
            {floatingComposer ?? composer}
          </div>
        </EcomAssistantFloatingComposer>
      ) : null}
    </>
  );
}
