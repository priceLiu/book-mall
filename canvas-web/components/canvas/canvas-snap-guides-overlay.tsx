"use client";

import { useStore } from "@xyflow/react";
import type { SnapGuideLine } from "@/lib/canvas/canvas-drag-snap";

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
      className="pointer-events-none absolute inset-0 z-[5] overflow-visible"
      aria-hidden
    >
      <g transform={`translate(${tx}, ${ty}) scale(${zoom})`}>
        {guides.map((g, i) =>
          g.orientation === "vertical" ? (
            <line
              key={`v-${i}`}
              x1={g.position}
              y1={g.from}
              x2={g.position}
              y2={g.to}
              stroke="rgba(147, 197, 253, 0.55)"
              strokeWidth={1 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            />
          ) : (
            <line
              key={`h-${i}`}
              x1={g.from}
              y1={g.position}
              x2={g.to}
              y2={g.position}
              stroke="rgba(147, 197, 253, 0.55)"
              strokeWidth={1 / zoom}
              strokeDasharray={`${6 / zoom} ${4 / zoom}`}
            />
          ),
        )}
      </g>
    </svg>
  );
}
