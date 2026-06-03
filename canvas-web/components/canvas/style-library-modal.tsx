"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid, X } from "lucide-react";

import { StyleLibraryGrid } from "./style-library-grid";
import { StoryMediaPreviewModal } from "./story-column-media-panel";
import { useApplyStyleLibraryPreset } from "@/lib/canvas/style-library/use-apply-style-library";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";

const STYLE_LIBRARY_MODAL_Z = 1200;

export function StyleLibraryModal({
  open,
  onClose,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  /** 套用成功后回调（可用于 toast 等） */
  onApplied?: (preset: StyleLibraryPreset) => void;
}) {
  const applyPreset = useApplyStyleLibraryPreset();
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(
    null,
  );
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHint(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const handleApply = useCallback(
    async (preset: StyleLibraryPreset) => {
      const ok = await applyPreset(preset);
      if (!ok) return;
      setHint(`已套用：${preset.name}`);
      onApplied?.(preset);
      onClose();
    },
    [applyPreset, onApplied, onClose],
  );

  if (!open) return null;

  const node = (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      style={{ zIndex: STYLE_LIBRARY_MODAL_Z }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="风格库"
    >
      <div
        className="nodrag flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--canvas-surface,#161427)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[15px] font-medium text-white">
              <LayoutGrid className="size-4 text-cyan-400" />
              风格库
            </p>
            <p className="mt-0.5 text-[12px] text-white/55">
              悬停卡片查看风格提示词；点击条目将写入可编辑的「风格定义」节点（多工作流时优先当前选中或故事已定稿且风格未定稿的一套）。
            </p>
            {hint ? (
              <p className="mt-1 text-[11px] text-emerald-300/90">{hint}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </header>

        <StyleLibraryGrid
          fixedFilter
          className="min-h-0 w-full min-w-0 flex-1"
          filterClassName="px-5 pt-2"
          contentClassName="px-5 py-4"
          onSelect={(p) => void handleApply(p)}
          onPreview={(p) => {
            if (p.imageUrl) {
              setPreview({ url: p.imageUrl, title: p.name });
            }
          }}
          selectLabel="套用"
        />

        <footer className="shrink-0 border-t border-white/5 px-5 py-3 text-[11px] text-white/45">
          不会自动保存到「全局风格」；定稿后请在风格节点点击「保存到项目资产」。
        </footer>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(node, document.body)}
      {preview ? (
        <StoryMediaPreviewModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
