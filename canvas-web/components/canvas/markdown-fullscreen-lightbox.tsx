"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { MarkdownView } from "./markdown-view";

/** 全屏 Markdown 预览（Word 式居中文档 + 可滚动） */
export function MarkdownFullscreenLightbox({
  title,
  content,
  onClose,
}: {
  title: string;
  content: string;
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
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-neutral-600/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-neutral-900/80 px-4 py-3">
        <p className="truncate text-base font-medium text-white">{title}</p>
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
        className={`${RF_NODE_SCROLL} min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <article className="mx-auto min-h-[min(100%,720px)] w-full max-w-[820px] rounded-sm bg-white px-10 py-12 shadow-2xl sm:px-14 sm:py-16">
          <MarkdownView content={content} variant="document" />
        </article>
      </div>
    </div>,
    document.body,
  );
}
