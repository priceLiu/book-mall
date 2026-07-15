"use client";

import { CanvasListCover } from "@/components/canvas/canvas-list-cover";
import type { CanvasGraph } from "@/lib/canvas/types";

type Props = {
  graph: CanvasGraph;
  thumbnailUrl?: string | null;
  name?: string;
  className?: string;
};

/** 首页模板封面：直接复用 CanvasListCover（与「我的画布」同一组件） */
export function TemplateSnapshotPreview({
  graph,
  thumbnailUrl,
  name,
  className,
}: Props) {
  return (
    <CanvasListCover
      url={thumbnailUrl}
      name={name}
      graph={graph}
      className={className}
    />
  );
}
