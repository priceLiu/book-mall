"use client";

import { useCallback } from "react";
import type { NodeProps } from "@xyflow/react";
import { Box } from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import { PRO2_STYLE_ASSET_RIGHT_MENU } from "@/lib/canvas/pro2-add-node-menu";
import {
  buildPro2GeneralTextNodeData,
  buildPro2ImageNodeData,
} from "@/lib/canvas/pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_STYLE_ASSET_CARD_SHELL_CLASS,
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
  PRO2_NODE_HANDLE_CLASS,
  pro2NodeBorderColor,
} from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryPro2StyleAssetNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { Pro2NodeResizer } from "./pro2-node-resizer";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";

/** 2.0 风格素材节点（LibTV 薄卡 · 无底部 Dock / 检视面板） */
export function StoryPro2StyleAssetNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const d = data as unknown as StoryPro2StyleAssetNodeData;
  const previewUrl = d.imageUrl?.trim() ?? "";
  const headerLabel = d.label?.trim() || `素材-风格-${d.styleName || "未命名"}`;

  const spawnNeighbor = useCallback(
    (nodeType: "story-pro2-starter" | "story-pro2-image") => {
      const self = nodes.find((n) => n.id === id);
      if (!self) return;
      const gap = 48;
      const w = self.width ?? PRO2_IMAGE_NODE_WIDTH;
      const x = self.position.x + w + gap;
      const y = self.position.y;

      if (nodeType === "story-pro2-starter") {
        const newId = addNode(
          "story-pro2-starter",
          { x, y },
          buildPro2GeneralTextNodeData(),
        );
        if (!newId) return;
        setEdges((prev) => [
          ...prev,
          {
            id: `e-${id}-${newId}`,
            source: id,
            target: newId,
            sourceHandle: "style",
            targetHandle: "in_text",
          },
        ]);
        selectPro2NodeAfterSpawn(setNodes, newId);
        return;
      }

      const newId = addNode("story-pro2-image", { x, y }, buildPro2ImageNodeData());
      if (!newId) return;
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${id}-${newId}`,
          source: id,
          target: newId,
          sourceHandle: "style",
          targetHandle: "in_image",
        },
      ]);
      selectPro2NodeAfterSpawn(setNodes, newId);
    },
    [nodes, id, addNode, setNodes, setEdges],
  );

  const onSidePick = useCallback(
    (itemId: string, nodeType?: string) => {
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          if (itemId === "text" || nodeType === "story-pro2-starter") {
            spawnNeighbor("story-pro2-starter");
            return;
          }
          if (itemId === "image" || nodeType === "story-pro2-image") {
            spawnNeighbor("story-pro2-image");
          }
        },
      );
    },
    [spawnNeighbor, alert],
  );

  return (
    <div
      className="relative flex h-full w-full min-h-0 min-w-0 cursor-grab flex-col active:cursor-grabbing"
      data-pro2-style-asset={id}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <Pro2NodeResizer
        isVisible={!!selected}
        minWidth={PRO2_IMAGE_NODE_MIN_WIDTH}
        minHeight={PRO2_IMAGE_NODE_MIN_HEIGHT}
      />

      <Handle
        id="style"
        type="source"
        position={Position.Right}
        className={cn(
          PRO2_NODE_HANDLE_CLASS,
          selected ? "pointer-events-none opacity-0" : "opacity-0 pointer-events-none",
        )}
      />

      <p
        className={cn(
          RF_NODE_DRAG_HANDLE,
          "mb-1.5 flex shrink-0 cursor-grab items-center gap-1.5 px-0.5 text-[11px] text-white/55 active:cursor-grabbing",
        )}
        title="拖动标题栏移动节点"
      >
        <Box className="size-3.5 shrink-0" />
        {headerLabel}
      </p>

      <div className="relative min-h-0 flex-1">
        {selected ? (
          <Pro2NodeSidePlus
            side="right"
            handleId="style"
            visible
            sections={PRO2_STYLE_ASSET_RIGHT_MENU}
            onPick={onSidePick}
          />
        ) : null}

        <div
          className={cn(
            PRO2_STYLE_ASSET_CARD_SHELL_CLASS,
            "relative flex h-full min-h-0 flex-col overflow-hidden transition",
            hovered && !selected && "ring-1 ring-violet-400/30",
          )}
          style={{ borderColor: pro2NodeBorderColor(!!selected) }}
        >
          {previewUrl ? (
            <div className="relative min-h-0 flex-1 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={d.styleName ?? "style"}
                draggable={false}
                className="h-full min-h-[200px] w-full rounded-lg object-cover"
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center text-[11px] text-white/35">
              无预览图
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
