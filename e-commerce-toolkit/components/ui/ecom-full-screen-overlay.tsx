"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { EcomDialogCloseButton } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 遮罩 z-index，默认 300 */
  zIndexClass?: string;
  backdropClassName?: string;
  panelClassName?: string;
  /** 点击遮罩关闭 */
  closeOnBackdrop?: boolean;
};

/**
 * 全屏/大尺寸弹层（createPortal · 无 Radix Presence，避免复杂表编辑时 compose-refs 循环）
 */
export function EcomFullScreenOverlay({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  zIndexClass = "z-[300]",
  backdropClassName,
  panelClassName,
  closeOnBackdrop = true,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-black/80 p-2 sm:p-4",
        zIndexClass,
        backdropClassName,
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "ecom-fullscreen-overlay-title" : undefined}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "relative flex max-h-[min(96vh,920px)] w-[min(98vw,1600px)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl",
          panelClassName,
        )}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <EcomDialogCloseButton onClick={onClose} />
        {title ? (
          <div className="shrink-0 border-b border-[#e8e8ed] px-5 py-4 pr-14">
            <h2 id="ecom-fullscreen-overlay-title" className="text-lg font-semibold text-[#1d1d1f]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-[#6e6e73]">{description}</p>
            ) : null}
          </div>
        ) : null}
        {children}
        {footer ? (
          <div className="shrink-0 border-t border-[#e8e8ed] px-5 py-3">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
