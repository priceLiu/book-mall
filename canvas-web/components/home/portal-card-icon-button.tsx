"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const BASE =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-[var(--canvas-muted)] transition disabled:opacity-50";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "default" | "danger";
};

/** 门户首页卡片底栏 · 与「我的画布」列表操作钮同风格（仅图标） */
export function PortalCardIconButton({
  children,
  variant = "default",
  className,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={cn(
        BASE,
        variant === "danger"
          ? "hover:border-red-400/40 hover:text-red-300"
          : "hover:border-cyan-400/40 hover:text-cyan-200",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
