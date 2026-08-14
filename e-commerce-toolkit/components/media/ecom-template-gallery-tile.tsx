"use client";

import { EcomMediaLibraryTile } from "@/components/media/ecom-media-library-tile";
import type { EcomTemplateGalleryEntry } from "@/lib/ecom-template-gallery/types";

type Props = {
  entry: EcomTemplateGalleryEntry;
  onPreview: () => void;
};

/** 模板区 3:4 卡片；缩略图走 EcomMediaLibraryTile 懒加载规范 */
export function EcomTemplateGalleryTile({ entry, onPreview }: Props) {
  const kind = entry.mediaKind === "video" ? "video" : "image";
  const thumb =
    entry.thumbUrl?.trim() ||
    (kind === "video" ? entry.ossUrl : undefined);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[#e8e8ed] bg-[#f5f5f7]">
      <EcomMediaLibraryTile
        kind={kind}
        src={entry.ossUrl}
        thumbnailSrc={thumb}
        alt=""
        aspectClass="aspect-[3/4]"
        onPreview={onPreview}
        className="rounded-none border-0"
      />
      {entry.hot ? (
        <span className="pointer-events-none absolute bottom-2 left-2 z-[2] rounded bg-[#ff3b30] px-1.5 py-0.5 text-[10px] font-medium text-white">
          爆款
        </span>
      ) : null}
    </div>
  );
}
