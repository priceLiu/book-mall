"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { CANVAS_SEMANTIC_STATUS_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import { storyThemePromptDisplayMd } from "@/lib/canvas/story-theme-prompt-display";
import {
  STORY_THEME_SYSTEM_PROMPT_TEMPLATES,
  applyThemeToStorySystemPrompt,
  extractThemeFromStorySystemPrompt,
  isLegacyStoryPackSystemPrompt,
  storyThemeSystemPromptForTemplate,
} from "@/lib/canvas/story-prompts";
import {
  storyEditionModalSaveBtnClass,
  storyEditionModalTabClass,
} from "@/lib/canvas/story-edition-chrome";
import { isLegacyStoryProDirectorPrompt } from "@/lib/canvas/story-pro-script-pack";
import { storyProThemeSystemPromptForTemplate } from "@/lib/canvas/story-pro-theme-templates";
import { prepareMarkdownForPreview } from "@/lib/canvas/parse-md-tables";
import { StoryHubReadonlyPane } from "./story-hub-readonly-pane";
import { StoryOutlineDocumentEditor } from "./story-outline-document-editor";
import { MarkdownView } from "./markdown-view";
import type { MentionableItem } from "./mentions/MentionsTextarea";
import { MentionsTextarea } from "./mentions/MentionsTextarea";

const DOC_PAD = "px-10 py-12 sm:px-14 sm:py-16";
const DOC_TEXT =
  "w-full resize-none border-0 bg-transparent font-sans text-[17px] leading-[1.85] text-neutral-800 shadow-none focus:outline-none focus:ring-0";

export type StoryThemePromptTemplate = {
  id: string;
  label: string;
  description: string;
  content: string;
};

export type StoryThemePromptTab = string | "custom";

function textareaRows(text: string): number {
  const lines = text.split("\n").length;
  return Math.max(28, lines + 10);
}

function resolveSavePayload(
  tab: StoryThemePromptTab,
  draft: string,
  templates: readonly StoryThemePromptTemplate[],
): {
  systemPrompt: string;
  systemPromptTemplateId?: string;
} {
  if (tab === "custom") {
    return { systemPrompt: draft, systemPromptTemplateId: undefined };
  }
  const tpl = templates.find((t) => t.id === tab);
  const matches = tpl && draft.trim() === tpl.content.trim();
  return {
    systemPrompt: draft,
    systemPromptTemplateId: matches ? tab : undefined,
  };
}

/** 故事主题 · 系统提示词审阅弹层（顶栏选模板 · 左编辑 · 右预览） */
export function StoryThemePromptModal({
  open,
  initialTab,
  onClose,
  value,
  templateId,
  templates = STORY_THEME_SYSTEM_PROMPT_TEMPLATES,
  dialogTitle = "故事主题 · 系统提示词",
  onSave,
  readOnly,
  mentionables,
  editHint,
  proDirectorPack = false,
}: {
  open: boolean;
  /** 打开时定位到的 Tab（与节点当前模板一致） */
  initialTab?: StoryThemePromptTab;
  onClose: () => void;
  value: string;
  templateId?: string;
  templates?: readonly StoryThemePromptTemplate[];
  dialogTitle?: string;
  onSave: (next: {
    systemPrompt: string;
    systemPromptTemplateId?: string;
  }) => void;
  readOnly?: boolean;
  /** 非空时左侧用 @ 富文本编辑器（如引用上传剧本） */
  mentionables?: MentionableItem[];
  editHint?: string;
  /** 影视专业版：启用导演模板陈旧检测与「应用最新模板」 */
  proDirectorPack?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<StoryThemePromptTab>("custom");
  const [draft, setDraft] = useState(value);
  const [mounted, setMounted] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const [previewBodyH, setPreviewBodyH] = useState<number | null>(null);

  const previewMd = useMemo(
    () => prepareMarkdownForPreview(storyThemePromptDisplayMd(draft)),
    [draft],
  );

  const linkedTemplate = useMemo(
    () =>
      templateId
        ? templates.find((t) => t.id === templateId)
        : undefined,
    [templateId, templates],
  );

  const storedTemplateStale = useMemo(() => {
    if (!linkedTemplate) return false;
    return value.trim() !== linkedTemplate.content.trim();
  }, [linkedTemplate, value]);

  const legacyCustomPrompt = useMemo(() => {
    if (proDirectorPack) {
      return (
        isLegacyStoryProDirectorPrompt(value) ||
        (templateId === "director-from-script" && storedTemplateStale)
      );
    }
    return !templateId && isLegacyStoryPackSystemPrompt(value);
  }, [proDirectorPack, templateId, value, storedTemplateStale]);

  const applyLatestTemplate = () => {
    if (proDirectorPack) {
      const id = "director-from-script";
      setActiveTab(id);
      setDraft(storyProThemeSystemPromptForTemplate(id));
      return;
    }
    const id = templateId ?? "full-pack-detailed";
    const theme = extractThemeFromStorySystemPrompt(value || draft);
    const content = applyThemeToStorySystemPrompt(
      storyThemeSystemPromptForTemplate(id as "full-pack-detailed"),
      theme,
    );
    setActiveTab(id);
    setDraft(content);
  };

  const dirty = useMemo(() => {
    const next = resolveSavePayload(activeTab, draft, templates);
    return (
      next.systemPrompt !== value ||
      next.systemPromptTemplateId !== templateId
    );
  }, [activeTab, draft, value, templateId, templates]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    setActiveTab(initialTab ?? templateId ?? "custom");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose intentionally omitted
  }, [open, initialTab, templateId]);

  useEffect(() => {
    if (!open) return;
    if (activeTab === "custom") {
      setDraft(value);
      return;
    }
    const tpl = templates.find((t) => t.id === activeTab);
    setDraft(tpl?.content ?? value);
  }, [open, activeTab, value, templates]);

  useEffect(() => {
    if (!open) return;
    const el = previewBodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setPreviewBodyH(el.scrollHeight);
    });
    ro.observe(el);
    setPreviewBodyH(el.scrollHeight);
    return () => ro.disconnect();
  }, [open, previewMd]);

  const editRows = textareaRows(draft);
  const editBodyStyle =
    previewBodyH != null && previewBodyH > 0
      ? { minHeight: previewBodyH }
      : undefined;

  const save = () => {
    if (readOnly) return;
    onSave(resolveSavePayload(activeTab, draft, templates));
    setSavedHint(true);
    window.setTimeout(() => onClose(), 320);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-neutral-600/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={dialogTitle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="nodrag flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-neutral-900/85 px-4 py-3">
        <p className="shrink-0 text-sm font-medium text-white">{dialogTitle}</p>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-1">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              title={tpl.description}
              disabled={readOnly}
              onClick={() => setActiveTab(tpl.id)}
              className={storyEditionModalTabClass(
                proDirectorPack ? "pro" : "comic",
                activeTab === tpl.id,
              )}
            >
              {tpl.label}
            </button>
          ))}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setActiveTab("custom")}
            className={storyEditionModalTabClass(
              proDirectorPack ? "pro" : "comic",
              activeTab === "custom",
            )}
          >
            自定义
          </button>
        </div>
        <span className="shrink-0 text-[11px] text-white/50">
          {savedHint ? (
            <span className={CANVAS_SEMANTIC_STATUS_CLASS}>已保存</span>
          ) : dirty ? (
            <span className={CANVAS_SEMANTIC_STATUS_CLASS}>未保存</span>
          ) : null}
        </span>
        {!readOnly ? (
          <button
            type="button"
            disabled={!dirty}
            className={storyEditionModalSaveBtnClass(proDirectorPack ? "pro" : "comic")}
            onClick={save}
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

      {!readOnly && (storedTemplateStale || legacyCustomPrompt) ? (
        <div className="nodrag flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-400/30 bg-amber-950/90 px-4 py-2 text-[12px] text-amber-100">
          <span>
            {proDirectorPack ? (
              <>
                导演模板已升级：须含{" "}
                <strong className="font-medium">## 角色视觉辞典</strong> 与{" "}
                <strong className="font-medium">## 分镜脚本</strong>（含对白列），
                保存后「解析剧本」才能正确拆分至故事剧本 / 下游列。
              </>
            ) : (
              <>
                内置模板已升级：须含{" "}
                <strong className="font-medium">## 角色设定</strong> 与{" "}
                <strong className="font-medium">## 分镜脚本</strong> GFM
                表，保存后「创作剧本」才会自动填入分镜/对白 Tab。
              </>
            )}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-medium text-black hover:bg-amber-300"
            onClick={applyLatestTemplate}
          >
            应用最新模板并编辑
          </button>
        </div>
      ) : null}

      <div
        className={`${RF_NODE_SCROLL} nodrag min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto grid w-full max-w-[min(96vw,1400px)] grid-cols-2 items-stretch overflow-hidden rounded-sm bg-white shadow-2xl">
          <div className="flex min-h-full min-w-0 flex-col overflow-hidden border-r border-neutral-200">
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">编辑</p>
              <p className="text-[10px] text-neutral-500">
                {editHint ??
                  (activeTab === "custom"
                    ? "自定义文案 · 与右侧预览同步"
                    : `${templates.find((t) => t.id === activeTab)?.label ?? "模板"} · 修改后保存将视为自定义`)}
              </p>
            </div>
            <div
              className={`flex min-h-0 flex-1 flex-col ${DOC_PAD}`}
              style={editBodyStyle}
            >
              {readOnly ? (
                <pre className="whitespace-pre-wrap font-sans text-[17px] leading-[1.85] text-neutral-800">
                  {draft || "（空）"}
                </pre>
              ) : proDirectorPack ? (
                <StoryOutlineDocumentEditor
                  value={draft}
                  onChange={setDraft}
                  mentionables={mentionables}
                  editHint="与右侧预览同款排版：表格点格编辑；正文点段落后可改 Markdown（支持 @ 引用上传剧本）"
                />
              ) : mentionables?.length ? (
                <MentionsTextarea
                  className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
                  style={editBodyStyle}
                  value={draft}
                  mentionables={mentionables}
                  onChange={(next) => setDraft(next)}
                  placeholder="输入 @ 引用上传剧本…"
                />
              ) : (
                <textarea
                  className={`nodrag ${DOC_TEXT} block min-h-0 w-full flex-1`}
                  style={editBodyStyle}
                  rows={editRows}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  placeholder="你是一名编剧…&#10;&#10;【主题】&#10;…"
                />
              )}
            </div>
          </div>

          <div className="flex min-h-full min-w-0 flex-col overflow-hidden bg-neutral-50/80">
            <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">渲染预览</p>
              <p className="text-[10px] text-neutral-500">
                GFM 表格与故事剧本审阅一致 · 随左侧实时更新
              </p>
            </div>
            <div
              ref={previewBodyRef}
              className={`${DOC_PAD} min-w-0 w-full overflow-x-auto`}
            >
              {previewMd.trim() ? (
                <StoryHubReadonlyPane md={previewMd} />
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
