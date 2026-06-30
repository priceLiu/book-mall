"use client";

import { useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, NodeResizer, Position } from "@xyflow/react";
import { GripVertical } from "lucide-react";

import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { collectJianyingLibtvConnectionSnapshot } from "@/lib/canvas/jianying-from-workspace";
import {
  libtvNodeBorderStyle,
  libtvNodeInteractiveBorderClass,
} from "@/lib/canvas/libtv-node-chrome";
import { JIANYING_EXPORT_LEFT_ADD_MENU } from "@/lib/canvas/sbv1-add-node-menu";
import { spawnSbv1NeighborFromNode } from "@/lib/canvas/sbv1-spawn-nodes";
import { useCanvasStore } from "@/lib/canvas/store";
import { PRO2_NODE_HANDLE_CLASS } from "@/lib/canvas/story-pro2-node-chrome";
import type { JianyingExportNodeData } from "@/lib/canvas/types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import { JianyingExportPro2Panel } from "./jianying-export-pro2-panel";

const NODE_BG = "#212121";
const MIN_W = 360;
const MIN_H = 400;

/** 2.0 · 导出剪辑（内嵌完整导出 / 自动剪辑 · 无 Dock） */
export function JianyingExportPro2Node({ id, data, selected }: NodeProps) {
  const d = data as unknown as JianyingExportNodeData;
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);

  const snapshot = useMemo(
    () => collectJianyingLibtvConnectionSnapshot(id, nodes, edges),
    [id, nodes, edges],
  );

  const showSidePlus = Boolean(hovered || selected || connectingFromNodeId);

  const spawnStore = useMemo(
    () => ({ nodes, edges, addNode, addNodeInGroup, setNodes, setEdges }),
    [nodes, edges, addNode, addNodeInGroup, setNodes, setEdges],
  );

  const onLeftPick = useCallback(
    (itemId: string, nodeType?: string) => {
      if (itemId !== "video" && nodeType !== "sbv1-video-engine") return;
      spawnSbv1NeighborFromNode(id, "left", "sbv1-video-engine", spawnStore);
    },
    [id, spawnStore],
  );

  const title = d.label?.trim() || "导出剪辑";
  const borderStyle =
    libtvNodeBorderStyle({
      selected: !!selected,
      hovered: hovered && !selected,
      edition: "neutral",
    }) ?? { borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderStyle: "solid" as const };

  return (
    <div
      className={cn(
        RF_NODE_DRAG_HANDLE,
        libtvNodeInteractiveBorderClass({
          selected: !!selected,
          hovered: hovered && !selected,
          edition: "neutral",
        }),
        "relative flex h-full w-full min-h-0 flex-col overflow-visible rounded-2xl text-[12px] text-white",
        "cursor-grab active:cursor-grabbing",
      )}
      style={{ backgroundColor: NODE_BG, ...borderStyle }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={MIN_W}
        minHeight={MIN_H}
        handleClassName="jianying-export-resizer-handle"
      />

      <Handle
        id="in_video"
        type="target"
        position={Position.Left}
        className={cn(
          PRO2_NODE_HANDLE_CLASS,
          showSidePlus
            ? "pointer-events-none opacity-0"
            : selected
              ? "opacity-100"
              : "pointer-events-none opacity-0",
        )}
        title="各镜视频"
      />

      {showSidePlus ? (
        <Pro2NodeSidePlus
          side="left"
          handleId="plus_left"
          visible
          className="z-[20060]"
          sections={JIANYING_EXPORT_LEFT_ADD_MENU}
          onPick={onLeftPick}
        />
      ) : null}

      <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
        <GripVertical className="size-3.5 shrink-0 text-white/30" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/92">
          {title}
        </p>
      </div>

      <div className="shrink-0">
        <JianyingExportPro2Panel
          nodeId={id}
          data={d}
          connectedCount={snapshot.connectedCount}
          renderedCount={snapshot.renderedCount}
          frames={snapshot.frames}
        />
      </div>
    </div>
  );
}
