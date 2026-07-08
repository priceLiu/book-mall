"use client";

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

/**
 * 分镜视频 · 数据锚点列（无画布 UI）
 * 视觉层仅在 group + sbv1-video-engine 子节点；与 story-pro2-frame 有 pro2VisualGroupId 时一致。
 */
export function StoryPro2VideoBoardNode(_props: NodeProps) {
  return (
    <div
      className="pointer-events-none opacity-0"
      style={{ width: 1, height: 1 }}
      aria-hidden
    >
      <Handle
        id="in_text"
        type="target"
        position={Position.Left}
        className="!opacity-0"
      />
      <Handle
        id="text"
        type="source"
        position={Position.Right}
        className="!opacity-0"
      />
    </div>
  );
}
