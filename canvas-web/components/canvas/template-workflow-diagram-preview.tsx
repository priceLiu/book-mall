"use client";

import { useMemo } from "react";

import {
  buildTemplateWorkflowDiagramLayout,
  templateDiagramNodeFill,
} from "@/lib/canvas/template-workflow-diagram";
import type { CanvasGraph } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

type Props = {
  graph: CanvasGraph;
  className?: string;
};

/** 无封面图时的工作流结构预览（静态 SVG，填满 aspect-video 区域） */
export function TemplateWorkflowDiagramPreview({ graph, className }: Props) {
  const layout = useMemo(
    () => buildTemplateWorkflowDiagramLayout(graph),
    [graph],
  );

  if (!layout) return null;

  const { viewBox, nodes, edges } = layout;

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <pattern
          id="tpl-diagram-grid"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="0.75" fill="rgba(255,255,255,0.06)" />
        </pattern>
      </defs>
      <rect
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.w}
        height={viewBox.h}
        fill="url(#tpl-diagram-grid)"
      />
      {edges.map((e) => (
        <line
          key={e.id}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke="rgba(167,139,250,0.45)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {nodes.map((n) => (
        <rect
          key={n.id}
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={10}
          ry={10}
          fill={templateDiagramNodeFill(n.type)}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
