"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { STORY_HUB_SECTION_ORDER } from "@/lib/canvas/spawn-story-workspace";
import {
  hubDialoguePreviewMd,
  hubSectionPreviewContent,
  outlineDisplayMd,
  type HubPreviewSection,
} from "@/lib/canvas/story-hub-runtime";
import type { StoryScriptHubNodeData } from "@/lib/canvas/story-workspace-types";
import {
  formatRevisionTime,
  type StoryTextRevision,
} from "@/lib/canvas/story-revision";
import {
  mergeOutlineRolesIntoCharacterMd,
  parseOutlineBriefCharacters,
  parseStoryboardRows,
  patchStoryboardDialogue,
} from "@/lib/canvas/parse-md-tables";
import { MarkdownView } from "./markdown-view";
import {
  canEditCharacterAsTable,
  StoryCharacterTableEditor,
} from "./story-character-table-editor";

const TAB_LABEL: Record<HubPreviewSection, string> = {
  outline: "故事大纲",
  character: "角色设定",
  storyboard: "分镜脚本",
  dialogue: "对白",
};

/** 与原稿 MarkdownView document 一致的正文排版 */
const DOC_PAD = "px-10 py-12 sm:px-14 sm:py-16";
const DOC_TEXT =
  "w-full resize-none border-0 bg-transparent font-sans text-[17px] leading-[1.85] text-neutral-800 shadow-none focus:outline-none focus:ring-0";

function textareaRows(text: string): number {
  const lines = text.split("\n").length;
  const tableLines = (text.match(/\|/g) ?? []).length > 4 ? 8 : 0;
  return Math.max(32, lines + tableLines + 12);
}

export function StoryScriptHubModal({
  open,
  initialSection = "outline",
  onClose,
  data,
  onSaveOutline,
  onSaveCharacter,
  onSaveStoryboard,
  onSaveStoryboardMd,
}: {
  open: boolean;
  /** 打开时定位到的 Tab（与节点预览当前段一致） */
  initialSection?: HubPreviewSection;
  onClose: () => void;
  data: StoryScriptHubNodeData;
  onSaveOutline: (md: string) => void;
  onSaveCharacter: (md: string) => void;
  onSaveStoryboard: (md: string) => void;
  onSaveStoryboardMd: (md: string) => void;
}) {
  const [section, setSection] = useState<HubPreviewSection>("outline");
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [characterRawMd, setCharacterRawMd] = useState(false);
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const [previewBodyH, setPreviewBodyH] = useState<number | null>(null);

  const outlineBrief = useMemo(
    () => parseOutlineBriefCharacters(data.outlineMd ?? ""),
    [data.outlineMd],
  );

  const sectionHistory = useMemo((): StoryTextRevision[] => {
    if (section === "outline") return data.outlineHistory ?? [];
    if (section === "character") return data.characterHistory ?? [];
    if (section === "storyboard") return data.storyboardHistory ?? [];
    return data.storyboardHistory ?? [];
  }, [section, data.outlineHistory, data.characterHistory, data.storyboardHistory]);

  const persistedMd = useMemo(() => {
    if (section === "outline") return outlineDisplayMd(data.outlineMd ?? "");
    if (section === "character") return data.characterMd ?? "";
    if (section === "storyboard") return data.storyboardMd ?? "";
    return data.storyboardMd ?? "";
  }, [
    section,
    data.outlineMd,
    data.characterMd,
    data.storyboardMd,
  ]);

  const dialogueLines = useMemo(
    () => parseStoryboardRows(data.storyboardMd ?? ""),
    [data.storyboardMd],
  );

  const dirty = section === "dialogue" ? false : draft !== persistedMd;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    setSection(initialSection);
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
    // 仅随 open 开关重置 Tab；勿依赖 onClose（父组件内联函数会导致每次渲染跳回「故事大纲」）
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose intentionally omitted
  }, [open, initialSection]);

  useEffect(() => {
    if (!open) return;
    if (section === "dialogue") {
      setDraft(data.storyboardMd ?? "");
      return;
    }
    setDraft(persistedMd);
    if (section === "character") {
      setCharacterRawMd(!canEditCharacterAsTable(persistedMd));
    }
  }, [open, section, persistedMd, data.storyboardMd]);

  const characterTableMode =
    section === "character" && !characterRawMd && canEditCharacterAsTable(draft || persistedMd);

  const mergeOutlineRoles = () => {
    if (!outlineBrief.length) return;
    setDraft((prev) =>
      mergeOutlineRolesIntoCharacterMd(prev || persistedMd, outlineBrief),
    );
    setCharacterRawMd(false);
  };

  const saveCurrent = () => {
    if (section === "outline") {
      onSaveOutline(draft);
    } else if (section === "character") {
      onSaveCharacter(draft);
    } else if (section === "storyboard") {
      onSaveStoryboard(draft);
    }
    setSavedHint(true);
    window.setTimeout(() => setSavedHint(false), 2000);
  };

  const previewMd =
    section === "dialogue"
      ? hubDialoguePreviewMd(data.storyboardMd ?? "")
      : draft.trim() || persistedMd.trim()
        ? draft
        : hubSectionPreviewContent(data, section);

  const editRows = useMemo(() => {
    if (section === "dialogue") return 32;
    const fromDraft = textareaRows(draft || persistedMd);
    const fromPreview = textareaRows(previewMd);
    return Math.max(fromDraft, fromPreview);
  }, [section, draft, persistedMd, previewMd]);

  useLayoutEffect(() => {
    if (!open) {
      setPreviewBodyH(null);
      return;
    }
    const el = previewBodyRef.current;
    if (!el) return;
    const measure = () => setPreviewBodyH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, section, previewMd, draft, dialogueLines.length]);

  const editBodyStyle =
    previewBodyH != null && previewBodyH > 0
      ? { minHeight: previewBodyH }
      : undefined;

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-neutral-600/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="故事大纲 · 审阅"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="nodrag flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-neutral-900/85 px-4 py-3">
        <p className="shrink-0 text-sm font-medium text-white">故事大纲 · 审阅与保存</p>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-1">
          {([...STORY_HUB_SECTION_ORDER, "dialogue"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition ${
                section === key
                  ? "bg-[#fb923c]/25 text-[#fdba74]"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {TAB_LABEL[key]}
            </button>
          ))}
        </div>
        {section !== "dialogue" && sectionHistory.length > 0 ? (
          <details className="relative text-[11px] text-white/70">
            <summary className="cursor-pointer list-none rounded-md border border-white/15 px-2 py-1.5 hover:bg-white/10">
              历史 {sectionHistory.length}
            </summary>
            <ul className="absolute right-0 z-20 mt-1 max-h-40 min-w-[160px] overflow-y-auto rounded-md border border-white/15 bg-neutral-900 py-1 shadow-lg">
              {sectionHistory.map((rev, i) => (
                <li key={`${rev.savedAt}-${i}`}>
                  <button
                    type="button"
                    className="w-full px-2 py-1 text-left hover:bg-white/10"
                    onClick={() => setDraft(rev.content)}
                  >
                    {formatRevisionTime(rev.savedAt)}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <span className="shrink-0 text-[11px] text-white/50">
          {savedHint ? (
            <span className="text-emerald-300">已保存</span>
          ) : dirty ? (
            <span className="text-amber-300">未保存</span>
          ) : null}
        </span>
        {section !== "dialogue" ? (
          <button
            type="button"
            disabled={!dirty}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#fb923c] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
            onClick={saveCurrent}
          >
            <Save className="size-3.5" />
            保存
          </button>
        ) : null}
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
        className={`${RF_NODE_SCROLL} nodrag min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto grid w-full max-w-[min(96vw,1400px)] grid-cols-2 items-stretch overflow-hidden rounded-sm bg-white shadow-2xl">
          <div className="flex min-h-full flex-col border-r border-neutral-200">
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">
                编辑
                {section === "dialogue" ? " · 对白" : ` · ${TAB_LABEL[section]}`}
              </p>
              {section === "character" ? (
                <p className="text-[10px] text-neutral-500">
                  左侧表格编辑 · 右侧为渲染原稿；保存后写入角色设定
                </p>
              ) : section !== "dialogue" ? (
                <p className="text-[10px] text-neutral-500">
                  与右侧原稿同字号；保存后写入正式剧本
                </p>
              ) : null}
            </div>
            <div
              className={`flex min-h-0 flex-1 flex-col ${DOC_PAD}`}
              style={editBodyStyle}
            >
              {section === "dialogue" ? (
                dialogueLines.length === 0 ? (
                  <p className="text-[17px] leading-[1.85] text-neutral-500">
                    请先在「分镜脚本」生成分镜表。
                  </p>
                ) : (
                  <div className="flex min-h-full flex-1 flex-col space-y-6">
                    {dialogueLines.map((line) => (
                      <div key={line.frameIndex}>
                        <p className="mb-2 text-[15px] font-semibold text-neutral-600">
                          镜 {line.frameIndex} · {line.scene || "场景"}
                        </p>
                        <textarea
                          className={DOC_TEXT}
                          rows={Math.max(2, Math.ceil(line.dialogue.length / 36) + 1)}
                          value={line.dialogue}
                          onChange={(e) => {
                            const next = patchStoryboardDialogue(
                              data.storyboardMd ?? "",
                              line.frameIndex,
                              e.target.value,
                            );
                            onSaveStoryboardMd(next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )
              ) : section === "character" && (draft.trim() || persistedMd.trim()) ? (
                <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {outlineBrief.length > 0 ? (
                      <button
                        type="button"
                        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] text-neutral-700 hover:bg-neutral-50"
                        onClick={mergeOutlineRoles}
                      >
                        从大纲合并定位
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[11px] text-neutral-600 hover:bg-neutral-50"
                      onClick={() => setCharacterRawMd((v) => !v)}
                    >
                      {characterRawMd ? "切换表格编辑" : "切换 Markdown 源码"}
                    </button>
                    {!characterRawMd ? (
                      <span className="text-[11px] text-neutral-400">
                        定位仍为短标签时，请在本表扩写或重新生成「角色」段
                      </span>
                    ) : null}
                  </div>
                  {characterTableMode ? (
                    <StoryCharacterTableEditor
                      value={draft}
                      onChange={setDraft}
                    />
                  ) : (
                    <textarea
                      className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
                      style={editBodyStyle}
                      rows={editRows}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                    />
                  )}
                </div>
              ) : draft.trim() || persistedMd.trim() ? (
                <textarea
                  className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
                  style={editBodyStyle}
                  rows={editRows}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                />
              ) : (
                <p className="text-[17px] leading-[1.85] text-neutral-500">
                  尚无内容，可先「创作剧本」或在此直接撰写后保存。
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-full flex-col bg-neutral-50/80">
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">原稿</p>
              <p className="text-[10px] text-neutral-500">整页滚动 · 随左侧实时更新</p>
            </div>
            <div ref={previewBodyRef} className={DOC_PAD}>
              {previewMd.trim() ? (
                <MarkdownView content={previewMd} variant="document" />
              ) : (
                <p className="text-[17px] leading-[1.85] text-neutral-500">
                  （暂无内容）
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
