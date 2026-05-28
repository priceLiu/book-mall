"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  storyRefIdsFromPrompt,
  STORY_UPSTREAM_COL_WIDTH,
  STORY_UPSTREAM_REF_GRID_COLS,
  type StoryRefImage,
} from "@/lib/canvas/story-ref-image";
import type { MentionableItem } from "./mentions/MentionsTextarea";
import { MentionsTextarea } from "./mentions/MentionsTextarea";
import { STORY_HINT_BODY_CLASS, STORY_HINT_GOLD_CLASS } from "@/lib/canvas/story-column-sync";
import {
  STORY_FRAME_ROW_BELOW_PROMPT_H,
  STORY_FRAME_ROW_STRIP_H,
} from "@/lib/canvas/story-column-layout";
import { StoryErrorLine } from "@/components/canvas/story-status-line";
import { RF_NODE_SCROLL } from "@/lib/canvas/react-flow-classes";
import type { StoryEdition } from "@/lib/canvas/story-edition-chrome";
import {
  storyEditionActiveRefBorderClass,
  storyEditionGeneratingBorderClass,
} from "@/lib/canvas/story-edition-chrome";
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

/** 上游 @ 参考图：3 列宫格，悬停 Eye 预览、点击全屏预览 */
function StoryUpstreamImageColumn({
  images,
  activeIds,
  edition = "comic",
  stripHeight,
  onPreviewRef,
  generating = false,
}: {
  images: StoryRefImage[];
  activeIds: string[];
  edition?: StoryEdition;
  stripHeight?: number;
  onPreviewRef?: (url: string, title: string) => void;
  /** 分镜图生成中：整列扫光（无旋转圈，与改版前一致） */
  generating?: boolean;
}) {
  const h = stripHeight ?? ROW_MEDIA_MIN_H;
  return (
    <div
      className="flex shrink-0 self-start"
      style={{
        width: STORY_UPSTREAM_COL_WIDTH,
        height: h,
        minHeight: h,
      }}
    >
      <div
        className={cn(
          "relative h-full w-full overflow-y-auto overflow-x-hidden rounded-md border border-white/10 bg-black/25 p-1",
          RF_NODE_SCROLL,
          generating && storyEditionGeneratingBorderClass(edition),
        )}
      >
        {images.length ? (
          <div
            className="grid content-start items-start gap-1"
            style={{
              gridTemplateColumns: `repeat(${STORY_UPSTREAM_REF_GRID_COLS}, minmax(0, 1fr))`,
              gridAutoRows: "min-content",
            }}
          >
            {images.map((ref) => {
              const active = activeIds.includes(ref.id);
              const canPreview = Boolean(ref.url && onPreviewRef);
              return (
                <div
                  key={ref.id}
                  title={ref.label}
                  className={cn(
                    "group/ref-thumb relative aspect-square overflow-hidden rounded border bg-black/40 transition-shadow",
                    active
                      ? storyEditionActiveRefBorderClass(edition)
                      : "border-white/15",
                    canPreview && !generating && "cursor-pointer",
                  )}
                  onClick={() => {
                    if (canPreview && !generating) onPreviewRef!(ref.url!, ref.label);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canPreview) {
                      onPreviewRef!(ref.url!, ref.label);
                    }
                  }}
                  role={canPreview ? "button" : undefined}
                  tabIndex={canPreview ? 0 : undefined}
                >
                  {ref.url ? (
                    <>
                      <Image
                        src={ref.url}
                        alt={ref.label}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                      {onPreviewRef && !generating ? (
                        <span
                          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover/ref-thumb:opacity-100"
                          aria-hidden
                        >
                          <Eye className="size-4 text-white/90" />
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="flex h-full items-center justify-center px-0.5 text-center text-[7px] leading-tight text-[var(--canvas-muted)]">
                      待上游
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-[72px] items-center justify-center rounded border border-dashed border-white/12">
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
  onPreviewRef,
  promptHint,
  mediaError,
  videoPrompt,
  videoRefLabels,
  edition = "comic",
  frameApproved,
  videoBlockReason,
  onApproveFrame,
  upstreamGenerating,
  belowPrompt,
  compactFrameLayout,
  belowPromptMinHeight,
  rowBlockMinHeight,
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
  /** 上游参考图 · 点击/悬停预览 */
  onPreviewRef?: (url: string, title: string) => void;
  /** 分镜视频生成失败时的行内提示 */
  mediaError?: string;
  /** 分镜列 hover 分镜图：展示将传给视频模型的完整提示词 */
  videoPrompt?: string;
  videoRefLabels?: string[];
  edition?: StoryEdition;
  frameApproved?: boolean;
  videoBlockReason?: string | null;
  onApproveFrame?: () => void;
  /** 分镜图生成中时参考图宫格 shimmer（默认与 generating 相同） */
  upstreamGenerating?: boolean;
  belowPrompt?: React.ReactNode;
  /** 分镜列：文案/参考/输出同高横条，元信息沉底 */
  compactFrameLayout?: boolean;
  belowPromptMinHeight?: number;
  /** 与分镜视频列同行块对齐（见 storyFrameVideoRowBlockH） */
  rowBlockMinHeight?: number;
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

  const promptMinH = compactFrameLayout
    ? STORY_FRAME_ROW_STRIP_H
    : ROW_MEDIA_MIN_H;

  const refGridGenerating =
    upstreamGenerating ?? (mediaMode === "frame" ? generating : false);

  const mediaPanel = (
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
      errorMessage={compactFrameLayout ? undefined : mediaError}
      videoPrompt={videoPrompt}
      videoRefLabels={videoRefLabels}
      edition={edition}
      frameApproved={frameApproved}
      videoBlockReason={compactFrameLayout ? undefined : videoBlockReason}
      onApproveFrame={onApproveFrame}
      stripLayout={compactFrameLayout}
      hideFooters={compactFrameLayout}
    />
  );

  const frameFooters =
    compactFrameLayout && mediaMode === "frame" ? (
      <div className="space-y-1">
        {mediaError && !generating ? (
          <StoryErrorLine message={mediaError} />
        ) : null}
        {videoBlockReason && imageUrl && !generating ? (
          <p className={`text-[10px] leading-snug ${STORY_HINT_GOLD_CLASS}`}>
            {videoBlockReason}
          </p>
        ) : null}
      </div>
    ) : null;

  const promptField = useMentions ? (
    <MentionsTextarea
      value={mainDraft}
      mentionables={mentionables ?? []}
      disabled={disabled}
      rows={3}
      fillHeight={compactFrameLayout}
      placeholder="场景、镜头描述；输入 @ 引用角色三视图"
      wrapperClassName={cn(
        "nodrag w-full min-w-0",
        compactFrameLayout ? "h-full" : "min-h-[var(--row-media-min,248px)]",
      )}
      className={cn(
        `${RF_NODE_SCROLL} w-full resize-none rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-snug text-white placeholder:text-[var(--canvas-muted)] focus:border-[var(--canvas-accent)]/60 focus:outline-none`,
        compactFrameLayout
          ? "min-h-0 flex-1 overflow-y-auto"
          : "h-full min-h-[var(--row-media-min,248px)] overflow-hidden",
      )}
      onChange={(next, referencedIds) => {
        setMainDraft(next);
        setMainReferencedIds(referencedIds);
      }}
    />
  ) : (
    <AutoGrowTextarea
      value={mainDraft}
      disabled={disabled}
      matchMediaHeight={!compactFrameLayout}
      onChange={setMainDraft}
    />
  );

  return (
    <div
      className="relative rounded-lg border border-white/10 bg-black/25 px-2 py-2"
      style={
        {
          ["--row-media-min" as string]: `${promptMinH}px`,
          ...(rowBlockMinHeight != null
            ? { minHeight: rowBlockMinHeight }
            : {}),
        } as React.CSSProperties
      }
    >
      <StoryRowTitleBadge title={rowTitle} />
      {compactFrameLayout ? (
        <div className="flex h-full min-h-0 flex-1 flex-col gap-1.5">
          <div
            className="flex shrink-0 items-stretch gap-2"
            style={{ height: STORY_FRAME_ROW_STRIP_H }}
          >
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {promptField}
            </div>
            {showUpstream ? (
              <StoryUpstreamImageColumn
                images={upstreamImages ?? refImages}
                activeIds={activeRefIds}
                edition={edition}
                stripHeight={STORY_FRAME_ROW_STRIP_H}
                onPreviewRef={onPreviewRef}
                generating={refGridGenerating}
              />
            ) : null}
            {mediaPanel}
          </div>
          <div className="mt-auto flex min-h-0 flex-col gap-1">
            {belowPrompt}
            {frameFooters}
          </div>
        </div>
      ) : (
        <div className="flex items-stretch gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {promptField}
            {promptHint ? (
              <p className={STORY_HINT_BODY_CLASS}>{promptHint}</p>
            ) : null}
            {belowPrompt != null ? (
              <div
                className="shrink-0"
                style={
                  belowPromptMinHeight
                    ? { minHeight: belowPromptMinHeight }
                    : undefined
                }
              >
                {belowPrompt}
              </div>
            ) : null}
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
              onPreviewRef={onPreviewRef}
              generating={refGridGenerating}
            />
          ) : null}
          {mediaPanel}
        </div>
      )}
    </div>
  );
}
