"use client";

import Image from "next/image";
import { Eye, Film, ImageIcon, Loader2, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";

import { storyboardPanelCardWidth, storyboardPreviewAspectClass } from "@/lib/storyboard-aspect";
import type { StoryboardPanel } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  panel: StoryboardPanel;
  aspectRatio?: "16:9" | "9:16";
  imageUrl?: string | null;
  busy?: boolean;
  onRegenerateImage?: () => void;
  onRegenerateVideo?: () => void;
  onPreviewImage?: () => void;
  onPreviewPanelVideo?: () => void;
  onEditScript?: () => void;
};

function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

export function StoryboardPanelCard({
  panel,
  aspectRatio = "9:16",
  imageUrl,
  busy,
  onRegenerateImage,
  onRegenerateVideo,
  onPreviewImage,
  onPreviewPanelVideo,
  onEditScript,
}: Props) {
  const [hover, setHover] = useState(false);
  const hasPanelVideo = Boolean(panel.videoUrl);

  const cardWidth = storyboardPanelCardWidth(aspectRatio);

  return (
    <article
      className="group relative flex shrink-0 flex-col overflow-hidden rounded-xl border border-[#e8e8ed] bg-white shadow-sm"
      style={{ width: cardWidth }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={cn(
          "relative w-full bg-[#f5f5f7]",
          storyboardPreviewAspectClass(aspectRatio),
        )}
      >
        {busy ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[#6e6e73]">
            <Loader2 className="h-5 w-5 animate-spin" />
            生成中…
          </div>
        ) : imageUrl ? (
          <Image src={imageUrl} alt={`镜头${panel.index}`} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#86868b]">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <span className="text-xs">待生成</span>
          </div>
        )}

        {hover && !busy ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 backdrop-blur-[1px]">
            {imageUrl && onPreviewImage ? (
              <button
                type="button"
                title="放大预览"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow"
                onClick={(e) => {
                  stopClick(e);
                  onPreviewImage();
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onRegenerateImage ? (
              <button
                type="button"
                title="重新生图"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow"
                onClick={(e) => {
                  stopClick(e);
                  onRegenerateImage();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onEditScript ? (
              <button
                type="button"
                title="修改分镜"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow"
                onClick={(e) => {
                  stopClick(e);
                  onEditScript();
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onRegenerateVideo && imageUrl ? (
              <button
                type="button"
                title="生成镜头视频"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071e3] text-white shadow"
                onClick={(e) => {
                  stopClick(e);
                  onRegenerateVideo();
                }}
              >
                <Film className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-xs font-semibold text-[#1d1d1f]">
          镜头 {panel.index}
          {panel.timeline ? (
            <span className="ml-1 font-normal text-[#86868b]">{panel.timeline}</span>
          ) : null}
        </p>
        {hasPanelVideo ? (
          <button
            type="button"
            className="text-[10px] font-medium text-[#34c759] hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onPreviewPanelVideo?.();
            }}
          >
            有视频
          </button>
        ) : null}
      </div>
    </article>
  );
}
