"use client";

import type { NodeProps } from "@xyflow/react";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { StoryCharacterColumnNode } from "../nodes/story-character-column-node";
import { StoryFrameColumnNode } from "../nodes/story-frame-column-node";
import { StoryVideoColumnNode } from "../nodes/story-video-column-node";
import { StoryProSceneColumnNode } from "../nodes/story-pro-scene-column-node";

function asProColumnProps(node: CanvasFlowNode): NodeProps {
  return {
    id: node.id,
    data: node.data,
    selected: true,
    type: node.type,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: node.position.x,
    positionAbsoluteY: node.position.y,
  } as NodeProps;
}

export function Pro2ColumnInspector({ node }: { node: CanvasFlowNode }) {
  const props = asProColumnProps(node);
  return (
    <div className="pro2-inspector-embed min-h-0 flex-1 overflow-y-auto p-2">
      {node.type === "story-pro2-character" ? (
        <StoryCharacterColumnNode {...props} />
      ) : null}
      {node.type === "story-pro2-scene" ? (
        <StoryProSceneColumnNode {...props} />
      ) : null}
      {node.type === "story-pro2-frame" ? (
        <StoryFrameColumnNode {...props} />
      ) : null}
      {node.type === "story-pro2-video" ? (
        <StoryVideoColumnNode {...props} />
      ) : null}
    </div>
  );
}
