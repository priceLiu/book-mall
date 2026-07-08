"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useClientPortalMounted } from "@/lib/canvas/use-modal-portal-effects";
import { MarkdownView } from "@/components/canvas/markdown-view";
import { LibtvMarkdownFormatToolbar } from "../libtv-markdown-format-toolbar";

export function StoryPro2TagExpandModal({
  open,
  title,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  value: string;
  onClose: () => void;
  onSave: (body: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const mounted = useClientPortalMounted();

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, value, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1200] flex flex-col bg-[#0c0a14]/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="nodrag flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-white/90">{title}</p>
        <button
          type="button"
          className="nodrag rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          完成
        </button>
        <button
          type="button"
          className="nodrag inline-flex size-9 items-center justify-center rounded-lg border border-white/15 text-white/80 hover:bg-white/10"
          aria-label="关闭"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="nodrag flex min-h-0 flex-1 flex-col gap-3 p-4 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <LibtvMarkdownFormatToolbar
            textareaRef={taRef}
            value={draft}
            onChange={setDraft}
          />
          <textarea
            ref={taRef}
            className="nodrag min-h-[240px] flex-1 resize-none rounded-xl border border-white/10 bg-[#1a1a1e] p-4 font-sans text-sm leading-relaxed text-white/85 placeholder:text-white/30 focus:border-white/25 focus:outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="输入内容…"
            spellCheck={false}
          />
        </div>
        <div className="nodrag min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/10 bg-[#141418] p-4">
          <p className="mb-2 text-[11px] text-white/40">预览</p>
          {draft.trim() ? (
            <MarkdownView content={draft} variant="darkPreview" className="text-sm" />
          ) : (
            <p className="text-sm text-white/30">（暂无内容）</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
