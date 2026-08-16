"use client";

/**
 * AI 空间统一覆盖层（弹层 / 灯箱 / 确认框共用）
 *
 * **必须 portal 到 body**：账号页侧栏是 `z-[410]` 的 sticky 元素、顶部导航同样自带层级，
 * 写在组件树里的 `fixed inset-0` 遮罩即使 `z-50` 也会被这些祖先压住，
 * 表现为遮罩罩不住顶栏与左侧栏、四周露白边。
 *
 * 层级取值统一放在 AI_SPACE_OVERLAY_Z，勿在业务组件里手写 `z-[...]`。
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/** 参照：合成任务悬浮窗 z-[450]、账号侧栏 z-[410] */
export const AI_SPACE_OVERLAY_Z = {
  dialog: 460,
  lightbox: 470,
  /** 叠在其它弹层之上的确认框 */
  confirm: 490,
} as const;

export type AiSpaceOverlayLevel = keyof typeof AI_SPACE_OVERLAY_Z;

export function AiSpaceOverlay({
  children,
  onClose,
  level = "dialog",
  label,
  backdropClassName,
}: {
  children: React.ReactNode;
  /** 传入则支持点遮罩空白处与 Esc 关闭 */
  onClose?: () => void;
  level?: AiSpaceOverlayLevel;
  label?: string;
  /** 追加/覆盖遮罩类（走 tailwind-merge，可直接改 bg 与 flex 方向） */
  backdropClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/40 p-4",
        backdropClassName,
      )}
      style={{ zIndex: AI_SPACE_OVERLAY_Z[level] }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => {
        if (onClose && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
