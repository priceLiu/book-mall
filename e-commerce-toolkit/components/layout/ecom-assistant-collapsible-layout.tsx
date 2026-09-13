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
  const collapseEnabled = Boolean(onCollapsedChange);
  const { tryExpand, handleAssistantBlur } = useEcomAssistantCollapseHandlers({
    collapsed,
    onCollapsedChange,
    collapseBlocked,
    rootRef,
  });
  const showComposer = !collapsed && composer;

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "grid h-full min-h-0 w-full overflow-hidden bg-[var(--ecom-assistant-surface)] overscroll-y-contain",
          showComposer
            ? "grid-rows-[auto_minmax(0,1fr)_auto]"
            : "grid-rows-[auto_minmax(0,1fr)]",
          collapsed && "pointer-events-none invisible absolute h-0 w-0 overflow-hidden",
          className,
        )}
        onBlur={collapseEnabled ? handleAssistantBlur : undefined}
      >
        {children}
        {showComposer ? composer : null}
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
