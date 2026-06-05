"use client";

import type { StoryboardSheet } from "@/lib/storyboard-types";
import { cn } from "@/lib/utils";

type Props = {
  sheet: StoryboardSheet | null;
  sheetPngUrl?: string | null;
  panelAspectRatio?: "16:9" | "9:16";
  className?: string;
};

/** 完整分镜图缩略：优先合成 PNG，否则各镜头横条拼图（不用整页 HTML 文档） */
export function StoryboardSheetThumbnail({
  sheet,
  sheetPngUrl,
  panelAspectRatio = "9:16",
  className,
}: Props) {
  const panelAr = panelAspectRatio === "16:9" ? "16/9" : "9/16";
  const png = sheetPngUrl?.trim();
  if (png) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={png}
        alt="完整分镜图"
        className={cn("absolute inset-0 h-full w-full object-contain bg-white p-1", className)}
      />
    );
  }

  const panels = sheet?.panels.filter((p) => Boolean(p.imageUrl?.trim())) ?? [];
  if (panels.length === 0) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-[#86868b]">
        待生成分镜图
      </div>
    );
  }

  return (
    <div className={cn("absolute inset-0 flex gap-1 overflow-x-auto bg-white p-1", className)}>
      {panels.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.index}
          src={p.imageUrl!}
          alt={`镜头 ${p.index}`}
          className="h-full max-w-none shrink-0 rounded border border-[#e8e8ed] object-cover"
          style={{ aspectRatio: panelAr, height: "100%" }}
        />
      ))}
    </div>
  );
}
