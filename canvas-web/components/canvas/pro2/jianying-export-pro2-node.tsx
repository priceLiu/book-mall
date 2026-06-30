"use client";

import { useCallback, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Clapperboard } from "lucide-react";

import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import { collectJianyingFramesFromLibtvVideos } from "@/lib/canvas/jianying-from-workspace";
import { JIANYING_EXPORT_LEFT_ADD_MENU } from "@/lib/canvas/sbv1-add-node-menu";
import { spawnSbv1NeighborFromNode } from "@/lib/canvas/sbv1-spawn-nodes";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  PRO2_CARD_SUBTITLE_CLASS,
  PRO2_CARD_TITLE_CLASS,
  PRO2_NODE_HANDLE_CLASS,
  PRO2_STAGE_BADGE_CLASS,
  pro2NodeBorderColor,
} from "@/lib/canvas/story-pro2-node-chrome";
import type { JianyingExportNodeData } from "@/lib/canvas/types";
import { RF_NODE_DRAG_HANDLE } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";
import { JianyingExportPro2Modal } from "./jianying-export-pro2-modal";

const NODE_BG = "#212121";

/** 2.0 · 导出剪辑节点（画布卡片 · 双击弹出导出面板） */
export function JianyingExportPro2Node({ id, data, selected }: NodeProps) {
  const d = data as unknown as JianyingExportNodeData;
  const [modalOpen, setModalOpen] = useState(false);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);

  const frames = useMemo(
    () => collectJianyingFramesFromLibtvVideos(id, nodes, edges),
    [id, nodes, edges],
  );
  const videoCount = frames.filter((f) => f.videoUrl).length;
  const showSidePlus = Boolean(
    (hovered || selected || connectingFromNodeId) && !modalOpen,
  );

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
  const subtitle =
    videoCount > 0
      ? `已接 ${videoCount} 个视频 · 双击导出`
      : "连接各镜视频以导出";
  const badgeLabel = d.mediaRenderResult?.downloadUrl
    ? "成片就绪"
    : videoCount > 0
      ? "就绪"
      : "待接入";

  return (
    <>
      <div
        className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl"
        style={{
          backgroundColor: NODE_BG,
          border: `1px solid ${pro2NodeBorderColor(!!selected)}`,
        }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setModalOpen(true);
        }}
        title="双击打开导出面板"
      >
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
            sections={JIANYING_EXPORT_LEFT_ADD_MENU}
            onPick={onLeftPick}
          />
        ) : null}

        <div
          className={cn(
            RF_NODE_DRAG_HANDLE,
            "flex shrink-0 cursor-grab items-start justify-between gap-3 px-4 py-3 active:cursor-grabbing",
          )}
        >
          <div className="min-w-0">
            <p className={cn(PRO2_CARD_TITLE_CLASS, "text-[14px]")}>{title}</p>
            <p className={cn(PRO2_CARD_SUBTITLE_CLASS, "mt-1 truncate")}>
              {subtitle}
            </p>
          </div>
          <span className={cn(PRO2_STAGE_BADGE_CLASS, "shrink-0")}>
            {badgeLabel}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-end px-4 pb-4">
          <div className="flex items-center gap-2 text-white/40">
            <Clapperboard className="size-3.5 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              Mac：下载 ZIP → 本地导入剪映
            </p>
          </div>
        </div>
      </div>

      <JianyingExportPro2Modal
        open={modalOpen}
        nodeId={id}
        data={d}
        frames={frames}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
