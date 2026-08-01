"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { StoryOutlineDocumentEditor } from "@/components/canvas/story-outline-document-editor";
import { StoryHubReadonlyPane } from "@/components/canvas/story-hub-readonly-pane";
import {
  STORY_HUB_LEFT_HINT,
  STORY_HUB_RIGHT_PREVIEW_HINT,
} from "@/lib/canvas/story-hub-editor-chrome";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";

const DOC_PAD = "px-6 py-8 sm:px-8 sm:py-10";

export type Pro2ScriptCategoryDocModalProps = {
  open: boolean;
  title: string;
  value: string;
  /** docs 内嵌默认 · 「恢复默认」用 */
  defaultBody?: string;
  onClose: () => void;
  onSave: (body: string) => void;
};

/** 剧本类别参考 · 故事大纲同款双栏编辑/预览（仅当前节点） */
export function Pro2ScriptCategoryDocModal({
  open,
  title,
  value,
  defaultBody = "",
  onClose,
  onSave,
}: Pro2ScriptCategoryDocModalProps) {
  const [draft, setDraft] = useState(value);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, value, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex h-[100dvh] max-w-[100vw] flex-col overflow-hidden bg-[#0c0a14]/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-canvas-block-nav-gesture
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="nodrag flex shrink-0 items-center gap-3 border-b border-violet-400/15 bg-[#14101c]/95 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-violet-100">{title}</p>
          <p className="mt-0.5 text-[11px] text-white/45">
            默认来自 docs/古风田宠短剧.md（改 docs 后运行 sync
            脚本并重新选择模板，或点「恢复 docs 默认」）。
          </p>
        </div>
        <button
          type="button"
          className="nodrag inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/30 text-violet-100 hover:bg-violet-500/15"
          aria-label="关闭"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div
          data-canvas-wheel-scroll
          className={cn(
            "nodrag",
            RF_NODE_SCROLL,
            "flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto border-r border-violet-400/10 bg-white",
          )}
        >
          <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-50/95 px-4 py-2.5">
            <p className="text-xs font-medium text-neutral-700">编辑区</p>
            <p className="text-[10px] text-neutral-500">{STORY_HUB_LEFT_HINT.outline}</p>
          </div>
          <div className={cn("box-border min-h-0 min-w-0 w-full max-w-full flex-1", DOC_PAD)}>
            <StoryOutlineDocumentEditor value={draft} onChange={setDraft} />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-50/80">
          <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
            <p className="text-xs font-medium text-neutral-600">渲染预览</p>
            <p className="text-[10px] text-neutral-500">{STORY_HUB_RIGHT_PREVIEW_HINT}</p>
          </div>
          <div
            data-canvas-wheel-scroll
            className={cn(
              RF_NODE_SCROLL,
              "box-border min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto",
              DOC_PAD,
            )}
          >
            <div className="min-w-0 max-w-full overflow-x-hidden">
              <StoryHubReadonlyPane md={draft} />
            </div>
          </div>
        </div>
      </div>

      <footer className="nodrag flex shrink-0 items-center justify-between gap-2 border-t border-violet-400/15 bg-[#14101c]/95 px-4 py-3">
        {defaultBody.trim() ? (
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-[12px] text-violet-200/80 hover:bg-violet-500/15"
            onClick={() => setDraft(defaultBody)}
          >
            恢复 docs 默认
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-[12px] text-white/60 hover:bg-white/10"
          onClick={onClose}
        >
          取消
        </button>
        <button
          type="button"
          className="rounded-md bg-violet-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-violet-500"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          应用
        </button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
