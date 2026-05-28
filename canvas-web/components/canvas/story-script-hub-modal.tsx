"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X, Play, RefreshCw } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { STORY_HUB_SECTION_ORDER } from "@/lib/canvas/spawn-story-workspace";
import {
  hubDialoguePreviewMd,
  hubSectionPreviewContent,
  resolveHubSectionMd,
  resolveHubStoryboardMd,
  type HubPreviewSection,
} from "@/lib/canvas/story-hub-runtime";
import type { StoryLlmSection, StoryScriptHubNodeData } from "@/lib/canvas/story-workspace-types";
import {
  formatRevisionTime,
  type StoryTextRevision,
} from "@/lib/canvas/story-revision";
import {
  mergeOutlineRolesIntoCharacterMd,
  normalizeCharacterTableMd,
  parseOutlineBriefCharacters,
  parseStoryboardRows,
  patchStoryboardDialogue,
} from "@/lib/canvas/parse-md-tables";
import { MarkdownView } from "./markdown-view";
import {
  canEditCharacterAsTable,
  StoryCharacterTableEditor,
} from "./story-character-table-editor";
import {
  canEditStoryboardAsTable,
  StoryStoryboardTableEditor,
} from "./story-storyboard-table-editor";
import { StoryOutlineDocumentEditor } from "./story-outline-document-editor";
import { StoryHubReadonlyPane } from "./story-hub-readonly-pane";
import {
  STORY_HUB_LEFT_HINT,
  STORY_HUB_RIGHT_PREVIEW_HINT,
  STORY_HUB_TOGGLE_BTN_CLASS,
  STORY_HUB_TOGGLE_TO_RENDER_LABEL,
  STORY_HUB_TOGGLE_TO_SOURCE_LABEL,
  STORY_HUB_TOGGLE_TO_TABLE_LABEL,
} from "@/lib/canvas/story-hub-editor-chrome";
import {
  storyEditionModalOutlineBtnClass,
  storyEditionModalSaveBtnClass,
  storyEditionModalTabClass,
  type StoryEdition,
} from "@/lib/canvas/story-edition-chrome";

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
  onRunSection,
  sectionIsRunning,
  canRunLlm,
  readOnly = false,
  edition = "comic",
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
  /** 单段 LLM 生成（大纲 / 角色 / 分镜） */
  onRunSection?: (section: StoryLlmSection) => void;
  sectionIsRunning?: boolean;
  canRunLlm?: boolean;
  /** 已定稿生成工作流后只读审阅 */
  readOnly?: boolean;
  /** 影视专业版用青色 Tab/按钮；快手漫剧用橙色 */
  edition?: StoryEdition;
}) {
  const [section, setSection] = useState<HubPreviewSection>("outline");
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const [characterRawMd, setCharacterRawMd] = useState(false);
  const [storyboardRawMd, setStoryboardRawMd] = useState(false);
  const [outlineRawMd, setOutlineRawMd] = useState(false);
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
    if (section === "outline") return data.outlineMd ?? "";
    return resolveHubSectionMd(data, section);
  }, [
    section,
    data.outlineMd,
    data.characterMd,
    data.storyboardMd,
  ]);

  const resolvedStoryboardMd = useMemo(
    () => resolveHubStoryboardMd(data),
    [data.outlineMd, data.storyboardMd],
  );

  const dialogueLines = useMemo(
    () => parseStoryboardRows(resolvedStoryboardMd),
    [resolvedStoryboardMd],
  );

  const dirty = section === "dialogue" ? false : draft !== persistedMd;

  const llmSection =
    section === "outline" || section === "character" || section === "storyboard"
      ? section
      : null;
  const sectionHasContent = llmSection
    ? Boolean(resolveHubSectionMd(data, llmSection).trim())
    : false;
  const runDisabled =
    readOnly ||
    !llmSection ||
    !onRunSection ||
    !canRunLlm ||
    sectionIsRunning ||
    dirty;
  const runTitle = readOnly
    ? "已定稿，不可再生成或修改。删除下游媒体列后可重新编辑。"
    : !canRunLlm
    ? "请先在故事主题或本节点配置 LLM 模型"
    : dirty
      ? "请先保存当前编辑，再生成"
      : sectionIsRunning
        ? "本段生成中…"
        : undefined;

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
      setDraft(resolvedStoryboardMd);
      return;
    }
    if (section === "character") {
      const normalized = normalizeCharacterTableMd(persistedMd);
      setDraft(normalized);
      setCharacterRawMd(!canEditCharacterAsTable(normalized));
      return;
    }
    setDraft(persistedMd);
    if (section === "outline") {
      setOutlineRawMd(false);
    }
    if (section === "storyboard") {
      setStoryboardRawMd(!canEditStoryboardAsTable(persistedMd));
    }
  }, [open, section, persistedMd, resolvedStoryboardMd]);

  const characterTableMode =
    section === "character" && !characterRawMd && canEditCharacterAsTable(draft || persistedMd);

  const storyboardTableMode =
    section === "storyboard" &&
    !storyboardRawMd &&
    canEditStoryboardAsTable(draft || persistedMd);

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
      onSaveCharacter(normalizeCharacterTableMd(draft));
    } else if (section === "storyboard") {
      onSaveStoryboard(draft);
    }
    setSavedHint(true);
    window.setTimeout(() => setSavedHint(false), 2000);
  };

  const editMd = draft || persistedMd;

  const previewMd =
    section === "dialogue"
      ? hubDialoguePreviewMd(resolvedStoryboardMd)
      : editMd.trim()
        ? editMd
        : hubSectionPreviewContent(data, section);

  const editRows = useMemo(() => {
    if (section === "dialogue") return 32;
    const fromDraft = textareaRows(editMd);
    const fromPreview = textareaRows(previewMd);
    return Math.max(fromDraft, fromPreview);
  }, [section, editMd, previewMd]);

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
      ? { minHeight: Math.min(previewBodyH, 2400) }
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
        <p className="shrink-0 text-sm font-medium text-white">
          {readOnly ? "故事大纲 · 已定稿（只读）" : "故事大纲 · 审阅与保存"}
        </p>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-1">
          {([...STORY_HUB_SECTION_ORDER, "dialogue"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={storyEditionModalTabClass(edition, section === key)}
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
        {section !== "dialogue" && !readOnly ? (
          <>
            <button
              type="button"
              disabled={runDisabled}
              title={runTitle}
              className={storyEditionModalOutlineBtnClass(edition)}
              onClick={() => llmSection && onRunSection?.(llmSection)}
            >
              {sectionIsRunning ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" /> 生成中…
                </>
              ) : sectionHasContent ? (
                <>
                  <RefreshCw className="size-3.5" /> 重新生成
                </>
              ) : (
                <>
                  <Play className="size-3.5" /> 生成
                </>
              )}
            </button>
            <button
              type="button"
              disabled={!dirty}
              className={storyEditionModalSaveBtnClass(edition)}
              onClick={saveCurrent}
            >
              <Save className="size-3.5" />
              保存
            </button>
          </>
        ) : readOnly ? (
          <span className="shrink-0 text-[11px] text-white/50">
            删除本套媒体列后可重新编辑并定稿
          </span>
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
          <div className="flex min-h-full min-w-0 flex-col overflow-hidden border-r border-neutral-200">
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">
                {readOnly ? "只读" : "编辑"}
                {section === "dialogue" ? " · 对白" : ` · ${TAB_LABEL[section]}`}
              </p>
              {section === "character" ? (
                <p className="text-[10px] text-neutral-500">
                  {readOnly
                    ? STORY_HUB_LEFT_HINT.readOnlyTable
                    : STORY_HUB_LEFT_HINT.character}
                </p>
              ) : section === "storyboard" ? (
                <p className="text-[10px] text-neutral-500">
                  {readOnly
                    ? STORY_HUB_LEFT_HINT.readOnlyTable
                    : STORY_HUB_LEFT_HINT.storyboard}
                </p>
              ) : section === "outline" ? (
                <p className="text-[10px] text-neutral-500">
                  {readOnly
                    ? STORY_HUB_LEFT_HINT.readOnlyOutline
                    : STORY_HUB_LEFT_HINT.outline}
                </p>
              ) : section !== "dialogue" ? (
                <p className="text-[10px] text-neutral-500">
                  {STORY_HUB_LEFT_HINT.sourceOnly}
                </p>
              ) : null}
            </div>
            <div className={`flex min-h-0 flex-1 flex-col ${DOC_PAD}`}>
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
                          readOnly={readOnly}
                          onChange={(e) => {
                            if (readOnly) return;
                            const next = patchStoryboardDialogue(
                              resolvedStoryboardMd,
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
              ) : section === "character" ? (
                <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
                  {!readOnly ? (
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
                      className={STORY_HUB_TOGGLE_BTN_CLASS}
                      onClick={() => setCharacterRawMd((v) => !v)}
                    >
                      {characterRawMd
                        ? STORY_HUB_TOGGLE_TO_TABLE_LABEL
                        : STORY_HUB_TOGGLE_TO_SOURCE_LABEL}
                    </button>
                    {!characterRawMd ? (
                      <span className="text-[11px] text-neutral-400">
                        定位仍为短标签时，请在本表扩写或重新生成「角色」段
                      </span>
                    ) : null}
                  </div>
                  ) : null}
                  {characterTableMode && !readOnly ? (
                    <StoryCharacterTableEditor
                      value={draft}
                      onChange={setDraft}
                    />
                  ) : readOnly && !editMd.trim() ? (
                    <p className="text-[17px] leading-[1.85] text-neutral-500">
                      尚无角色设定。点击顶栏「生成」或返回启动页「创作剧本」等待角色段跑完；若大纲已含「主要角色」表，保存大纲后会自动回落展示。
                    </p>
                  ) : readOnly ? (
                    <StoryHubReadonlyPane
                      md={normalizeCharacterTableMd(editMd)}
                    />
                  ) : (
                    <textarea
                      className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
                      style={editBodyStyle}
                      rows={editRows}
                      value={editMd}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                    />
                  )}
                </div>
              ) : section === "storyboard" ? (
                <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
                  {!readOnly ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={STORY_HUB_TOGGLE_BTN_CLASS}
                      onClick={() => setStoryboardRawMd((v) => !v)}
                    >
                      {storyboardRawMd
                        ? STORY_HUB_TOGGLE_TO_TABLE_LABEL
                        : STORY_HUB_TOGGLE_TO_SOURCE_LABEL}
                    </button>
                  </div>
                  ) : null}
                  {storyboardTableMode && !readOnly ? (
                    <StoryStoryboardTableEditor
                      value={draft}
                      onChange={setDraft}
                    />
                  ) : readOnly && !editMd.trim() ? (
                    <p className="text-[17px] leading-[1.85] text-neutral-500">
                      尚无分镜脚本。影视专业版需单独生成「分镜」段（大纲 → 角色 → 分镜顺序执行）；也可点顶栏「生成」。
                    </p>
                  ) : readOnly ? (
                    <StoryHubReadonlyPane md={editMd} />
                  ) : (
                    <textarea
                      className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
                      style={editBodyStyle}
                      rows={editRows}
                      value={editMd}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                    />
                  )}
                </div>
              ) : section === "outline" ? (
                <div className="flex min-h-0 w-full flex-1 flex-col gap-3">
                  {!readOnly ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={STORY_HUB_TOGGLE_BTN_CLASS}
                        onClick={() => setOutlineRawMd((v) => !v)}
                      >
                        {outlineRawMd
                          ? STORY_HUB_TOGGLE_TO_RENDER_LABEL
                          : STORY_HUB_TOGGLE_TO_SOURCE_LABEL}
                      </button>
                    </div>
                  ) : null}
                  {!readOnly && outlineRawMd ? (
                    <textarea
                      className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
                      style={editBodyStyle}
                      rows={editRows}
                      value={editMd}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                    />
                  ) : (
                    <StoryOutlineDocumentEditor
                      value={draft}
                      onChange={setDraft}
                      readOnly={readOnly}
                    />
                  )}
                </div>
              ) : editMd.trim() ? (
                <textarea
                  className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
                  style={editBodyStyle}
                  rows={editRows}
                  value={editMd}
                  readOnly={readOnly}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                />
              ) : (
                <p className="text-[17px] leading-[1.85] text-neutral-500">
                  {section === "character"
                    ? "尚无角色设定。点击顶栏「生成」或返回启动页「创作剧本」等待角色段跑完；若大纲已含「主要角色」表，保存大纲后会自动回落展示。"
                    : section === "storyboard"
                      ? "尚无分镜脚本。影视专业版需单独生成「分镜」段（大纲 → 角色 → 分镜顺序执行）；也可点顶栏「生成」。"
                      : "尚无内容，可先「创作剧本」或在此直接撰写后保存。"}
                </p>
              )}
            </div>
          </div>

          <div className="flex min-h-full min-w-0 flex-col overflow-hidden bg-neutral-50/80">
            <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">渲染预览</p>
              <p className="text-[10px] text-neutral-500">{STORY_HUB_RIGHT_PREVIEW_HINT}</p>
            </div>
            <div ref={previewBodyRef} className={`${DOC_PAD} min-w-0 w-full overflow-x-auto`}>
              {previewMd.trim() ? (
                <MarkdownView content={previewMd} variant="document" className="w-full" />
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
