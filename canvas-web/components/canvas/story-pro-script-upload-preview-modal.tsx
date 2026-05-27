"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import type { StoryProUploadedScriptMeta } from "@/lib/canvas/story-pro-workspace-types";
import { MarkdownView } from "./markdown-view";

const DOC_PAD = "px-10 py-12 sm:px-14 sm:py-16";

/** 上传剧本 · 只读预览（Markdown / 纯文本） */
export function StoryProScriptUploadPreviewModal({
  open,
  onClose,
  md,
  meta,
}: {
  open: boolean;
  onClose: () => void;
  md: string;
  meta?: StoryProUploadedScriptMeta | null;
}) {
  const [mounted, setMounted] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const previewMd = useMemo(() => {
    if (!md.trim()) return "";
    if (meta?.format === "txt") {
      return md
        .split(/\r?\n/)
        .map((line) => (line.trim() ? line : ""))
        .join("\n\n");
    }
    return md;
  }, [md, meta?.format]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-neutral-600/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="上传剧本 · 预览"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="nodrag flex shrink-0 items-center gap-3 border-b border-white/10 bg-neutral-900/85 px-4 py-3">
        <FileText className="size-4 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {meta?.fileName ?? "上传剧本"}
          </p>
          <p className="text-[11px] text-white/50">
            {meta?.format === "txt" ? "纯文本" : "Markdown"} ·{" "}
            {(meta?.charCount ?? md.length).toLocaleString()} 字
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-white/10 p-1.5 text-white/70 hover:bg-white/10"
          aria-label="关闭"
        >
          <X className="size-5" />
        </button>
      </header>
      <div
        ref={bodyRef}
        className={`${RF_NODE_SCROLL} nodrag min-h-0 flex-1 overflow-y-auto bg-neutral-100`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`mx-auto max-w-[min(96vw,900px)] ${DOC_PAD}`}>
          {previewMd.trim() ? (
            <MarkdownView content={previewMd} variant="document" />
          ) : (
            <p className="text-neutral-500">（空文件）</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
