"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  storyRefIdsFromPrompt,
  STORY_UPSTREAM_COL_WIDTH,
  type StoryRefImage,
} from "@/lib/canvas/story-ref-image";
import type { MentionableItem } from "./mentions/MentionsTextarea";
import { MentionsTextarea } from "./mentions/MentionsTextarea";
import { STORY_HINT_BODY_CLASS } from "@/lib/canvas/story-column-sync";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import type { StoryEdition } from "@/lib/canvas/story-edition-chrome";
import { storyEditionActiveRefBorderClass } from "@/lib/canvas/story-edition-chrome";
import { StoryColumnMediaPanel } from "./story-column-media-panel";

const SAVE_DEBOUNCE_MS = 600;
/** 与 story-column-layout MEDIA_COL_MIN 对齐 */
const ROW_MEDIA_MIN_H = 248;

function idsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join("\0");
  const sb = [...b].sort().join("\0");
  return sa === sb;
}

function StoryRowTitleBadge({ title }: { title: string }) {
  return (
    <span
      className="pointer-events-none absolute left-2 top-0 z-10 max-w-[min(12rem,calc(100%-1rem))] -translate-y-1/2 truncate rounded border border-emerald-400/25 bg-[#0c1424] px-1.5 py-px text-[10px] font-semibold leading-tight text-emerald-200/95 shadow-sm"
      title={title}
    >
      {title}
    </span>
  );
}

/** 上游传入图（提示词与输出之间），无列标题 */
function StoryUpstreamImageColumn({
  images,
  activeIds,
  edition = "comic",
}: {
  images: StoryRefImage[];
  activeIds: string[];
  edition?: StoryEdition;
}) {
  return (
    <div
      className="flex shrink-0 self-stretch"
      style={{ width: STORY_UPSTREAM_COL_WIDTH }}
    >
      <div
        className="flex w-full flex-col gap-1"
        style={{ minHeight: ROW_MEDIA_MIN_H }}
      >
        {images.length ? (
          images.map((ref) => {
            const active = activeIds.includes(ref.id);
            return (
              <div
                key={ref.id}
                title={ref.label}
                className={cn(
                  "relative min-h-[72px] flex-1 overflow-hidden rounded-md border-2 transition-shadow",
                  active
                    ? storyEditionActiveRefBorderClass(edition)
                    : "border-white/15",
                )}
              >
                {ref.url ? (
                  <Image
                    src={ref.url}
                    alt={ref.label}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full items-center justify-center px-1 text-center text-[8px] leading-tight text-[var(--canvas-muted)]">
                    待上游
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex h-full min-h-[72px] flex-1 items-center justify-center rounded-md border border-dashed border-white/12 bg-black/25">
            <span className="text-[8px] text-[var(--canvas-muted)]">—</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AutoGrowTextarea({
  value,
  disabled,
  rows = 3,
  placeholder,
  onChange,
  matchMediaHeight,
}: {
  value: string;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  onChange: (next: string) => void;
  /** 与右侧媒体列最小高度对齐 */
  matchMediaHeight?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const minPx = matchMediaHeight ? ROW_MEDIA_MIN_H : 0;
    el.style.height = `${Math.max(el.scrollHeight, minPx)}px`;
  }, [matchMediaHeight]);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      className={cn(
        "nodrag block w-full resize-none overflow-hidden rounded border border-white/10 bg-black/35 px-2 py-1.5 font-mono text-[10px] leading-snug text-white/90",
        matchMediaHeight && "min-h-[var(--row-media-min,248px)]",
      )}
      rows={rows}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      spellCheck={false}
      onChange={(e) => {
        onChange(e.target.value);
        syncHeight();
      }}
    />
  );
}

export type StoryColumnExtraPrompt = {
  subLabel: string;
  value: string;
  onSave: (next: string) => void;
};

/**
 * 漫剧列行：
 * - 角色：名称 | 提示词 | 输出
 * - 分镜图/视频：名称 | 提示词 | 上游图 | 输出
 */
export function StoryColumnRowCard({
  rowTitle,
  promptValue,
  mentionables,
  refImages = [],
  showUpstream,
  upstreamImages,
  disabled,
  onSavePrompt,
  extraPrompts,
  imageUrl,
  videoUrl,
  audioUrl,
  generating,
  generateDisabled,
  mediaMode,
  onGenerate,
  onGenerateVideo,
  onPreview,
  promptHint,
  mediaError,
  videoPrompt,
  videoRefLabels,
  edition = "comic",
  frameApproved,
  frameRejectedReason,
  videoBlockReason,
  onApproveFrame,
  onRejectFrame,
  belowPrompt,
}: {
  rowTitle: string;
  promptValue: string;
  /** 仅展示在输入区下方（如「镜 1」的 @ 说明），不写入 prompt */
  promptHint?: string;
  /** 传入时启用 @ 选择器（可为空列表） */
  mentionables?: MentionableItem[];
  refImages?: StoryRefImage[];
  showUpstream?: boolean;
  upstreamImages?: StoryRefImage[];
  disabled?: boolean;
  onSavePrompt: (next: string, referencedIds: string[]) => void;
  extraPrompts?: StoryColumnExtraPrompt[];
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  generating?: boolean;
  /** 未配置模型等：按钮置灰 */
  generateDisabled?: boolean;
  mediaMode?: "character" | "frame";
  onGenerate: () => void;
  onGenerateVideo?: () => void;
  onPreview?: () => void;
  /** 分镜视频生成失败时的行内提示 */
  mediaError?: string;
  /** 分镜列 hover 分镜图：展示将传给视频模型的完整提示词 */
  videoPrompt?: string;
  videoRefLabels?: string[];
  edition?: StoryEdition;
  frameApproved?: boolean;
  frameRejectedReason?: string;
  videoBlockReason?: string | null;
  onApproveFrame?: () => void;
  onRejectFrame?: () => void;
  belowPrompt?: React.ReactNode;
}) {
  const [mainDraft, setMainDraft] = useState(promptValue);
  const [mainReferencedIds, setMainReferencedIds] = useState<string[]>([]);
  const [extraDrafts, setExtraDrafts] = useState<string[]>(
    () => extraPrompts?.map((e) => e.value) ?? [],
  );

  const savedRefIds = useMemo(
    () => storyRefIdsFromPrompt(promptValue),
    [promptValue],
  );

  useEffect(() => {
    setMainDraft(promptValue);
    setMainReferencedIds(savedRefIds);
  }, [promptValue, savedRefIds]);

  useEffect(() => {
    setExtraDrafts(extraPrompts?.map((e) => e.value) ?? []);
  }, [extraPrompts]);

  const activeRefIds = useMemo(
    () => storyRefIdsFromPrompt(mainDraft),
    [mainDraft],
  );

  const useMentions = mentionables != null;

  const mainDirty =
    mainDraft.trim() !== promptValue.trim() ||
    !idsEqual(mainReferencedIds, savedRefIds);

  useEffect(() => {
    if (!mainDirty || disabled) return;
    const t = window.setTimeout(() => {
      onSavePrompt(mainDraft, mainReferencedIds);
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [
    mainDraft,
    mainReferencedIds,
    mainDirty,
    disabled,
    onSavePrompt,
  ]);

  useEffect(() => {
    if (!extraPrompts?.length || disabled) return;
    const timers = extraPrompts.map((extra, i) => {
      const draft = extraDrafts[i] ?? extra.value;
      if (draft.trim() === extra.value.trim()) return null;
      return window.setTimeout(() => extra.onSave(draft), SAVE_DEBOUNCE_MS);
    });
    return () => {
      timers.forEach((t) => {
        if (t != null) window.clearTimeout(t);
      });
    };
  }, [extraDrafts, extraPrompts, disabled]);

  return (
    <div
      className="relative rounded-lg border border-white/10 bg-black/25 px-2 py-2"
      style={
        {
          ["--row-media-min" as string]: `${ROW_MEDIA_MIN_H}px`,
        } as React.CSSProperties
      }
    >
      <StoryRowTitleBadge title={rowTitle} />
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {useMentions ? (
            <MentionsTextarea
              value={mainDraft}
              mentionables={mentionables ?? []}
              disabled={disabled}
              rows={3}
              placeholder="场景、镜头描述；输入 @ 引用角色三视图"
              wrapperClassName="nodrag w-full min-w-0 min-h-[var(--row-media-min,248px)]"
              className={`${RF_NODE_SCROLL} h-full min-h-[var(--row-media-min,248px)] w-full resize-none overflow-hidden rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-snug text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`}
              onChange={(next, referencedIds) => {
                setMainDraft(next);
                setMainReferencedIds(referencedIds);
              }}
            />
          ) : (
            <AutoGrowTextarea
              value={mainDraft}
              disabled={disabled}
              matchMediaHeight
              onChange={setMainDraft}
            />
          )}
          {promptHint ? (
            <p className={STORY_HINT_BODY_CLASS}>{promptHint}</p>
          ) : null}
          {belowPrompt}
          {extraPrompts?.map((extra, i) => (
            <div key={extra.subLabel} className="space-y-0.5">
              <p className="text-[9px] text-[var(--canvas-muted)]">
                {extra.subLabel}
              </p>
              <AutoGrowTextarea
                rows={2}
                value={extraDrafts[i] ?? extra.value}
                disabled={disabled}
                onChange={(next) => {
                  setExtraDrafts((prev) => {
                    const copy = [...prev];
                    copy[i] = next;
                    return copy;
                  });
                }}
              />
            </div>
          ))}
        </div>
        {showUpstream ? (
          <StoryUpstreamImageColumn
            images={upstreamImages ?? refImages}
            activeIds={activeRefIds}
            edition={edition}
          />
        ) : null}
        <StoryColumnMediaPanel
          imageUrl={imageUrl}
          videoUrl={videoUrl}
          audioUrl={audioUrl}
          generating={generating}
          generateDisabled={generateDisabled}
          mediaMode={mediaMode}
          onGenerate={onGenerate}
          onGenerateVideo={onGenerateVideo}
          onPreview={onPreview}
          errorMessage={mediaError}
          videoPrompt={videoPrompt}
          videoRefLabels={videoRefLabels}
          edition={edition}
          frameApproved={frameApproved}
          frameRejectedReason={frameRejectedReason}
          videoBlockReason={videoBlockReason}
          onApproveFrame={onApproveFrame}
          onRejectFrame={onRejectFrame}
        />
      </div>
    </div>
  );
}
