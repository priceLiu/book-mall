"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useEcomWorkspaceAssistantSeam } from "@/components/layout/ecom-workspace-assistant-seam-context";
import { cn } from "@/lib/utils";

type Props = {
  collapsed: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

function EdgeCollapseButtonControl({
  collapsed,
  onClick,
  disabled = false,
  className,
}: Props) {
  const title = disabled
    ? "生成中不可收起"
    : collapsed
      ? "展开侧栏"
      : "收起侧栏";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !collapsed}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d2d2d7] bg-white text-[#1d1d1f] shadow-[0_2px_12px_rgba(0,0,0,0.14)] transition hover:bg-[#f5f5f7]",
        disabled && !collapsed && "cursor-not-allowed opacity-50",
        className,
      )}
      aria-label={title}
      title={title}
    >
      {collapsed ? (
        <ChevronLeft className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
      ) : (
        <ChevronRight className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
      )}
    </button>
  );
}

/** 右侧配置侧栏边缘收起/展开（对齐左侧玻璃导航半圆切钮；默认 Portal 至中右接缝） */
export function EcomAssistantEdgeCollapseButton(props: Props) {
  const seamRef = useEcomWorkspaceAssistantSeam();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const control = <EdgeCollapseButtonControl {...props} />;

  const seamEl = mounted ? seamRef?.current : null;
  if (seamEl) {
    return createPortal(
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-[80] -translate-x-1/2 -translate-y-1/2">
        <div className="pointer-events-auto">{control}</div>
      </div>,
      seamEl,
    );
  }

  return (
    <div className="pointer-events-none absolute left-0 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
      <div className="pointer-events-auto">{control}</div>
    </div>
  );
}