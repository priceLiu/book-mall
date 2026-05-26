"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import { storyThemePromptDisplayMd } from "@/lib/canvas/story-theme-prompt-display";
import {
  STORY_THEME_SYSTEM_PROMPT_TEMPLATES,
  type StoryThemeSystemPromptTemplateId,
} from "@/lib/canvas/story-prompts";
import { MarkdownView } from "./markdown-view";

const DOC_PAD = "px-10 py-12 sm:px-14 sm:py-16";
const DOC_TEXT =
  "w-full resize-none border-0 bg-transparent font-sans text-[17px] leading-[1.85] text-neutral-800 shadow-none focus:outline-none focus:ring-0";

export type StoryThemePromptTab = StoryThemeSystemPromptTemplateId | "custom";

function textareaRows(text: string): number {
  const lines = text.split("\n").length;
  return Math.max(28, lines + 10);
}

function resolveSavePayload(
  tab: StoryThemePromptTab,
  draft: string,
): {
  systemPrompt: string;
  systemPromptTemplateId?: StoryThemeSystemPromptTemplateId;
} {
  if (tab === "custom") {
    return { systemPrompt: draft, systemPromptTemplateId: undefined };
  }
  const tpl = STORY_THEME_SYSTEM_PROMPT_TEMPLATES.find((t) => t.id === tab);
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
  onSave,
  readOnly,
}: {
  open: boolean;
  /** 打开时定位到的 Tab（与节点当前模板一致） */
  initialTab?: StoryThemePromptTab;
  onClose: () => void;
  value: string;
  templateId?: StoryThemeSystemPromptTemplateId;
  onSave: (next: {
    systemPrompt: string;
    systemPromptTemplateId?: StoryThemeSystemPromptTemplateId;
  }) => void;
  readOnly?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<StoryThemePromptTab>("custom");
  const [draft, setDraft] = useState(value);
  const [mounted, setMounted] = useState(false);
  const [savedHint, setSavedHint] = useState(false);
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const [previewBodyH, setPreviewBodyH] = useState<number | null>(null);

  const previewMd = useMemo(() => storyThemePromptDisplayMd(draft), [draft]);

  const dirty = useMemo(() => {
    const next = resolveSavePayload(activeTab, draft);
    return (
      next.systemPrompt !== value ||
      next.systemPromptTemplateId !== templateId
    );
  }, [activeTab, draft, value, templateId]);

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
    const tpl = STORY_THEME_SYSTEM_PROMPT_TEMPLATES.find(
      (t) => t.id === activeTab,
    );
    setDraft(tpl?.content ?? value);
  }, [open, activeTab, value]);

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
    onSave(resolveSavePayload(activeTab, draft));
    setSavedHint(true);
    window.setTimeout(() => onClose(), 320);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-neutral-600/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="故事主题 · 系统提示词"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="nodrag flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-neutral-900/85 px-4 py-3">
        <p className="shrink-0 text-sm font-medium text-white">
          故事主题 · 系统提示词
        </p>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-1">
          {STORY_THEME_SYSTEM_PROMPT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              title={tpl.description}
              disabled={readOnly}
              onClick={() => setActiveTab(tpl.id)}
              className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition disabled:opacity-50 ${
                activeTab === tpl.id
                  ? "bg-[#fb923c]/25 text-[#fdba74]"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tpl.label}
            </button>
          ))}
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setActiveTab("custom")}
            className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition disabled:opacity-50 ${
              activeTab === "custom"
                ? "bg-[#fb923c]/25 text-[#fdba74]"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            自定义
          </button>
        </div>
        <span className="shrink-0 text-[11px] text-white/50">
          {savedHint ? (
            <span className="text-emerald-300">已保存</span>
          ) : dirty ? (
            <span className="text-amber-300">未保存</span>
          ) : null}
        </span>
        {!readOnly ? (
          <button
            type="button"
            disabled={!dirty}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#fb923c] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
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

      <div
        className={`${RF_NODE_SCROLL} nodrag min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto grid w-full max-w-[min(96vw,1400px)] grid-cols-2 items-stretch overflow-hidden rounded-sm bg-white shadow-2xl">
          <div className="flex min-h-full flex-col border-r border-neutral-200">
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-100 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">编辑</p>
              <p className="text-[10px] text-neutral-500">
                {activeTab === "custom"
                  ? "自定义文案 · 与右侧预览同步"
                  : `${STORY_THEME_SYSTEM_PROMPT_TEMPLATES.find((t) => t.id === activeTab)?.label ?? "模板"} · 修改后保存将视为自定义`}
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

          <div className="flex min-h-full flex-col bg-neutral-50/80">
            <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-100/90 px-4 py-2.5">
              <p className="text-xs font-medium text-neutral-600">预览</p>
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
