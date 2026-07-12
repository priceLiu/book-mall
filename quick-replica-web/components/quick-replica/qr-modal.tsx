"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** default: 窄条；square: 80% 正方形；preview: 居中盒；model-picker: 模型选择器；audio / audio-track: 音轨弹层（同宽） */
  variant?: "default" | "square" | "preview" | "model-picker" | "audio" | "audio-track";
  hideHeader?: boolean;
};

export function QrModal({
  open,
  onClose,
  title,
  children,
  variant = "default",
  hideHeader,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const audioTrackWidth = "w-[min(92vw,1200px)]";

  const shellClass =
    variant === "preview"
      ? "qr-modal-shell relative z-10 flex h-[min(calc(100vh-80px),90dvh)] w-[min(90vw,1400px)] max-h-[calc(100vh-80px)] max-w-[min(90vw,1400px)] min-h-[33vh]"
      : variant === "model-picker"
        ? "qr-modal-shell relative z-10 flex h-[clamp(480px,80dvh,92dvh)] w-[min(92vw,clamp(480px,33vw,1200px))] max-h-[92dvh]"
      : variant === "audio-track"
        ? `relative z-10 flex ${audioTrackWidth} pointer-events-auto`
        : variant === "audio"
          ? `qr-modal-shell relative z-10 flex ${audioTrackWidth} max-h-[85dvh]`
          : variant === "square"
            ? "qr-modal-shell relative z-10 flex h-[80vmin] w-[80vmin] max-h-[80dvh] max-w-[80vw]"
            : "qr-modal-shell relative z-10 flex max-h-[90dvh] w-full max-w-lg";

  const showHeader = Boolean(title) && !hideHeader;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label="关闭"
        onClick={onClose}
      />
      <div className={shellClass}>
        {showHeader ? (
          <div
            className="flex shrink-0 items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--qr-border)" }}
          >
            <h2 className="text-sm font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="关闭">
              <X className="h-4 w-4 text-[var(--qr-text-muted)]" />
            </button>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
