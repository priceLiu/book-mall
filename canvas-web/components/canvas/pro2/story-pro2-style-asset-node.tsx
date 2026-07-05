"use client";

import { useCallback } from "react";
import type { NodeProps } from "@xyflow/react";
import { Box } from "lucide-react";
import { Handle, Position } from "@xyflow/react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  PRO2_IMAGE_LEFT_ADD_MENU,
  PRO2_STYLE_ASSET_RIGHT_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import {
  buildPro2GeneralTextNodeData,
  buildPro2ImageNodeData,
} from "@/lib/canvas/pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_STYLE_ASSET_CARD_SHELL_CLASS,
  PRO2_IMAGE_NODE_WIDTH,
  PRO2_NODE_HANDLE_CLASS,
  pro2NodeBorderColor,
} from "@/lib/canvas/story-pro2-node-chrome";
import type { StoryPro2StyleAssetNodeData } from "@/lib/canvas/story-pro2-workspace-types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import {
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
  libtvNodeBorderStyle,
} from "@/lib/canvas/libtv-node-chrome";
import { cn } from "@/lib/utils";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import { Pro2ThinNodeToolbar } from "./pro2-thin-node-toolbar";
import { useLibtvNodeDuplicate } from "../libtv-node-header-bar";
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { useCanvasMarqueeSelecting } from "@/lib/canvas/use-canvas-marquee-selecting";
import { Pro2CrewTaskStatusBadge } from "./pro2-crew-task-status-badge";

/** 2.0 风格素材节点（LibTV 薄卡 · 无底部 Dock / 检视面板） */
export function StoryPro2StyleAssetNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);

  const d = data as unknown as StoryPro2StyleAssetNodeData;
  const marqueeSelecting = useCanvasMarqueeSelecting();
  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const showSidePlus = Boolean(
    !marqueeSelecting &&
      (hovered || soleSelected || connectingFromNodeId),
  );
  const onDuplicateNode = useLibtvNodeDuplicate(id, "story-pro2-style-asset");
  const previewUrl = d.imageUrl?.trim() ?? "";
  const headerLabel = d.label?.trim() || `素材-风格-${d.styleName || "未命名"}`;

  const spawnNeighbor = useCallback(
    (
      side: "left" | "right",
      nodeType: "story-pro2-starter" | "story-pro2-image",
    ) => {
      const self = nodes.find((n) => n.id === id);
      if (!self) return;
      const gap = 48;
      const w = self.width ?? PRO2_IMAGE_NODE_WIDTH;
      const x =
        side === "left" ? self.position.x - w - gap : self.position.x + w + gap;
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
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          if (side === "left") {
            if (
              itemId === "txt2img" ||
              itemId === "img2img" ||
              itemId === "image" ||
              nodeType === "story-pro2-image"
            ) {
              spawnNeighbor("left", "story-pro2-image");
            }
            return;
          }
          if (itemId === "text" || nodeType === "story-pro2-starter") {
            spawnNeighbor("right", "story-pro2-starter");
            return;
          }
          if (itemId === "image" || nodeType === "story-pro2-image") {
            spawnNeighbor("right", "story-pro2-image");
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
      <Handle
        id="plus_left"
        type="source"
        position={Position.Left}
        className={cn(PRO2_NODE_HANDLE_CLASS, "pointer-events-none opacity-0")}
      />
      <Handle
        id="style"
        type="source"
        position={Position.Right}
        className={cn(
          PRO2_NODE_HANDLE_CLASS,
          showSidePlus
            ? "pointer-events-none opacity-0"
            : "opacity-0 pointer-events-none",
        )}
      />

      <Pro2NodeSidePlus
        side="left"
        handleId="plus_left"
        visible={showSidePlus}
        size={LIBTV_NODE_SIDE_PLUS_SIZE}
        className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
        sections={PRO2_IMAGE_LEFT_ADD_MENU}
        onPick={onSidePick("left")}
      />
      <Pro2NodeSidePlus
        side="right"
        handleId="style"
        visible={showSidePlus}
        size={LIBTV_NODE_SIDE_PLUS_SIZE}
        className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
        sections={PRO2_STYLE_ASSET_RIGHT_MENU}
        onPick={onSidePick("right")}
      />

      {soleSelected ? (
        <Pro2ThinNodeToolbar style={{ top: -60 }} onDuplicateNode={onDuplicateNode} />
      ) : null}

      <p
        className={cn(
          RF_NODE_DRAG_HANDLE,
          "relative mb-1.5 flex shrink-0 cursor-grab items-center gap-1.5 px-0.5 text-[11px] text-white/55 active:cursor-grabbing",
        )}
        title="拖动标题栏移动节点"
      >
        <Box className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{headerLabel}</span>
        <Pro2CrewTaskStatusBadge nodeId={id} />
      </p>

      <div className="relative min-h-0 flex-1">
        <div
          className={cn(
            PRO2_STYLE_ASSET_CARD_SHELL_CLASS,
            "relative flex h-full min-h-0 flex-col overflow-hidden transition",
          )}
          style={
            libtvNodeBorderStyle({
              selected: !!selected,
              hovered: hovered && !selected,
              edition: "neutral",
            }) ?? { borderColor: pro2NodeBorderColor(!!selected) }
          }
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
