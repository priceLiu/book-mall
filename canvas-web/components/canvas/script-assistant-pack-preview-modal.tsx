"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, FileInput, X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import {
  PRO_ICON_ACCENT_CLASS,
  PRO_MODAL_HEADER_CLASS,
  PRO_MODAL_SUBTITLE_CLASS,
  PRO_MODAL_TITLE_CLASS,
} from "@/lib/canvas/story-pro-node-chrome";
import {
  STORY_HUB_LEFT_HINT,
  STORY_HUB_RIGHT_PREVIEW_HINT,
} from "@/lib/canvas/story-hub-editor-chrome";
import { StoryHubReadonlyPane } from "./story-hub-readonly-pane";
import { cn } from "@/lib/utils";

const DOC_PAD = "px-10 py-12 sm:px-14 sm:py-16";

/** 剧本创作助手 · 制作包只读预览弹层（对齐故事大纲审阅 · 渲染原稿） */
export function ScriptAssistantPackPreviewModal({
  open,
  onClose,
  md,
  importAllowed,
  importBlockReason,
  onConfirmImport,
}: {
  open: boolean;
  onClose: () => void;
  md: string;
  /** 仅全新工作流可导入（见 storyProAssistantImportGate） */
  importAllowed: boolean;
  importBlockReason: string;
  onConfirmImport?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const hasContent = Boolean(md.trim());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-neutral-600/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="剧本创作助手 · 制作包预览"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className={`nodrag ${PRO_MODAL_HEADER_CLASS}`}>
        <Eye className={`size-4 shrink-0 ${PRO_ICON_ACCENT_CLASS}`} />
        <div className="min-w-0 flex-1">
          <p className={PRO_MODAL_TITLE_CLASS}>制作包预览 · 只读审阅</p>
          <p className={PRO_MODAL_SUBTITLE_CLASS}>
            {STORY_HUB_RIGHT_PREVIEW_HINT} · 关闭后可继续在助手对话中修改
          </p>
        </div>
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="关闭"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="nodrag flex min-h-0 flex-1 flex-col overflow-hidden bg-neutral-100">
        <div className="shrink-0 border-b border-neutral-200 bg-neutral-50/95 px-4 py-2 sm:px-6">
          <p className="text-[11px] text-neutral-600">
            {STORY_HUB_LEFT_HINT.readOnlyOutline.replace("已定稿只读 · ", "")}
            表格与标题按故事大纲同款排版，不可编辑。
          </p>
        </div>
        <div
          className={`${RF_NODE_SCROLL} min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-neutral-50`}
        >
          {hasContent ? (
            <div className={`${DOC_PAD} min-w-0 w-full max-w-5xl mx-auto`}>
              <StoryHubReadonlyPane md={md} />
            </div>
          ) : (
            <p className={`${DOC_PAD} text-[17px] leading-[1.85] text-neutral-500`}>
              助手尚未生成制作包正文。请关闭预览，在对话中描述需求并发送后再打开预览。
            </p>
          )}
        </div>
      </div>

      <footer className="nodrag flex shrink-0 flex-col items-center gap-2.5 border-t border-white/10 bg-neutral-900/95 px-4 py-4">
        <button
          type="button"
          disabled={!hasContent || !importAllowed}
          title={
            !hasContent
              ? "暂无制作包正文"
              : importAllowed
                ? "写入启动节点并开始全新制作工作流"
                : importBlockReason
          }
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-8 py-2.5 text-[14px] font-semibold shadow-lg transition",
            hasContent && importAllowed
              ? "border-emerald-400/55 bg-emerald-500/30 text-emerald-50 hover:bg-emerald-500/45"
              : "cursor-not-allowed border-white/15 bg-white/5 text-white/35",
          )}
          onClick={() => {
            if (!hasContent || !importAllowed || !onConfirmImport) return;
            onConfirmImport();
          }}
        >
          <FileInput className="size-4" />
          确定导入，开始制作
        </button>
        {hasContent && !importAllowed && importBlockReason ? (
          <p className="max-w-md px-2 text-center text-[11px] leading-snug text-amber-300/90">
            {importBlockReason}
          </p>
        ) : null}
        <button
          type="button"
          className="text-[12px] text-white/60 underline-offset-2 hover:text-white/85 hover:underline"
          onClick={onClose}
        >
          关闭，继续对话
        </button>
      </footer>
    </div>,
    document.body,
  );
}
