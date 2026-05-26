"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  storyRefIdsFromPrompt,
  STORY_ROW_LABEL_COL_WIDTH,
  STORY_UPSTREAM_COL_WIDTH,
  type StoryRefImage,
} from "@/lib/canvas/story-ref-image";
import type { MentionableItem } from "./mentions/MentionsTextarea";
import { MentionsTextarea } from "./mentions/MentionsTextarea";
import { StoryColumnMediaPanel } from "./story-column-media-panel";

const SAVE_DEBOUNCE_MS = 600;
/** 与 story-column-layout MEDIA_COL_MIN 对齐 */
const ROW_MEDIA_MIN_H = 148;

function idsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join("\0");
  const sb = [...b].sort().join("\0");
  return sa === sb;
}

function StoryRowTitleColumn({ title }: { title: string }) {
  return (
    <div
      className="flex shrink-0 items-start pt-1"
      style={{ width: STORY_ROW_LABEL_COL_WIDTH }}
    >
      <p className="text-[11px] font-semibold leading-tight text-white">
        {title}
      </p>
    </div>
  );
}

/** 上游传入图（提示词与输出之间），无列标题 */
function StoryUpstreamImageColumn({
  images,
  activeIds,
}: {
  images: StoryRefImage[];
  activeIds: string[];
}) {
  return (
    <div
      className="flex shrink-0 self-start"
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
                    ? "border-[#fb923c] shadow-[0_0_0_1px_#fb923c,0_0_10px_rgba(251,146,60,0.4)]"
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
}: {
  value: string;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      className="nodrag block w-full resize-none overflow-hidden rounded border border-white/10 bg-black/35 px-2 py-1.5 font-mono text-[10px] leading-snug text-white/90"
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
  generateTitle,
  onGenerate,
  onPreview,
  promptHint,
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
  generateTitle?: string;
  onGenerate: () => void;
  onPreview?: () => void;
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
      className="rounded-lg border border-white/10 bg-black/25 px-2 py-2"
      style={
        {
          ["--row-media-min" as string]: `${ROW_MEDIA_MIN_H}px`,
        } as React.CSSProperties
      }
    >
      <div className="flex items-start gap-2">
        <StoryRowTitleColumn title={rowTitle} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {useMentions ? (
            <MentionsTextarea
              value={mainDraft}
              mentionables={mentionables ?? []}
              disabled={disabled}
              rows={3}
              placeholder="场景、镜头描述；输入 @ 引用角色三视图"
              wrapperClassName="nodrag w-full min-w-0"
              onChange={(next, referencedIds) => {
                setMainDraft(next);
                setMainReferencedIds(referencedIds);
              }}
            />
          ) : (
            <AutoGrowTextarea
              value={mainDraft}
              disabled={disabled}
              onChange={setMainDraft}
            />
          )}
          {promptHint ? (
            <p className="text-[10px] leading-relaxed text-[#60a5fa]">
              {promptHint}
            </p>
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
          />
        ) : null}
        <StoryColumnMediaPanel
          imageUrl={imageUrl}
          videoUrl={videoUrl}
          audioUrl={audioUrl}
          generating={generating}
          generateTitle={generateTitle}
          onGenerate={onGenerate}
          onPreview={onPreview}
        />
      </div>
    </div>
  );
}
