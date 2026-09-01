"use client";

import Image from "next/image";

import type { ModelShotGeneratedImageEntry } from "@/lib/model-shot-pose-images";
import { cn } from "@/lib/utils";

type Props = {
  entries: ModelShotGeneratedImageEntry[];
  onPreview: (url: string, title: string) => void;
  activePoseIndex?: number | null;
  activeVersionIndex?: number | null;
};

function formatVersionLabel(entry: ModelShotGeneratedImageEntry): string {
  if (entry.versionCount <= 1) return entry.poseTitle;
  return `${entry.poseTitle} · v${entry.versionIndex + 1}`;
}

/** 全部成图 · 纵向铺开，超出视口滚动 */
export function ModelShotGeneratedImagesSidebar({
  entries,
  onPreview,
  activePoseIndex = null,
  activeVersionIndex = null,
}: Props) {
  if (entries.length === 0) return null;

  return (
    <aside className="sticky top-[5.5rem] flex w-[108px] shrink-0 flex-col self-start">
      <div className="mb-1.5 shrink-0 border-b border-[#f0f0f2] pb-1.5">
        <h4 className="text-[11px] font-semibold text-[#1d1d1f]">全部成图</h4>
        <p className="mt-0.5 text-[9px] text-[#86868b]">{entries.length} 张</p>
      </div>
      <div className="ecom-scrollbar-overlay max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-y-contain pr-0.5">
        <ul className="flex flex-col gap-1.5 pb-1">
          {entries.map((entry) => {
            const isActive =
              activePoseIndex === entry.poseIndex &&
              activeVersionIndex === entry.versionIndex;
            const label = formatVersionLabel(entry);
            return (
              <li key={`${entry.poseIndex}-${entry.versionIndex}-${entry.url}`}>
                <button
                  type="button"
                  className={cn(
                    "group block w-full overflow-hidden rounded-md border text-left transition",
                    isActive
                      ? "border-[#0071e3] ring-1 ring-[#0071e3]/25"
                      : "border-[#e8e8ed] hover:border-[#d2d2d7]",
                  )}
                  onClick={() => onPreview(entry.url, label)}
                  title={label}
                >
                  <div className="relative aspect-[3/4] w-full bg-[#f5f5f7]">
                    <Image
                      src={entry.url}
                      alt={label}
                      fill
                      className="object-cover transition group-hover:brightness-95"
                      unoptimized
                    />
                  </div>
                  <div className="px-1 py-1">
                    <p className="line-clamp-2 text-[9px] leading-tight text-[#424245]">
                      {entry.poseTitle}
                      {entry.versionCount > 1 ? (
                        <span className="text-[#86868b]"> · {entry.versionIndex + 1}/{entry.versionCount}</span>
                      ) : null}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
