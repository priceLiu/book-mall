"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Volume2, X } from "lucide-react";

/** 全屏音频预览 */
export function AudioFullscreenLightbox({
  title,
  src,
  onClose,
}: {
  title: string;
  src: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-black/94 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-4">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto shrink-0 rounded-full border border-white/10 p-1.5 text-white/70 hover:border-white/30 hover:bg-white/10 hover:text-white"
          aria-label="关闭"
        >
          <X className="size-5" />
        </button>
      </header>
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Volume2 className="size-16 text-white/30" />
        <audio src={src} controls autoPlay className="w-full max-w-lg" />
      </div>
    </div>,
    document.body,
  );
}
