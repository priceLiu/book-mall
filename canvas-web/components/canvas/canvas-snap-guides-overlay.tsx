"use client";

import { useStore } from "@xyflow/react";
import type { SnapGuideLine } from "@/lib/canvas/canvas-drag-snap";

/** 拖动对齐辅助线 · 须在节点层之上（dragging z≈1000） */
const SNAP_GUIDE_STROKE = "rgba(255,255,255,0.48)";

export function CanvasSnapGuidesOverlay({
  guides,
}: {
  guides: SnapGuideLine[];
}) {
  const transform = useStore((s) => s.transform);
  const [tx, ty, zoom] = transform;

  if (!guides.length) return null;

  return (
    <svg
      className="canvas-snap-guides-overlay pointer-events-none absolute inset-0 overflow-visible"
      aria-hidden
    >
      <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
        {guides.map((g, i) => {
          if (g.orientation === "vertical") {
            return (
              <line
                key={`v-${i}`}
                x1={g.position}
                y1={g.from}
                x2={g.position}
                y2={g.to}
                stroke={SNAP_GUIDE_STROKE}
                strokeWidth={1 / zoom}
                strokeDasharray={`${6 / zoom} ${4 / zoom}`}
              />
            );
          }
          return (
            <line
              key={`h-${i}`}
              x1={g.from}
              y1={g.position}
              x2={g.to}
              y2={g.position}
              stroke={SNAP_GUIDE_STROKE}
              strokeWidth={1 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            />
          );
        })}
      </g>
    </svg>
  );
}
