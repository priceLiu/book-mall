"use client";

import { useEffect, useRef, useState } from "react";
import {
  CANVAS_MODAL_FULLSCREEN_SHELL_CLASS,
  useModalBodyScrollLock,
} from "@/lib/canvas/use-modal-portal-effects";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { storyEditionModalSaveBtnClass } from "@/lib/canvas/story-edition-chrome";
import { STORY_HUB_LEFT_HINT, STORY_HUB_RIGHT_PREVIEW_HINT } from "@/lib/canvas/story-hub-editor-chrome";
import { StoryOutlineDocumentEditor } from "../story-outline-document-editor";
import { StoryHubReadonlyPane } from "../story-hub-readonly-pane";

const DOC_PAD = "px-6 py-10 sm:px-10 sm:py-12";
const PLAIN_DOC_TEXT =
  "nodrag block h-full min-h-0 w-full min-w-0 max-w-full resize-none overflow-y-auto border-0 bg-transparent font-sans text-[17px] leading-[1.85] text-neutral-800 shadow-none focus:outline-none focus:ring-0 break-words whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]";
const AUTOSAVE_MS = 600;

export type Pro2TextNodeOutlineModalProps = {
  open: boolean;
  title?: string;
  value: string;
  /** 通用文本节点 · 纯文本编辑/预览（无 Markdown 块编辑） */
  plainText?: boolean;
  onClose: () => void;
  /** 自动/手动保存时写入节点（触发画布 autosave） */
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
  const [savedBaseline, setSavedBaseline] = useState(value);
  const [mounted, setMounted] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const skipNextAutoSaveRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const savedBaselineRef = useRef(savedBaseline);
  const onAutoSaveRef = useRef(onAutoSave);
  draftRef.current = draft;
  savedBaselineRef.current = savedBaseline;
  onAutoSaveRef.current = onAutoSave;

  const dirty = draft.trim() !== savedBaseline.trim();

  useModalBodyScrollLock(open);

  const commitSave = (nextBaseline: string) => {
    onAutoSaveRef.current(nextBaseline);
    setSavedBaseline(nextBaseline);
    setSavedHint(true);
    window.setTimeout(() => setSavedHint(false), 2000);
  };

  const flushPendingSave = () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const currentDraft = draftRef.current;
    const baseline = savedBaselineRef.current;
    if (currentDraft.trim() !== baseline.trim()) {
      commitSave(currentDraft);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    skipNextAutoSaveRef.current = true;
    setDraft(value);
    setSavedBaseline(value);
    setSavedHint(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        flushPendingSave();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, value, onClose]);

  useEffect(() => {
    if (!open) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      if (draft.trim() === savedBaseline.trim()) return;
      commitSave(draft);
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [draft, open, savedBaseline]);

  const handleSave = () => {
    flushPendingSave();
  };

  const handleClose = () => {
    flushPendingSave();
    onClose();
  };

  if (!mounted || !open) return null;

  const editPane = (
    <div
      className={`nodrag flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white ${
        plainText ? "" : "border-r border-violet-400/10 lg:border-r"
      }`}
    >
      <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-50/95 px-4 py-2.5">
        <p className="text-xs font-medium text-neutral-700">
          {plainText ? "内容" : "编辑区"}
        </p>
        <p className="text-[10px] text-neutral-500">
          {plainText
            ? "长文本自动换行 · 编辑后自动保存"
            : STORY_HUB_LEFT_HINT.outline}
        </p>
      </div>
      <div
        data-canvas-wheel-scroll
        className={`nodrag ${RF_NODE_SCROLL} box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
          plainText ? "px-6 py-6 sm:px-10 sm:py-8" : DOC_PAD
        }`}
      >
        {plainText ? (
          <textarea
            className={PLAIN_DOC_TEXT}
            value={draft}
            spellCheck={false}
            placeholder="输入提示词或正文…"
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            <StoryOutlineDocumentEditor value={draft} onChange={setDraft} />
          </div>
        )}
      </div>
    </div>
  );

  const previewPane = plainText ? null : (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-neutral-50/80">
      <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
        <p className="text-xs font-medium text-neutral-600">渲染预览</p>
        <p className="text-[10px] text-neutral-500">{STORY_HUB_RIGHT_PREVIEW_HINT}</p>
      </div>
      <div
        data-canvas-wheel-scroll
        className={`${RF_NODE_SCROLL} box-border min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto ${DOC_PAD}`}
      >
        <div className="min-w-0 max-w-full overflow-x-hidden">
          <StoryHubReadonlyPane md={draft} />
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div
      className={`${CANVAS_MODAL_FULLSCREEN_SHELL_CLASS} z-[1600]`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-canvas-block-nav-gesture
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <header className="nodrag relative z-50 flex shrink-0 items-center justify-between gap-3 border-b border-violet-400/20 bg-[#14101c] px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-violet-100">{title}</p>
          <p className="text-[11px] text-white/45">
            {savedHint ? (
              <span className="text-violet-300">已自动保存</span>
            ) : dirty ? (
              <span className="text-amber-200/90">编辑中…</span>
            ) : (
              "已同步到画布"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className={storyEditionModalSaveBtnClass("pro2")}
            disabled={!dirty}
            title={dirty ? "保存到画布" : "无未保存修改"}
            onClick={handleSave}
          >
            <Save className="size-3.5" aria-hidden />
            保存
          </button>
          <button
            type="button"
            className="nodrag inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white shadow-sm transition hover:bg-white/20"
            aria-label="关闭"
            title="关闭"
            onClick={handleClose}
          >
            <X className="size-5" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </header>

      <div
        className={`grid min-h-0 min-w-0 flex-1 overflow-hidden ${
          plainText
            ? "grid-cols-1 grid-rows-[minmax(0,1fr)]"
            : "grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        }`}
      >
        {editPane}
        {previewPane}
      </div>
    </div>,
    document.body,
  );
}
