"use client";

import { AudioLines, ImagePlus, ScrollText } from "lucide-react";

import type { ProjectAssetKind } from "@/lib/canvas/project-asset-types";
import { isProjectAssetVideoUrl } from "@/lib/canvas/project-asset-preview";
import { cn } from "@/lib/utils";

const HOVER_INSERT_BTN =
  "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow-md transition hover:scale-105 hover:bg-white";

function ProjectAssetEmptyPreview({ assetKind }: { assetKind?: ProjectAssetKind }) {
  if (assetKind === "AUDIO") {
    return (
      <div className="flex size-full flex-col items-center justify-center bg-black">
        <AudioLines className="size-10 text-white/30" strokeWidth={1.5} aria-hidden />
      </div>
    );
  }
  if (assetKind === "SCRIPT_PACKAGE") {
    return (
      <div className="flex size-full flex-col items-center justify-center bg-black">
        <ScrollText className="size-10 text-white/30" strokeWidth={1.5} aria-hidden />
      </div>
    );
  }
  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 bg-black px-2 text-center">
      <span className="text-[10px] text-white/35">暂无预览</span>
    </div>
  );
}

export type ProjectAssetGridCardMedia = {
  id: string;
  url: string;
  label: string;
  mimeType: string | null;
};

function SquareMediaTile({
  item,
  className,
  onHover,
  onLeave,
  onClick,
  showLabel = false,
}: {
  item: ProjectAssetGridCardMedia;
  className?: string;
  onHover?: (el: HTMLElement) => void;
  onLeave?: () => void;
  onClick?: () => void;
  showLabel?: boolean;
}) {
  const isVideo = isProjectAssetVideoUrl(item.url, item.mimeType);
  return (
    <button
      type="button"
      className={cn(
        "nodrag relative min-h-0 min-w-0 overflow-hidden bg-black/40",
        onClick && "cursor-pointer",
        className,
      )}
      title={item.label}
      onMouseEnter={(e) => onHover?.(e.currentTarget)}
      onMouseLeave={() => onLeave?.()}
      onClick={onClick}
    >
      {isVideo ? (
        <video
          src={item.url}
          className="size-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- OSS 外链预览
        <img
          src={item.url}
          alt={item.label}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
      {showLabel ? (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-0.5 py-0.5 text-center text-[7px] text-white/85">
          {item.label}
        </span>
      ) : null}
    </button>
  );
}

/** 正方形区域内的多图/单图预览（保存对话框、侧栏卡片共用） */
export function ProjectAssetMediaPreviewGrid({
  items,
  assetKind,
  onHoverItem,
  onLeaveItem,
  onPreviewItem,
}: {
  items: ProjectAssetGridCardMedia[];
  assetKind?: ProjectAssetKind;
  onHoverItem?: (
    item: ProjectAssetGridCardMedia,
    anchor: HTMLElement,
  ) => void;
  onLeaveItem?: () => void;
  onPreviewItem?: (item: ProjectAssetGridCardMedia) => void;
}) {
  if (items.length === 0) {
    return <ProjectAssetEmptyPreview assetKind={assetKind} />;
  }

  if (items.length === 1) {
    const item = items[0]!;
    return (
      <SquareMediaTile
        item={item}
        className="size-full"
        onHover={(el) => onHoverItem?.(item, el)}
        onLeave={onLeaveItem}
        onClick={() => onPreviewItem?.(item)}
      />
    );
  }

  const shown = items.slice(0, 4);
  const extra = items.length - shown.length;
  const count = shown.length;

  return (
    <div
      className={cn(
        "relative grid size-full gap-px bg-white/10",
        count === 2 && "grid-cols-2 grid-rows-1",
        count === 3 && "grid-cols-2 grid-rows-2",
        count >= 4 && "grid-cols-2 grid-rows-2",
      )}
    >
      {shown.map((item, index) => (
        <SquareMediaTile
          key={item.id}
          item={item}
          showLabel={count >= 2}
          className={cn(count === 3 && index === 2 && "col-span-2")}
          onHover={(el) => onHoverItem?.(item, el)}
          onLeave={onLeaveItem}
          onClick={() => onPreviewItem?.(item)}
        />
      ))}
      {extra > 0 ? (
        <span className="pointer-events-none absolute bottom-1 right-1 z-10 rounded bg-black/75 px-1 py-0.5 text-[8px] text-white/90">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

/** 项目资产侧栏 · 上标题 / 中正方形媒体 / 下插入按钮 */
export function ProjectAssetGridCard({
  kindLabel,
  displayName,
  assetKind,
  mediaItems,
  canInsert,
  insertBusy,
  onInsert,
  onHoverMedia,
  onLeaveMedia,
  onPreviewMedia,
  footerMeta,
}: {
  kindLabel: string;
  displayName: string;
  assetKind?: ProjectAssetKind;
  mediaItems: ProjectAssetGridCardMedia[];
  canInsert?: boolean;
  insertBusy?: boolean;
  onInsert?: () => void;
  onHoverMedia?: (
    item: ProjectAssetGridCardMedia,
    anchor: HTMLElement,
  ) => void;
  onLeaveMedia?: () => void;
  onPreviewMedia?: (item: ProjectAssetGridCardMedia) => void;
  /** 锁定 / 共享 / 删除等，固定在卡片底部 */
  footerMeta?: React.ReactNode;
}) {
  const cardTitle = `${kindLabel}: ${displayName}`;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#1a1a1a]">
      <p
        className="truncate px-2 pb-1 pt-2 text-[11px] font-medium leading-snug text-[#eee]"
        title={cardTitle}
      >
        {cardTitle}
      </p>

      <div className="group/media relative mx-2 mb-2 mt-1 aspect-square overflow-hidden rounded-md bg-black">
        <ProjectAssetMediaPreviewGrid
          items={mediaItems}
          assetKind={assetKind}
          onHoverItem={onHoverMedia}
          onLeaveItem={onLeaveMedia}
          onPreviewItem={onPreviewMedia}
        />
        {canInsert ? (
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center bg-black/0 opacity-0 transition duration-150 group-hover/media:bg-black/45 group-hover/media:opacity-100">
            <button
              type="button"
              className={HOVER_INSERT_BTN}
              aria-label="插入画布"
              title="插入画布"
              disabled={insertBusy}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onInsert?.();
              }}
            >
              <ImagePlus className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>

      {footerMeta ? (
        <div className="min-h-[22px] border-t border-white/5 px-2 pb-2 pt-1">
          {footerMeta}
        </div>
      ) : null}
    </article>
  );
}
