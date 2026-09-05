"use client";

import { Loader2, Send } from "lucide-react";
import { motion } from "framer-motion";

import {
  ECOM_ASSISTANT_CONTROL_ICON_CLASS,
  ECOM_ASSISTANT_SEND_SIZE_CLASS,
} from "@/components/layout/ecom-assistant-icon-button";
import { cn } from "@/lib/utils";

type Props = {
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
};

/** 助手输入区 · 圆形发送钮（仅图标） */
export function EcomAssistantSendButton({
  disabled = false,
  busy = false,
  onClick,
  className,
  "aria-label": ariaLabel = "发送",
}: Props) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--ecom-btn-fill)] text-[var(--ecom-btn-on-fill)] shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
        ECOM_ASSISTANT_SEND_SIZE_CLASS,
        className,
      )}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      onClick={onClick}
    >
      {busy ? (
        <Loader2 className={cn(ECOM_ASSISTANT_CONTROL_ICON_CLASS, "animate-spin")} />
      ) : (
        <Send className={ECOM_ASSISTANT_CONTROL_ICON_CLASS} />
      )}
    </motion.button>
  );
}
