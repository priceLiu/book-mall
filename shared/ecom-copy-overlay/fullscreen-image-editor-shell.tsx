"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 全屏图片编辑器壳。视觉对齐平台全屏剪辑台（黑底、圆角 surface、左中右）。
 * 挂到 document.body，并带 nopan/nodrag/nowheel，画布 React Flow 里可直接复用。
 * 电商默认 z-[300]（高于侧栏）；画布传 zClassName="z-[2000]"。
 */
export const FULLSCREEN_IMAGE_EDITOR_SURFACE =
  "overflow-hidden rounded-xl bg-[#161616] text-white";

const ROOT =
  "nopan nodrag nowheel pointer-events-auto fixed inset-0 flex h-dvh w-screen flex-col bg-[#0d0d0d] text-white";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** 顶栏左侧品牌标；传入后标题退到标旁边 */
  headerLeading?: ReactNode;
  headerCenter?: ReactNode;
  left: ReactNode;
  /** 左栏底部，不随内容滚动 */
  leftFooter?: ReactNode;
  center: ReactNode;
  right: ReactNode;
  /** 右栏底部，不随内容滚动 */
  rightFooter?: ReactNode;
  footer?: ReactNode;
  zClassName?: string;
};

export function FullscreenImageEditorShell({
  open,
  title,
  subtitle,
  onClose,
  headerLeading,
  headerCenter,
  left,
  leftFooter,
  center,
  right,
  rightFooter,
  footer,
  zClassName = "z-[300]",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`${ROOT} ${zClassName}`}
      style={{ colorScheme: "dark" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2">
        <div className="flex min-w-0 max-w-[min(100%,320px)] items-center gap-2.5 sm:max-w-[28%]">
          {headerLeading}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium text-white">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[11px] text-white/45">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {headerCenter ? (
          <div className="flex min-w-0 flex-1 justify-center">{headerCenter}</div>
        ) : (
          <div className="flex-1" />
        )}
        <button
          type="button"
          className="rounded-lg p-2 text-white hover:bg-white/10"
          aria-label="关闭"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto bg-[#0d0d0d] px-3 pb-3 pt-3">
        <aside
          className={`${FULLSCREEN_IMAGE_EDITOR_SURFACE} flex w-[360px] min-h-0 shrink-0 flex-col max-lg:w-[300px]`}
        >
          <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {left}
          </div>
          {leftFooter ? (
            <div className="shrink-0 border-t border-white/10 p-3">{leftFooter}</div>
          ) : null}
        </aside>

        <div
          className={`${FULLSCREEN_IMAGE_EDITOR_SURFACE} flex min-h-0 min-w-[320px] flex-1 flex-col bg-black`}
        >
          {center}
        </div>

        <aside
          className={`${FULLSCREEN_IMAGE_EDITOR_SURFACE} flex w-[360px] min-h-0 shrink-0 flex-col overflow-hidden max-lg:w-[300px]`}
        >
          <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {right}
          </div>
          {rightFooter ? (
            <div className="shrink-0 border-t border-white/10 p-3">{rightFooter}</div>
          ) : null}
        </aside>
      </div>

      {footer ? (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0d0d0d] px-4 py-3">
          {footer}
        </footer>
      ) : null}
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
