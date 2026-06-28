"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Megaphone, X } from "lucide-react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { confirmAndPublishPro2ScriptHub } from "@/lib/canvas/pro2-publish-script-hub";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import {
  STORY_HUB_LEFT_HINT,
  STORY_HUB_RIGHT_PREVIEW_HINT,
} from "@/lib/canvas/story-hub-editor-chrome";
import type { Pro2ScriptHubViewTab } from "@/lib/canvas/pro2-script-hub-view-types";
import {
  StoryCharacterTableEditor,
  canEditCharacterAsTable,
} from "../story-character-table-editor";
import {
  StoryStoryboardTableEditor,
  canEditStoryboardAsTable,
} from "../story-storyboard-table-editor";
import {
  StoryGenericMdTableEditor,
  canEditGenericMdTable,
} from "../story-generic-md-table-editor";
import { StoryOutlineDocumentEditor } from "../story-outline-document-editor";
import { StoryHubReadonlyPane } from "../story-hub-readonly-pane";
import { cn } from "@/lib/utils";
import { Pro2ScriptHubViewTabs } from "./pro2-script-hub-view-tabs";

const DOC_PAD = "px-10 py-12 sm:px-14 sm:py-16";
const AUTOSAVE_MS = 600;

export type Pro2ScriptHubEditorModalProps = {
  open: boolean;
  title?: string;
  tab: Pro2ScriptHubViewTab;
  onTabChange: (tab: Pro2ScriptHubViewTab) => void;
  outlineMd: string;
  sceneMd: string;
  characterMd: string;
  storyboardMd: string;
  onClose: () => void;
  onAutoSaveOutline: (md: string) => void;
  onAutoSaveScene: (md: string) => void;
  onAutoSaveCharacter: (md: string) => void;
  onAutoSaveStoryboard: (md: string) => void;
  /** 脚本 hub id · 用于发布剧本 */
  hubId?: string;
  hubData?: StoryProScriptHubNodeData;
  /** 协作画布 meta 锚点 · 只读快照 */
  readOnly?: boolean;
};

/** 2.0 脚本节点 · 大纲 / 场景 / 角色 / 分镜全屏编辑 */
export function Pro2ScriptHubEditorModal({
  open,
  title = "脚本 · 编辑",
  tab,
  onTabChange,
  outlineMd,
  sceneMd,
  characterMd,
  storyboardMd,
  onClose,
  onAutoSaveOutline,
  onAutoSaveScene,
  onAutoSaveCharacter,
  onAutoSaveStoryboard,
  hubId,
  hubData,
  readOnly = false,
}: Pro2ScriptHubEditorModalProps) {
  const { alert, confirm } = useDialogs();
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [draftOutline, setDraftOutline] = useState(outlineMd);
  const [draftScene, setDraftScene] = useState(sceneMd);
  const [draftCharacter, setDraftCharacter] = useState(characterMd);
  const [draftStoryboard, setDraftStoryboard] = useState(storyboardMd);
  const [savedHint, setSavedHint] = useState(false);
  const skipNextSaveRef = useRef(true);
  const wasOpenRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const onAutoSaveOutlineRef = useRef(onAutoSaveOutline);
  const onAutoSaveSceneRef = useRef(onAutoSaveScene);
  const onAutoSaveCharacterRef = useRef(onAutoSaveCharacter);
  const onAutoSaveStoryboardRef = useRef(onAutoSaveStoryboard);
  onAutoSaveOutlineRef.current = onAutoSaveOutline;
  onAutoSaveSceneRef.current = onAutoSaveScene;
  onAutoSaveCharacterRef.current = onAutoSaveCharacter;
  onAutoSaveStoryboardRef.current = onAutoSaveStoryboard;

  const onPublishScript = useCallback(async () => {
    if (!hubId || !hubData) return;
    const live = useCanvasStore.getState().nodes.find((n) => n.id === hubId);
    const liveData = (live?.data ?? hubData) as StoryProScriptHubNodeData;
    const pub = await confirmAndPublishPro2ScriptHub(hubId, liveData, {
      alert,
      confirm,
    }, {
      requireBatch: liveData.scriptStudioMode === true,
      batchIndex: liveData.scriptStudioBatchIndex,
    });
    if (pub) updateNodeData(hubId, pub);
  }, [hubId, hubData, alert, confirm, updateNodeData]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      skipNextSaveRef.current = true;
      setDraftOutline(outlineMd);
      setDraftScene(sceneMd);
      setDraftCharacter(characterMd);
      setDraftStoryboard(storyboardMd);
      setSavedHint(false);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // 仅随 open 开关初始化 draft；勿依赖 md props（store 轮询/自动保存会触发整页闪屏）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- outlineMd/sceneMd/characterMd/storyboardMd intentionally omitted
  }, [open, onClose]);

  useEffect(() => {
    if (!open || readOnly) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      if (tab === "outline") {
        onAutoSaveOutlineRef.current(draftOutline);
      } else if (tab === "scene") {
        onAutoSaveSceneRef.current(draftScene);
      } else if (tab === "character") {
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
  }, [draftOutline, draftScene, draftCharacter, draftStoryboard, open, readOnly, tab]);

  if (!open) return null;

  const subtitle =
    tab === "outline"
      ? "大纲视图 · 块级渲染编辑"
      : tab === "scene"
        ? "场景视图 · 双击单元格编辑"
        : tab === "character"
          ? "角色视图 · 双击单元格编辑"
          : "脚本视图 · 双击单元格编辑";

  const tableDraft =
    tab === "scene"
      ? draftScene
      : tab === "character"
        ? draftCharacter
        : draftStoryboard;
  const setTableDraft =
    tab === "scene"
      ? setDraftScene
      : tab === "character"
        ? setDraftCharacter
        : setDraftStoryboard;

  const canTable =
    tab === "scene"
      ? canEditGenericMdTable(tableDraft)
      : tab === "character"
        ? canEditCharacterAsTable(tableDraft)
        : tab === "script"
          ? canEditStoryboardAsTable(tableDraft)
          : false;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-[#0c0a14]/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-violet-400/15 bg-[#14101c]/95 px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-white">
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
        <div className="flex shrink-0 items-center gap-2">
          {hubId && hubData ? (
            <button
              type="button"
              className="nodrag inline-flex items-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-500/15 px-3 py-1.5 text-[11px] font-medium text-violet-100 transition hover:bg-violet-500/25"
              title="发布剧本 · 保存后可发布至剧组公告条"
              onClick={() => void onPublishScript()}
            >
              <Megaphone className="size-3.5" />
              发布剧本
            </button>
          ) : null}
          <button
            type="button"
            className="nodrag shrink-0 rounded-lg p-2 text-white/50 hover:bg-white/8"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      {tab === "outline" ? (
        readOnly ? (
          <div
            className={`${RF_NODE_SCROLL} min-h-0 flex-1 overflow-y-auto bg-[#f8f7f4] ${DOC_PAD}`}
          >
            <StoryHubReadonlyPane md={draftOutline} />
          </div>
        ) : (
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
              <StoryOutlineDocumentEditor
                value={draftOutline}
                onChange={setDraftOutline}
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden bg-neutral-50/80">
            <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">渲染预览</p>
              <p className="text-[10px] text-neutral-500">
                {STORY_HUB_RIGHT_PREVIEW_HINT}
              </p>
            </div>
            <div
              className={`${RF_NODE_SCROLL} min-h-0 flex-1 overflow-y-auto ${DOC_PAD}`}
            >
              <StoryHubReadonlyPane md={draftOutline} />
            </div>
          </div>
        </div>
        )
      ) : (
        <div
          className={cn(
            RF_NODE_SCROLL,
            "min-h-0 flex-1 overflow-auto bg-[#f8f7f4] px-4 py-6 sm:px-8",
          )}
        >
          {readOnly ? (
            <StoryHubReadonlyPane md={tableDraft} />
          ) : canTable ? (
            tab === "character" ? (
              <StoryCharacterTableEditor
                value={tableDraft}
                onChange={setTableDraft}
              />
            ) : tab === "script" ? (
              <StoryStoryboardTableEditor
                value={tableDraft}
                onChange={setTableDraft}
              />
            ) : (
              <StoryGenericMdTableEditor
                value={tableDraft}
                onChange={setTableDraft}
              />
            )
          ) : (
            <textarea
              className="nodrag min-h-[60vh] w-full resize-y rounded-lg border border-neutral-200 bg-white p-4 font-mono text-[13px] text-neutral-800"
              value={tableDraft}
              onChange={(e) => setTableDraft(e.target.value)}
            />
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

/** @deprecated 使用 Pro2ScriptHubEditorModal */
export const Pro2ScriptTableModal = Pro2ScriptHubEditorModal;
