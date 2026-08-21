"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CANVAS_MODAL_BACKDROP_CLASS,
  useModalBodyScrollLock,
  useModalEscapeClose,
} from "@/lib/canvas/use-modal-portal-effects";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { STORY_HUB_LEFT_HINT, STORY_HUB_RIGHT_PREVIEW_HINT } from "@/lib/canvas/story-hub-editor-chrome";
import { LIBTV_PLAIN_TEXT_WRAP_CLASS } from "@/lib/canvas/libtv-plain-text-display";
import { StoryOutlineDocumentEditor } from "../story-outline-document-editor";
import { StoryHubReadonlyPane } from "../story-hub-readonly-pane";

const DOC_PAD = "px-6 py-10 sm:px-10 sm:py-12";
const PLAIN_DOC_TEXT =
  "nodrag w-full min-w-0 max-w-full resize-none border-0 bg-transparent font-sans text-[17px] leading-[1.85] text-neutral-800 shadow-none focus:outline-none focus:ring-0 break-words whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]";
const AUTOSAVE_MS = 600;

export type Pro2TextNodeOutlineModalProps = {
  open: boolean;
  title?: string;
  value: string;
  /** 通用文本节点 · 纯文本编辑/预览（无 Markdown 块编辑） */
  plainText?: boolean;
  onClose: () => void;
  /** 草稿变更后自动写入节点（触发画布 autosave） */
  onAutoSave: (md: string) => void;
};

/** 2.0 文本节点 · 故事大纲全屏编辑（双击内容区打开） */
export function Pro2TextNodeOutlineModal({
  open,
  title = "故事大纲 · 编辑",
  value,
  plainText = false,
  onClose,
  onAutoSave,
}: Pro2TextNodeOutlineModalProps) {
  const [draft, setDraft] = useState(value);
  const [mounted, setMounted] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const skipNextSaveRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const plainTaRef = useRef<HTMLTextAreaElement | null>(null);
  const onAutoSaveRef = useRef(onAutoSave);
  onAutoSaveRef.current = onAutoSave;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    skipNextSaveRef.current = true;
    setDraft(value);
    setSavedHint(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
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

  // 纯文本：按内容增高，由外层 overflow 滚动（避免 rows=24 底部大片空白）
  useLayoutEffect(() => {
    if (!open || !plainText) return;
    const el = plainTaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 320)}px`;
  }, [draft, open, plainText]);

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
      className={`${CANVAS_MODAL_BACKDROP_CLASS} z-[1600]`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-canvas-block-nav-gesture
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

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div
          data-canvas-wheel-scroll
          className={`nodrag ${RF_NODE_SCROLL} flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto border-r border-violet-400/10 bg-white`}
        >
          <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-50/95 px-4 py-2.5">
            <p className="text-xs font-medium text-neutral-700">编辑区</p>
            <p className="text-[10px] text-neutral-500">
              {plainText ? "长文本自动换行 · 编辑后自动保存" : STORY_HUB_LEFT_HINT.outline}
            </p>
          </div>
          <div className={`box-border min-h-0 min-w-0 w-full max-w-full flex-1 ${DOC_PAD}`}>
            {plainText ? (
              <textarea
                ref={plainTaRef}
                className={PLAIN_DOC_TEXT}
                value={draft}
                spellCheck={false}
                placeholder="输入提示词或正文…"
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : (
              <StoryOutlineDocumentEditor value={draft} onChange={setDraft} />
            )}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-50/80">
          <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
            <p className="text-xs font-medium text-neutral-600">渲染预览</p>
            <p className="text-[10px] text-neutral-500">
              {plainText ? "与编辑区同步 · 自动换行" : STORY_HUB_RIGHT_PREVIEW_HINT}
            </p>
          </div>
          <div
            data-canvas-wheel-scroll
            className={`${RF_NODE_SCROLL} box-border min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto ${DOC_PAD}`}
          >
            {plainText ? (
              <div
                className={`${LIBTV_PLAIN_TEXT_WRAP_CLASS} font-sans text-[17px] leading-[1.85] text-neutral-800`}
              >
                {draft.trim() ? draft : "（暂无内容）"}
              </div>
            ) : (
              <div className="min-w-0 max-w-full overflow-x-hidden">
                <StoryHubReadonlyPane md={draft} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
