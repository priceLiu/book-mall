"use client";

import { useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { GripVertical, Layers } from "lucide-react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { useCanvasStore } from "@/lib/canvas/store";
import { directorDeskDefaultLabel } from "@/lib/canvas/director-desk-spawn-shot";
import type { StoryPro23dDeskNodeData } from "@/lib/canvas/types";
import {
  PRO2_3D_DESK_NODE_MIN_HEIGHT,
  PRO2_3D_DESK_NODE_MIN_WIDTH,
  PRO2_CARD_SHELL_CLASS,
  PRO2_TEXT_NODE_TITLE_CLASS,
  pro2NodeBorderColor,
} from "@/lib/canvas/story-pro2-node-chrome";
import {
  LIBTV_CARD_DRAG_CLASS,
  LIBTV_NODE_HANDLE_CLASS,
  LIBTV_NODE_OUTER_CLASS,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import { cn } from "@/lib/utils";
import { LibtvEditableNodeTitle } from "../libtv-editable-node-title";
import { Pro2NodeResizer } from "./pro2-node-resizer";

/** 影视专业 2.0 · 3D 导演台控制卡（图 1） */
export function StoryPro23dDeskNode({ id, data, selected }: NodeProps) {
  const openEditor = useCanvasStore((s) => s.openDirector3dDeskEditor);
  const nodes = useCanvasStore((s) => s.nodes);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const d = data as unknown as StoryPro23dDeskNodeData;

  const open = useCallback(() => openEditor(id), [openEditor, id]);

  const defaultLabel = useMemo(
    () => directorDeskDefaultLabel(nodes, id),
    [nodes, id],
  );

  return (
    <div
      className={cn(LIBTV_NODE_OUTER_CLASS, LIBTV_CARD_DRAG_CLASS)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Handle
        id="panorama"
        type="target"
        position={Position.Left}
        className={cn(
          LIBTV_NODE_HANDLE_CLASS,
          selected ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        title="全景背景"
      />
      <Handle
        id="image"
        type="source"
        position={Position.Right}
        className={cn(
          LIBTV_NODE_HANDLE_CLASS,
          selected ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        title="机位截图"
      />

      <div className={cn(PRO2_TEXT_NODE_TITLE_CLASS, "relative mb-1.5 shrink-0")}>
        <GripVertical className="size-3.5 shrink-0 text-white/30" />
        <Layers className="size-3.5 shrink-0 text-white/55" />
        <LibtvEditableNodeTitle
          nodeId={id}
          defaultLabel={defaultLabel}
          textClassName="text-[11px] text-white"
        />
      </div>

      <div
        className={cn(
          PRO2_CARD_SHELL_CLASS,
          LIBTV_CARD_DRAG_CLASS,
          "relative flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
        style={
          libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "neutral",
          }) ?? { borderColor: pro2NodeBorderColor(!!selected) }
        }
      >
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
          <Layers className="size-16 text-white/25" strokeWidth={1.25} />
          <p className="max-w-[260px] text-[11px] leading-relaxed text-white/45">
            在3D空间中搭建场景并进行多视角截图
          </p>
          <button
            type="button"
            onClick={open}
            className="nodrag rounded-lg border border-white/15 bg-white/[0.08] px-5 py-2 text-[12px] font-medium text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white/90"
          >
            打开导演台
          </button>
        </div>
      </div>

      {selected ? (
        <Pro2NodeResizer
          minWidth={PRO2_3D_DESK_NODE_MIN_WIDTH}
          minHeight={PRO2_3D_DESK_NODE_MIN_HEIGHT}
        />
      ) : null}
    </div>
  );
}
