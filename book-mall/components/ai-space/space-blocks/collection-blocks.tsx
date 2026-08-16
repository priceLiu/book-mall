"use client";

/**
 * 挂件 · 图片墙 / 视频合集 / 角色卡 / 前后对比
 *
 * 注册见 ./renderers.tsx。图片一律缩略图 + lazy，原图走 lightbox。
 */

import { useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { AiSpaceBlockRefDto } from "@/lib/ai-space/ai-space-space-types";
import {
  GALLERY_LAYOUTS,
  GAP_SIZES,
  SPACE_BLOCKS,
} from "@/lib/ai-space/space-blocks/types";
import { cn } from "@/lib/utils";

import {
  InspectorEmpty,
  InspectorNumber,
  InspectorRow,
  InspectorSection,
  InspectorSelect,
  InspectorText,
  InspectorToggle,
  readConfig,
  refsForSlot,
  SpaceEmptySlot,
  SpaceImage,
  SpaceMissingAsset,
  SpaceVideo,
  type SpaceBlockInspectorProps,
  type SpaceBlockViewProps,
} from "./block-kit";

const GAP_CLASS: Record<(typeof GAP_SIZES)[number], string> = {
  sm: "gap-1",
  md: "gap-2",
  lg: "gap-4",
};

const GAP_PX: Record<(typeof GAP_SIZES)[number], string> = {
  sm: "4px",
  md: "8px",
  lg: "16px",
};

// ---------------------------------------------------------------------------
// 图片墙
// ---------------------------------------------------------------------------

export function GalleryBlockView({
  block,
  readOnly,
  theme,
  onOpenLightbox,
}: SpaceBlockViewProps) {
  const refs = block.refs;
  if (refs.length === 0) {
    return (
      <SpaceEmptySlot label="放多张图组成图片墙" readOnly={readOnly} theme={theme} />
    );
  }

  const layout = readConfig<(typeof GALLERY_LAYOUTS)[number]>(block, "layout", "grid");
  const columns = readConfig(block, "columns", 3);
  const gap = readConfig<(typeof GAP_SIZES)[number]>(block, "gap", "md");
  const showCaptions = readConfig(block, "showCaptions", false);

  const Tile = ({ ref: r, index }: { ref: AiSpaceBlockRefDto; index: number }) => (
    <figure className="overflow-hidden rounded-md" style={{ background: theme.border }}>
      <div className={layout === "masonry" ? "" : "aspect-square"}>
        {r.resolved ? (
          <SpaceImage
            ref={r}
            fit={layout === "masonry" ? "contain" : "cover"}
            className={layout === "masonry" ? "h-auto" : undefined}
            onClick={
              onOpenLightbox ? () => onOpenLightbox(refs, index) : undefined
            }
          />
        ) : (
          <SpaceMissingAsset readOnly={readOnly} theme={theme} />
        )}
      </div>
      {showCaptions && (r.caption ?? r.resolved?.title) ? (
        <figcaption
          className="truncate px-1.5 py-1 text-[11px]"
          style={{ color: theme.mutedText, background: theme.cardBg }}
        >
          {r.caption ?? r.resolved?.title}
        </figcaption>
      ) : null}
    </figure>
  );

  if (layout === "carousel") {
    return (
      <div className="flex h-full w-full items-center px-8">
        <Carousel opts={{ align: "start", loop: true }} className="w-full">
          <CarouselContent className={cn("-ml-2", GAP_CLASS[gap])}>
            {refs.map((r, i) => (
              <CarouselItem
                key={r.id}
                className="pl-2"
                style={{ flexBasis: `${100 / Math.min(columns, refs.length)}%` }}
              >
                <Tile ref={r} index={i} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    );
  }

  if (layout === "masonry") {
    return (
      <div
        className="h-full w-full overflow-y-auto"
        style={{ columnCount: columns, columnGap: GAP_PX[gap] }}
      >
        {refs.map((r, i) => (
          <div key={r.id} style={{ marginBottom: GAP_PX[gap] }} className="break-inside-avoid">
            <Tile ref={r} index={i} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("grid h-full w-full overflow-y-auto", GAP_CLASS[gap])}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {refs.map((r, i) => (
        <Tile key={r.id} ref={r} index={i} />
      ))}
    </div>
  );
}

export function GalleryBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  const columns = readConfig(block, "columns", 3);
  return (
    <InspectorSection title="图片墙">
      <InspectorRow label="排列">
        <InspectorSelect
          value={readConfig<(typeof GALLERY_LAYOUTS)[number]>(block, "layout", "grid")}
          options={[
            { value: "grid", label: "等高网格" },
            { value: "masonry", label: "瀑布流" },
            { value: "carousel", label: "轮播" },
          ]}
          onChange={(layout) => onConfigChange({ layout })}
        />
      </InspectorRow>
      <InspectorRow label={`列数 ${columns}`}>
        <InspectorNumber
          value={columns}
          min={2}
          max={6}
          onChange={(v) => onConfigChange({ columns: v })}
        />
      </InspectorRow>
      <InspectorRow label="间距">
        <InspectorSelect
          value={readConfig<(typeof GAP_SIZES)[number]>(block, "gap", "md")}
          options={[
            { value: "sm", label: "紧凑" },
            { value: "md", label: "标准" },
            { value: "lg", label: "宽松" },
          ]}
          onChange={(gap) => onConfigChange({ gap })}
        />
      </InspectorRow>
      <InspectorRow label="显示图注">
        <InspectorToggle
          checked={readConfig(block, "showCaptions", false)}
          onChange={(showCaptions) => onConfigChange({ showCaptions })}
        />
      </InspectorRow>
      <p className="text-[11px] leading-relaxed text-[#8c959f]">
        已放 {block.refs.length} / {SPACE_BLOCKS.gallery.refs.max} 张
      </p>
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 视频合集
// ---------------------------------------------------------------------------

export function VideoPlaylistBlockView({
  block,
  readOnly,
  theme,
}: SpaceBlockViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = block.refs;
  if (refs.length === 0) {
    return <SpaceEmptySlot label="放多条视频" readOnly={readOnly} theme={theme} />;
  }

  const showTitles = readConfig(block, "showTitles", true);
  const active = refs[Math.min(activeIndex, refs.length - 1)];

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-hidden rounded-md">
        {active.resolved ? (
          <SpaceVideo ref={active} fit="contain" />
        ) : (
          <SpaceMissingAsset readOnly={readOnly} theme={theme} />
        )}
      </div>
      <ul className="flex shrink-0 gap-2 overflow-x-auto pb-1">
        {refs.map((r, i) => (
          <li key={r.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                "w-24 overflow-hidden rounded border text-left",
                i === activeIndex ? "ring-2" : null,
              )}
              style={{
                borderColor: theme.border,
                background: theme.cardBg,
                boxShadow: i === activeIndex ? `0 0 0 2px ${theme.text}` : undefined,
              }}
            >
              <div className="aspect-video" style={{ background: theme.border }}>
                {r.resolved?.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.resolved.thumbnailUrl}
                    alt={r.resolved.title ?? "视频"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              {showTitles ? (
                <span
                  className="block truncate px-1 py-0.5 text-[10px]"
                  style={{ color: theme.mutedText }}
                >
                  {r.caption ?? r.resolved?.title ?? `第 ${i + 1} 条`}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VideoPlaylistBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  return (
    <InspectorSection title="视频合集">
      <InspectorRow label="显示标题">
        <InspectorToggle
          checked={readConfig(block, "showTitles", true)}
          onChange={(showTitles) => onConfigChange({ showTitles })}
        />
      </InspectorRow>
      <p className="text-[11px] leading-relaxed text-[#8c959f]">
        已放 {block.refs.length} / {SPACE_BLOCKS.video_playlist.refs.max} 条
      </p>
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 角色卡
// ---------------------------------------------------------------------------

export function CharacterCardBlockView({
  block,
  readOnly,
  theme,
  onOpenLightbox,
}: SpaceBlockViewProps) {
  const slots = SPACE_BLOCKS.character_card.slots ?? [];
  const filled = slots
    .map((s) => ({ slot: s, ref: refsForSlot(block, s.key) }))
    .filter((x) => x.ref !== null) as {
    slot: { key: string; label: string };
    ref: AiSpaceBlockRefDto;
  }[];

  if (filled.length === 0) {
    return (
      <SpaceEmptySlot
        label="放形象图：面部 / 全身 / 服装"
        readOnly={readOnly}
        theme={theme}
      />
    );
  }

  const name = readConfig(block, "name", "");
  const role = readConfig(block, "role", "");
  const showSlotLabels = readConfig(block, "showSlotLabels", true);

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {name || role ? (
        <div className="shrink-0">
          {name ? (
            <p className="truncate text-sm font-semibold" style={{ color: theme.text }}>
              {name}
            </p>
          ) : null}
          {role ? (
            <p className="truncate text-xs" style={{ color: theme.mutedText }}>
              {role}
            </p>
          ) : null}
        </div>
      ) : null}
      <div
        className="grid min-h-0 flex-1 gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(filled.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {filled.map(({ slot, ref: r }, i) => (
          <figure
            key={r.id}
            className="flex min-h-0 flex-col overflow-hidden rounded-md"
            style={{ background: theme.border }}
          >
            <div className="min-h-0 flex-1">
              {r.resolved ? (
                <SpaceImage
                  ref={r}
                  fit="cover"
                  onClick={
                    onOpenLightbox
                      ? () => onOpenLightbox(filled.map((f) => f.ref), i)
                      : undefined
                  }
                />
              ) : (
                <SpaceMissingAsset readOnly={readOnly} theme={theme} />
              )}
            </div>
            {showSlotLabels ? (
              <figcaption
                className="shrink-0 truncate px-1 py-0.5 text-center text-[10px]"
                style={{ color: theme.mutedText, background: theme.cardBg }}
              >
                {slot.label}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </div>
  );
}

export function CharacterCardBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  return (
    <InspectorSection title="角色卡">
      <InspectorRow label="名称">
        <InspectorText
          value={readConfig(block, "name", "")}
          placeholder="角色 / 模特名"
          maxLength={60}
          onChange={(name) => onConfigChange({ name })}
        />
      </InspectorRow>
      <InspectorRow label="定位">
        <InspectorText
          value={readConfig(block, "role", "")}
          placeholder="如：女主 / 冬装模特"
          maxLength={60}
          onChange={(role) => onConfigChange({ role })}
        />
      </InspectorRow>
      <InspectorRow label="显示槽位名">
        <InspectorToggle
          checked={readConfig(block, "showSlotLabels", true)}
          onChange={(showSlotLabels) => onConfigChange({ showSlotLabels })}
        />
      </InspectorRow>
    </InspectorSection>
  );
}

// ---------------------------------------------------------------------------
// 前后对比
// ---------------------------------------------------------------------------

export function BeforeAfterBlockView({
  block,
  readOnly,
  theme,
}: SpaceBlockViewProps) {
  const before = refsForSlot(block, "before");
  const after = refsForSlot(block, "after");
  const initial = readConfig(block, "initialPercent", 50);
  const [percent, setPercent] = useState(initial);

  if (!before || !after) {
    return (
      <SpaceEmptySlot
        label="需要两张图：改前 + 改后"
        readOnly={readOnly}
        theme={theme}
      />
    );
  }
  if (!before.resolved || !after.resolved) {
    return <SpaceMissingAsset readOnly={readOnly} theme={theme} />;
  }

  const labelBefore = readConfig(block, "labelBefore", "改前");
  const labelAfter = readConfig(block, "labelAfter", "改后");

  return (
    <div className="flex h-full w-full flex-col gap-2">
      <div
        className="relative min-h-0 flex-1 select-none overflow-hidden rounded-md"
        style={{ background: theme.border }}
      >
        <SpaceImage ref={after} fit="contain" />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
        >
          <SpaceImage ref={before} fit="contain" />
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow"
          style={{ left: `${percent}%` }}
        />
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
          {labelBefore}
        </span>
        <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">
          {labelAfter}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        aria-label="对比滑块"
        onChange={(e) => setPercent(Number(e.target.value))}
        className="w-full shrink-0 accent-[#0969da]"
      />
    </div>
  );
}

export function BeforeAfterBlockInspector({
  block,
  onConfigChange,
}: SpaceBlockInspectorProps) {
  const initial = readConfig(block, "initialPercent", 50);
  const hasBoth =
    refsForSlot(block, "before") !== null && refsForSlot(block, "after") !== null;
  return (
    <InspectorSection title="前后对比">
      <InspectorRow label="左侧标签">
        <InspectorText
          value={readConfig(block, "labelBefore", "改前")}
          maxLength={20}
          onChange={(labelBefore) => onConfigChange({ labelBefore })}
        />
      </InspectorRow>
      <InspectorRow label="右侧标签">
        <InspectorText
          value={readConfig(block, "labelAfter", "改后")}
          maxLength={20}
          onChange={(labelAfter) => onConfigChange({ labelAfter })}
        />
      </InspectorRow>
      <InspectorRow label={`初始位置 ${initial}%`}>
        <InspectorNumber
          value={initial}
          min={0}
          max={100}
          onChange={(v) => onConfigChange({ initialPercent: v })}
        />
      </InspectorRow>
      {hasBoth ? null : (
        <InspectorEmpty hint="拖入两张图后自动分配到改前 / 改后，可在素材列表里调整顺序。" />
      )}
    </InspectorSection>
  );
}
