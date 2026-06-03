"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  STYLE_LIBRARY_CARD_FOOTER,
  STYLE_LIBRARY_CARD_SHELL,
  STYLE_LIBRARY_CARD_SUBTITLE,
  STYLE_LIBRARY_CARD_TITLE,
  STYLE_LIBRARY_GRID_CLASS,
  STYLE_LIBRARY_HOVER_PROMPT_OVERLAY,
  STYLE_LIBRARY_MEDIA_FRAME,
  styleLibraryMediaHeightClass,
} from "@/lib/canvas/style-library-card-chrome";
import {
  STYLE_LIBRARY_CATEGORIES,
  STYLE_LIBRARY_PRESETS,
  type StyleLibraryPreset,
} from "@/lib/canvas/style-library/catalog";

const ALL_CATEGORY = "全部";

type StyleLibraryGridProps = {
  onSelect?: (preset: StyleLibraryPreset) => void;
  onPreview?: (preset: StyleLibraryPreset) => void;
  selectLabel?: string;
  className?: string;
  /** 弹层等容器：筛选头固定，仅下方网格滚动 */
  fixedFilter?: boolean;
  filterClassName?: string;
  contentClassName?: string;
};

export function StyleLibraryGrid({
  onSelect,
  onPreview,
  selectLabel = "套用",
  className,
  fixedFilter = false,
  filterClassName,
  contentClassName,
}: StyleLibraryGridProps) {
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const contentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const skipScrollOnMount = useRef(true);

  const filtered = useMemo(() => {
    if (category === ALL_CATEGORY) return STYLE_LIBRARY_PRESETS;
    return STYLE_LIBRARY_PRESETS.filter((p) => p.category === category);
  }, [category]);

  useEffect(() => {
    if (skipScrollOnMount.current) {
      skipScrollOnMount.current = false;
      return;
    }
    if (fixedFilter) {
      contentRef.current?.scrollTo({ top: 0 });
      return;
    }
    rootRef.current?.scrollIntoView({ block: "start" });
  }, [category, fixedFilter]);

  const filterNav = (
    <nav
      className={cn(
        "nodrag flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 bg-[var(--canvas-surface,#161427)] pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        !fixedFilter && "sticky top-0 z-10",
        filterClassName,
      )}
      aria-label="风格分类"
    >
      <CategoryPill
        active={category === ALL_CATEGORY}
        onClick={() => setCategory(ALL_CATEGORY)}
      >
        {ALL_CATEGORY}
      </CategoryPill>
      {STYLE_LIBRARY_CATEGORIES.map((cat) => (
        <CategoryPill
          key={cat}
          active={category === cat}
          onClick={() => setCategory(cat)}
        >
          {cat}
        </CategoryPill>
      ))}
    </nav>
  );

  const gridBody =
    filtered.length === 0 ? (
      <p className="text-[12px] text-[var(--canvas-muted)]">该分类暂无条目。</p>
    ) : (
      <div className={cn(STYLE_LIBRARY_GRID_CLASS, "w-full min-w-0")}>
        {filtered.map((preset) => (
          <StyleLibraryCard
            key={preset.id}
            preset={preset}
            selectLabel={selectLabel}
            onSelect={onSelect}
            onPreview={onPreview}
          />
        ))}
      </div>
    );

  if (fixedFilter) {
    return (
      <div className={cn("flex min-h-0 flex-col", className)}>
        {filterNav}
        <div
          ref={contentRef}
          className={cn("min-h-0 flex-1 overflow-y-auto", contentClassName)}
        >
          {gridBody}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("flex min-h-0 flex-col gap-4", className)}>
      {filterNav}
      {gridBody}
    </div>
  );
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "nodrag shrink-0 rounded-md px-4 py-2 text-[13px] transition",
        active
          ? "bg-[#007aff] text-white"
          : "bg-[#1e1e1e] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function StyleLibraryCard({
  preset,
  onSelect,
  onPreview,
  selectLabel,
}: {
  preset: StyleLibraryPreset;
  onSelect?: (preset: StyleLibraryPreset) => void;
  onPreview?: (preset: StyleLibraryPreset) => void;
  selectLabel: string;
}) {
  const hasImage = Boolean(preset.imageUrl?.trim());
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <article
      className={cn("nodrag w-full min-w-0 cursor-pointer", STYLE_LIBRARY_CARD_SHELL)}
      onClick={() => onSelect?.(preset)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSelect?.(preset);
      }}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className={cn(STYLE_LIBRARY_MEDIA_FRAME, styleLibraryMediaHeightClass())}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- OSS 外链预览
          <img
            src={preset.imageUrl}
            alt={preset.name}
            className="block h-[260px] w-full object-cover"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <span className="text-[11px] text-white/40">预览图待上传</span>
            <span className="line-clamp-2 text-[12px] text-white/70">
              {preset.name}
            </span>
          </div>
        )}

        <div className={STYLE_LIBRARY_HOVER_PROMPT_OVERLAY} aria-hidden>
          {preset.prompt}
        </div>

        {onPreview && hasImage ? (
          <button
            type="button"
            className="nodrag absolute right-2 top-2 z-10 rounded-md border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] text-white/90 opacity-0 transition group-hover/card:opacity-100"
            onClick={(e) => {
              stop(e);
              onPreview(preset);
            }}
          >
            预览
          </button>
        ) : null}
      </div>

      <div className={STYLE_LIBRARY_CARD_FOOTER}>
        <p className={STYLE_LIBRARY_CARD_TITLE}>{preset.name}</p>
        <p className={STYLE_LIBRARY_CARD_SUBTITLE}>{preset.category}</p>
        {onSelect ? (
          <p className="mt-2 text-[10px] font-medium text-cyan-300/80">
            点击{selectLabel}
          </p>
        ) : null}
      </div>
    </article>
  );
}
