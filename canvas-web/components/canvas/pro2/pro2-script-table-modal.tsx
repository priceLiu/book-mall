"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import type { Pro2ScriptHubViewTab } from "@/lib/canvas/pro2-script-hub-view-types";
import {
  StoryCharacterTableEditor,
  canEditCharacterAsTable,
} from "../story-character-table-editor";
import {
  StoryStoryboardTableEditor,
  canEditStoryboardAsTable,
} from "../story-storyboard-table-editor";
import { cn } from "@/lib/utils";
import { Pro2ScriptHubViewTabs } from "./pro2-script-hub-view-tabs";

const AUTOSAVE_MS = 600;

export type Pro2ScriptHubEditorModalProps = {
  open: boolean;
  title?: string;
  tab: Pro2ScriptHubViewTab;
  onTabChange: (tab: Pro2ScriptHubViewTab) => void;
  characterMd: string;
  storyboardMd: string;
  onClose: () => void;
  onAutoSaveCharacter: (md: string) => void;
  onAutoSaveStoryboard: (md: string) => void;
};

/** 2.0 脚本节点 · 角色 / 分镜表全屏编辑 */
export function Pro2ScriptHubEditorModal({
  open,
  title = "脚本 · 编辑",
  tab,
  onTabChange,
  characterMd,
  storyboardMd,
  onClose,
  onAutoSaveCharacter,
  onAutoSaveStoryboard,
}: Pro2ScriptHubEditorModalProps) {
  const [draftCharacter, setDraftCharacter] = useState(characterMd);
  const [draftStoryboard, setDraftStoryboard] = useState(storyboardMd);
  const [mounted, setMounted] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const skipNextSaveRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const onAutoSaveCharacterRef = useRef(onAutoSaveCharacter);
  const onAutoSaveStoryboardRef = useRef(onAutoSaveStoryboard);
  onAutoSaveCharacterRef.current = onAutoSaveCharacter;
  onAutoSaveStoryboardRef.current = onAutoSaveStoryboard;

  const draft = tab === "character" ? draftCharacter : draftStoryboard;
  const setDraft = tab === "character" ? setDraftCharacter : setDraftStoryboard;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    skipNextSaveRef.current = true;
    setDraftCharacter(characterMd);
    setDraftStoryboard(storyboardMd);
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
  }, [open, characterMd, storyboardMd, onClose]);

  useEffect(() => {
    if (!open) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      if (tab === "character") {
        onAutoSaveCharacterRef.current(draftCharacter);
      } else {
        onAutoSaveStoryboardRef.current(draftStoryboard);
      }
      setSavedHint(true);
      window.setTimeout(() => setSavedHint(false), 2000);
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [draftCharacter, draftStoryboard, open, tab]);

  if (!mounted || !open) return null;

  const canTable =
    tab === "character"
      ? canEditCharacterAsTable(draft)
      : canEditStoryboardAsTable(draft);

  const subtitle =
    tab === "character"
      ? "角色视图 · 双击单元格编辑"
      : "脚本视图 · 双击单元格编辑";

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-[#0a0a12]/94 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-violet-400/15 px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-violet-50">
              {title}
            </p>
            {savedHint ? (
              <p className="text-[11px] text-violet-300/70">已自动保存</p>
            ) : (
              <p className="text-[11px] text-white/40">{subtitle}</p>
            )}
          </div>
          <Pro2ScriptHubViewTabs
            value={tab}
            onChange={onTabChange}
            size="modal"
          />
        </div>
        <button
          type="button"
          className="nodrag shrink-0 rounded-lg p-2 text-white/50 hover:bg-white/8"
          onClick={onClose}
        >
          <X className="size-5" />
        </button>
      </header>
      <div
        className={cn(
          RF_NODE_SCROLL,
          "min-h-0 flex-1 overflow-auto bg-[#f8f7f4] px-4 py-6 sm:px-8",
        )}
      >
        {canTable ? (
          tab === "character" ? (
            <StoryCharacterTableEditor value={draft} onChange={setDraft} />
          ) : (
            <StoryStoryboardTableEditor value={draft} onChange={setDraft} />
          )
        ) : (
          <textarea
            className="nodrag min-h-[60vh] w-full resize-y rounded-lg border border-neutral-200 bg-white p-4 font-mono text-[13px] text-neutral-800"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

/** @deprecated 使用 Pro2ScriptHubEditorModal */
export const Pro2ScriptTableModal = Pro2ScriptHubEditorModal;
