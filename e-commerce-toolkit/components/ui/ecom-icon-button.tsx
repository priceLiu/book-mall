"use client";

import { motion } from "framer-motion";
import { Loader2, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { EcomWechatShareIcon } from "@/components/ui/ecom-wechat-share-icon";

export const ECOM_ICON_BTN_SIZE_CLASS = "h-8 w-8";
export const ECOM_ICON_BTN_ICON_CLASS = "h-4 w-4";

type Variant = "default" | "destructive" | "accent";

type BaseProps = {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  busy?: boolean;
  variant?: Variant;
  className?: string;
};

function variantClass(variant: Variant): string {
  switch (variant) {
    case "destructive":
      return "border-[#ff3b30]/30 text-[#ff3b30] hover:border-[#ff3b30] hover:bg-[#fff5f5]";
    case "accent":
      return "border-[var(--ecom-primary)] bg-[#f0f6ff] text-[var(--ecom-primary)]";
    default:
      return "border-[#d2d2d7] text-[var(--ecom-primary)] hover:border-[var(--ecom-primary)] hover:bg-[#f0f6ff]";
  }
}

const shellClass =
  "inline-flex shrink-0 items-center justify-center rounded-lg border bg-white transition-colors";

export function EcomIconButton({
  label,
  icon: Icon,
  disabled = false,
  busy = false,
  variant = "default",
  className,
  type = "button",
  onClick,
}: BaseProps & { type?: "button" | "submit" | "reset"; onClick?: () => void }) {
  return (
    <motion.button
      type={type}
      disabled={disabled || busy}
      title={label}
      aria-label={label}
      className={cn(
        shellClass,
        ECOM_ICON_BTN_SIZE_CLASS,
        variantClass(variant),
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      whileTap={disabled || busy ? undefined : { scale: 0.94 }}
      whileHover={disabled || busy ? undefined : { scale: 1.04 }}
      onClick={onClick}
    >
      {busy ? (
        <Loader2 className={cn(ECOM_ICON_BTN_ICON_CLASS, "animate-spin")} />
      ) : (
        <Icon className={ECOM_ICON_BTN_ICON_CLASS} strokeWidth={2} />
      )}
    </motion.button>
  );
}

/** 分享工作流专用钮（微信风格分享图标，链式分享逻辑不变） */
export function EcomShareIconButton({
  label = "分享工作流",
  disabled = false,
  className,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        shellClass,
        ECOM_ICON_BTN_SIZE_CLASS,
        variantClass("default"),
        "disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      whileHover={disabled ? undefined : { scale: 1.04 }}
      onClick={onClick}
    >
      <EcomWechatShareIcon className={ECOM_ICON_BTN_ICON_CLASS} />
    </motion.button>
  );
}

export function EcomIconButtonLink({
  label,
  icon: Icon,
  href,
  disabled = false,
  variant = "default",
  className,
}: BaseProps & { href: string }) {
  if (disabled) {
    return (
      <span
        title={label}
        aria-label={label}
        className={cn(
          shellClass,
          ECOM_ICON_BTN_SIZE_CLASS,
          variantClass(variant),
          "cursor-not-allowed opacity-40",
          className,
        )}
      >
        <Icon className={ECOM_ICON_BTN_ICON_CLASS} strokeWidth={2} />
      </span>
    );
  }

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        shellClass,
        ECOM_ICON_BTN_SIZE_CLASS,
        variantClass(variant),
        "transition-transform hover:scale-[1.04] active:scale-[0.94]",
        className,
      )}
    >
      <Icon className={ECOM_ICON_BTN_ICON_CLASS} strokeWidth={2} />
    </Link>
  );
}
