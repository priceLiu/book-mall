"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/** 助手区圆形控件 · 统一尺寸（发送 / 设置 / 顶栏图标） */
export const ECOM_ASSISTANT_SEND_SIZE_CLASS = "h-10 w-10";
export const ECOM_ASSISTANT_ICON_BTN_SIZE_CLASS = "h-9 w-9";
export const ECOM_ASSISTANT_CONTROL_ICON_CLASS = "h-4 w-4";

type Props = {
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** outline = 蓝色描边（设置）；muted = 灰描边（加宽/收起） */
  variant?: "outline" | "muted";
};

export function EcomAssistantIconButton({
  children,
  title,
  disabled = false,
  onClick,
  className,
  variant = "outline",
}: Props) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        ECOM_ASSISTANT_ICON_BTN_SIZE_CLASS,
        variant === "outline"
          ? "border-[var(--ecom-primary)] text-[var(--ecom-primary)] hover:bg-[var(--ecom-btn-fill)]/5"
          : "border-[#e8e8ed] text-[#6e6e73] hover:border-[var(--ecom-chrome-accent)]",
        className,
      )}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
