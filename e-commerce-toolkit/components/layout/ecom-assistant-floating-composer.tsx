"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { ECOM_ASSISTANT_FLOATING_COMPOSER_SHELL_CLASS } from "@/lib/ecom-assistant-chat-styles";

type Props = {
  open: boolean;
  /** 有待选卡片 / 待操作时显示角标 */
  attentionBadge?: boolean;
  onExpand: () => void;
  children: ReactNode;
  className?: string;
};

/** 助手折叠态：右下角悬浮输入区（Portal 至 body） */
export function EcomAssistantFloatingComposer({
  open,
  attentionBadge = false,
  onExpand,
  children,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[70] w-[min(calc(100vw-2rem),22rem)]",
        className,
      )}
    >
      {attentionBadge ? (
        <span
          className="absolute -right-1 -top-1 z-[1] flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10px] font-semibold text-white shadow-sm"
          aria-hidden
        >
          !
        </span>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        className={ECOM_ASSISTANT_FLOATING_COMPOSER_SHELL_CLASS}
        onClick={(e) => {
          if (e.target === e.currentTarget) onExpand();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onExpand();
          }
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
