"use client";

/**
 * 整页版式快照：把模板骨架按 12 列栅格等比缩小画出来，
 * 让用户在套用前就看清「哪里是大图、哪里是文字、哪里要自己填素材」。
 *
 * 数据直接来自 buildTemplateBlocks（与真正落库的几何同源），
 * 因此模板一改，快照自动跟着变，不存在另画一张示意图导致的对不上。
 */

import { useMemo } from "react";

import {
  buildTemplateBlocks,
  getSpacePageTemplate,
  type SpacePageTemplateKey,
} from "@/lib/ai-space/space-blocks/page-templates";
import { SPACE_GRID_COLS } from "@/lib/ai-space/space-blocks/size-tiers";
import { SPACE_BLOCKS } from "@/lib/ai-space/space-blocks/types";
import { cn } from "@/lib/utils";

const ROW_PX = 11;
const GAP_PX = 3;

export function SpaceTemplatePreview({
  templateKey,
  className,
}: {
  templateKey: SpacePageTemplateKey;
  className?: string;
}) {
  const tpl = getSpacePageTemplate(templateKey);
  const blocks = useMemo(() => buildTemplateBlocks(templateKey), [templateKey]);

  const assetSlots = blocks.filter((b) => b.needsAsset).length;

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className="rounded-lg border border-[#d0d7de] bg-white p-2"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${SPACE_GRID_COLS}, minmax(0, 1fr))`,
          gridAutoRows: `${ROW_PX}px`,
          gap: `${GAP_PX}px`,
        }}
      >
        {blocks.map((b, i) => {
          const def = SPACE_BLOCKS[b.blockType];
          const tall = b.layoutH >= 3;
          return (
            <div
              key={`${b.blockType}-${i}`}
              style={{
                gridColumn: `${b.layoutX + 1} / span ${b.layoutW}`,
                gridRow: `${b.layoutY + 1} / span ${b.layoutH}`,
              }}
              className={cn(
                "flex items-center justify-center overflow-hidden rounded px-1 text-center text-[9px] leading-tight",
                b.needsAsset
                  ? "border border-dashed border-[#54aeff] bg-[#ddf4ff] text-[#0969da]"
                  : "border border-[#d8dee4] bg-[#f6f8fa] text-[#656d76]",
              )}
              title={def.label}
            >
              <span className="truncate">
                {tall || b.layoutW >= 4 ? def.label : ""}
              </span>
            </div>
          );
        })}
      </div>

      <dl className="mt-3 space-y-1 text-[11px] leading-relaxed text-[#656d76]">
        <div className="flex gap-2">
          <dt className="shrink-0 text-[#8c959f]">块数</dt>
          <dd>
            {blocks.length} 个（其中 {assetSlots} 个需要放素材）
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-[#8c959f]">适合</dt>
          <dd>{tpl.bestFor}</dd>
        </div>
      </dl>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#8c959f]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-[#54aeff] bg-[#ddf4ff]" />
          素材槽位
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm border border-[#d8dee4] bg-[#f6f8fa]" />
          文字 / 装饰挂件
        </span>
      </p>
    </div>
  );
}
