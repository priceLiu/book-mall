"use client";

import { useMemo } from "react";
import { Palette } from "lucide-react";
import { useCanvasStore } from "@/lib/canvas/store";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import {
  parseVisualStylePackFromOutline,
  type StoryProVisualStylePack,
} from "@/lib/canvas/story-pro-visual-style-pack";
import { cn } from "@/lib/utils";

function resolveHubVisualStylePack(
  hubId: string,
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"],
): StoryProVisualStylePack | null {
  const hub = nodes.find((n) => n.id === hubId);
  const d = (hub?.data ?? {}) as StoryProScriptHubNodeData;
  if (d.visualStylePack) return d.visualStylePack;
  if (d.outlineMd?.trim()) {
    return parseVisualStylePackFromOutline(d.outlineMd) ?? null;
  }
  return null;
}

/** 全片视觉锚定 · 只读摘要（背景/年代/风格/色调） */
export function Pro2VisualStylePackBar({
  hubNodeId,
  className,
}: {
  hubNodeId?: string | null;
  className?: string;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const pack = useMemo(() => {
    if (!hubNodeId?.trim()) return null;
    return resolveHubVisualStylePack(hubNodeId, nodes);
  }, [hubNodeId, nodes]);

  if (!pack) return null;

  const chips = [
    pack.era?.trim() ? { label: "年代", value: pack.era.trim() } : null,
    pack.visualStyle?.trim()
      ? { label: "风格", value: pack.visualStyle.trim() }
      : null,
    pack.colorPalette?.trim()
      ? { label: "色调", value: pack.colorPalette.trim() }
      : null,
    pack.lighting?.trim()
      ? { label: "光影", value: pack.lighting.trim() }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (!chips.length && !pack.worldBackground?.trim()) return null;

  return (
    <div
      className={cn(
        "mb-2 rounded-lg border border-violet-400/15 bg-violet-500/[0.06] px-2 py-1.5",
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-violet-200/80">
        <Palette className="size-3 shrink-0" />
        <span>全片视觉（生图统一风格）</span>
      </div>
      {pack.worldBackground?.trim() ? (
        <p className="mb-1 line-clamp-2 text-[10px] leading-snug text-white/55">
          背景：{pack.worldBackground.trim()}
        </p>
      ) : null}
      {chips.length ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c.label}
              className="max-w-full truncate rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] text-white/70"
              title={`${c.label}：${c.value}`}
            >
              <span className="text-white/40">{c.label} · </span>
              {c.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
