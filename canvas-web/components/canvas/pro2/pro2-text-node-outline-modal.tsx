"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { STORY_HUB_LEFT_HINT, STORY_HUB_RIGHT_PREVIEW_HINT } from "@/lib/canvas/story-hub-editor-chrome";
import { StoryOutlineDocumentEditor } from "../story-outline-document-editor";
import { StoryHubReadonlyPane } from "../story-hub-readonly-pane";

const DOC_PAD = "px-10 py-12 sm:px-14 sm:py-16";
const AUTOSAVE_MS = 600;

export type Pro2TextNodeOutlineModalProps = {
  open: boolean;
  title?: string;
  value: string;
  onClose: () => void;
  /** 草稿变更后自动写入节点（触发画布 autosave） */
  onAutoSave: (md: string) => void;
};

/** 2.0 文本节点 · 故事大纲全屏编辑（双击内容区打开） */
export function Pro2TextNodeOutlineModal({
  open,
  title = "故事大纲 · 编辑",
  value,
  onClose,
  onAutoSave,
}: Pro2TextNodeOutlineModalProps) {
  const [draft, setDraft] = useState(value);
  const [mounted, setMounted] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const skipNextSaveRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const onAutoSaveRef = useRef(onAutoSave);
  onAutoSaveRef.current = onAutoSave;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    skipNextSaveRef.current = true;
    setDraft(value);
    setSavedHint(false);
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

  useEffect(() => {
    if (!open) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      const trimmed = draft.trim();
      if (trimmed === value.trim()) return;
      onAutoSaveRef.current(draft);
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 2000);
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [draft, open, value]);

  const flushSave = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (draft.trim() !== value.trim()) {
      onAutoSaveRef.current(draft);
    }
  };

  const handleClose = () => {
    flushSave();
    onClose();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-[#0c0a14]/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <header className="nodrag flex shrink-0 items-center gap-3 border-b border-violet-400/15 bg-[#14101c]/95 px-4 py-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-violet-100">
          {title}
        </p>
        <span className="shrink-0 text-[11px] text-white/45">
          {savedHint ? (
            <span className="text-violet-300">已自动保存</span>
          ) : (
            "编辑后自动保存"
          )}
        </span>
        <button
          type="button"
          className="nodrag inline-flex size-9 items-center justify-center rounded-lg border border-violet-400/30 text-violet-100 hover:bg-violet-500/15"
          aria-label="关闭"
          onClick={handleClose}
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div
          className={`nodrag ${RF_NODE_SCROLL} flex min-h-0 flex-col overflow-y-auto border-r border-violet-400/10 bg-white`}
        >
          <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-50/95 px-4 py-2.5">
            <p className="text-xs font-medium text-neutral-700">编辑区</p>
            <p className="text-[10px] text-neutral-500">
              {STORY_HUB_LEFT_HINT.outline}
            </p>
          </div>
          <div className={`min-h-0 flex-1 ${DOC_PAD}`}>
            <StoryOutlineDocumentEditor value={draft} onChange={setDraft} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden bg-neutral-50/80">
          <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
            <p className="text-xs font-medium text-neutral-600">渲染预览</p>
            <p className="text-[10px] text-neutral-500">
              {STORY_HUB_RIGHT_PREVIEW_HINT}
            </p>
          </div>
          <div className={`${RF_NODE_SCROLL} min-h-0 flex-1 overflow-y-auto ${DOC_PAD}`}>
            <StoryHubReadonlyPane md={draft} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
