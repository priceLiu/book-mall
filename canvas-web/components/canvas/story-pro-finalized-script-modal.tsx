"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react";

import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import {
  buildStoryProFinalizedScriptDocumentMd,
  formatFinalizedScriptMetaLine,
  formatFinalizedScriptTitle,
  formatFinalizedScriptVersionLabel,
} from "@/lib/canvas/story-pro-finalized-script";
import type { StoryProFinalizedScriptSnapshot } from "@/lib/canvas/story-pro-workspace-types";
import { formatRevisionTime } from "@/lib/canvas/story-revision";
import { MarkdownView } from "./markdown-view";

const DOC_PAD = "px-10 py-12 sm:px-14 sm:py-16";

type ViewEntry = {
  theme: string;
  version: number;
  finalizedAt: string;
  documentMd: string;
};

function snapshotToView(s: StoryProFinalizedScriptSnapshot): ViewEntry {
  return {
    theme: s.theme,
    version: s.version,
    finalizedAt: s.finalizedAt,
    documentMd: buildStoryProFinalizedScriptDocumentMd(
      s.outlineMd,
      s.characterMd,
      s.storyboardMd,
    ),
  };
}

/** 故事定稿剧本 · 只读 Word 式历史（主题 + 版本号） */
export function StoryProFinalizedScriptModal({
  open,
  onClose,
  history,
  fallbackView,
  initialVersionIndex = 0,
}: {
  open: boolean;
  onClose: () => void;
  history?: StoryProFinalizedScriptSnapshot[];
  /** 无历史快照时从当前 hub 回落 */
  fallbackView?: ViewEntry | null;
  /** 打开时定位到 history 中的某一版（0 = 最新） */
  initialVersionIndex?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const [versionIndex, setVersionIndex] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => {
    const fromHist = (history ?? []).map(snapshotToView);
    if (fromHist.length) return fromHist;
    if (fallbackView?.documentMd.trim()) return [fallbackView];
    return [];
  }, [history, fallbackView]);

  const active = entries[versionIndex] ?? entries[0];
  const hasMultiple = entries.length > 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const max = Math.max(0, entries.length - 1);
    setVersionIndex(Math.min(Math.max(0, initialVersionIndex), max));
  }, [open, initialVersionIndex, entries.length]);

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

  if (!mounted || !open || !active) return null;

  const title = formatFinalizedScriptTitle(active.theme);
  const verLabel = formatFinalizedScriptVersionLabel(active.version);
  const finalizedLabel = formatRevisionTime(active.finalizedAt);

  return createPortal(
    <div
      className="fixed inset-0 z-[1100] flex h-[100dvh] w-screen flex-col bg-[#0a0f14]/92 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="定稿剧本 · 历史"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="nodrag flex shrink-0 items-center gap-3 border-b border-cyan-400/20 bg-gradient-to-r from-cyan-950/50 via-[#0b1220] to-cyan-950/30 px-4 py-3">
        <BookOpen className="size-4 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-cyan-50">
            定稿剧本 · 历史记录
          </p>
          <p className="truncate text-[11px] text-cyan-200/55">
            {formatFinalizedScriptMetaLine(
              active.theme,
              active.version,
              active.finalizedAt,
            )}
          </p>
        </div>
        {hasMultiple ? (
          <div className="flex shrink-0 items-center gap-1 rounded-md border border-cyan-400/25 bg-black/30 px-1">
            <button
              type="button"
              className="rounded p-1 text-cyan-200/80 hover:bg-cyan-500/15 disabled:opacity-30"
              disabled={versionIndex >= entries.length - 1}
              aria-label="更早版本"
              onClick={() =>
                setVersionIndex((i) => Math.min(i + 1, entries.length - 1))
              }
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[4.5rem] text-center text-[11px] tabular-nums text-cyan-100/90">
              {verLabel} / {entries.length}
            </span>
            <button
              type="button"
              className="rounded p-1 text-cyan-200/80 hover:bg-cyan-500/15 disabled:opacity-30"
              disabled={versionIndex <= 0}
              aria-label="更新版本"
              onClick={() => setVersionIndex((i) => Math.max(i - 1, 0))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-cyan-400/20 p-1.5 text-cyan-100/70 hover:bg-cyan-500/10"
          aria-label="关闭"
        >
          <X className="size-5" />
        </button>
      </header>

      <div
        ref={bodyRef}
        className={`${RF_NODE_SCROLL} nodrag min-h-0 flex-1 overflow-y-auto bg-neutral-200/95`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`mx-auto max-w-[min(96vw,900px)] ${DOC_PAD}`}>
          <div className="mb-10 border-b border-neutral-300 pb-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
              影视专业版 · 故事定稿
            </p>
            <h1 className="mt-2 text-[26px] font-bold leading-tight text-neutral-900">
              {title}
            </h1>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px] text-neutral-600">
              <dt className="font-medium text-neutral-500">主题</dt>
              <dd>{active.theme.trim() || "—"}</dd>
              <dt className="font-medium text-neutral-500">版本号</dt>
              <dd className="font-mono text-neutral-800">{verLabel}</dd>
              <dt className="font-medium text-neutral-500">定稿时间</dt>
              <dd>{finalizedLabel}</dd>
            </dl>
            <p className="mt-4 text-[12px] text-amber-800/90">
              本文档为定稿快照，仅供查阅，不可编辑。
            </p>
          </div>
          {active.documentMd.trim() ? (
            <MarkdownView content={active.documentMd} variant="document" />
          ) : (
            <p className="text-neutral-500">（定稿时剧本内容为空）</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
