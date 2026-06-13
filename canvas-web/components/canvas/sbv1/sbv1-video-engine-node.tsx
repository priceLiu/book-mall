"use client";

import { useCallback, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Loader2, Maximize2, Video } from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  SBV1_VIDEO_ENGINE_LEFT_ADD_MENU,
  SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU,
} from "@/lib/canvas/sbv1-add-node-menu";
import {
  handleSbv1SideAddNodePick,
  spawnSbv1NeighborFromNode,
} from "@/lib/canvas/sbv1-spawn-nodes";
import {
  SBV1_CARD_DRAG_CLASS,
  SBV1_CARD_SHELL_CLASS,
  SBV1_NODE_HANDLE_CLASS,
  SBV1_NODE_OUTER_CLASS,
  SBV1_VIDEO_COMPOSE_LABEL,
  SBV1_VIDEO_ENGINE_MIN_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "@/lib/canvas/sbv1-node-chrome";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { pickTaskResultMediaUrl } from "@/lib/canvas/task-media-url";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { cn } from "@/lib/utils";
import { Pro2MediaNodeEmptyState } from "../pro2/pro2-media-node-empty";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { Pro2NodeResizer } from "../pro2/pro2-node-resizer";
import { Pro2NodeSidePlus } from "../pro2/pro2-node-side-plus";

export function Sbv1VideoEngineNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const d = data as unknown as Sbv1VideoEngineNodeData;
  const self = nodes.find((n) => n.id === id);
  const insideGroup = Boolean(self?.parentId);
  const { succeeded } = useNodeTaskHistory(id);
  const [previewOpen, setPreviewOpen] = useState(false);

  const videoUrl =
    d.runtime?.ossUrl ??
    d.runtime?.ephemeralUrl ??
    pickTaskResultMediaUrl(succeeded[succeeded.length - 1] ?? {}) ??
    succeeded[succeeded.length - 1]?.ossUrl;

  const isGenerating =
    d.runtime?.status === "running" || d.runtime?.status === "pending";
  const hasVideo = Boolean(videoUrl);
  const showSidePlus = Boolean(selected && !isGenerating);

  const spawnStore = useMemo(
    () => ({ nodes, edges, addNode, addNodeInGroup, setNodes, setEdges }),
    [nodes, edges, addNode, addNodeInGroup, setNodes, setEdges],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handleSbv1SideAddNodePick(
        itemId,
        nodeType,
        alert,
        () => {
          if (side === "left" && (itemId === "image" || nodeType === "sbv1-image")) {
            spawnSbv1NeighborFromNode(id, "left", "sbv1-image", spawnStore);
            return;
          }
          if (
            side === "right" &&
            (itemId === "video-engine" ||
              itemId === "video-compose" ||
              nodeType === "sbv1-video-engine")
          ) {
            spawnSbv1NeighborFromNode(
              id,
              "right",
              "sbv1-video-engine",
              spawnStore,
            );
          }
        },
      );
    },
    [id, spawnStore, alert],
  );

  return (
    <>
      <Pro2NodeResizer
        isVisible={Boolean(selected && !insideGroup)}
        minWidth={SBV1_VIDEO_ENGINE_WIDTH}
        minHeight={SBV1_VIDEO_ENGINE_MIN_HEIGHT}
      />
      <div
        className={SBV1_NODE_OUTER_CLASS}
        data-sbv1-dock-anchor={id}
        style={{
          width: SBV1_VIDEO_ENGINE_WIDTH,
          minWidth: SBV1_VIDEO_ENGINE_WIDTH,
          minHeight: SBV1_VIDEO_ENGINE_MIN_HEIGHT,
        }}
      >
        <Handle
          id="in_ref"
          type="target"
          position={Position.Left}
          className={cn(
            SBV1_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : "opacity-100",
          )}
          title="参考图输入"
        />
        <Handle
          id="out_video"
          type="source"
          position={Position.Right}
          className={cn(
            SBV1_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : selected
                ? "opacity-100"
                : "pointer-events-none opacity-0",
          )}
          title={`串联下一${SBV1_VIDEO_COMPOSE_LABEL}`}
        />

        {showSidePlus ? (
          <>
            <Pro2NodeSidePlus
              side="left"
              handleId="plus_left"
              handleType="source"
              visible
              className="z-[60] -left-5"
              sections={SBV1_VIDEO_ENGINE_LEFT_ADD_MENU}
              onPick={onSidePick("left")}
            />
            <Pro2NodeSidePlus
              side="right"
              handleId="out_video"
              visible
              className="z-[60] -right-5"
              sections={SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU}
              onPick={onSidePick("right")}
            />
          </>
        ) : null}

        <div
          className={cn(
            SBV1_CARD_SHELL_CLASS,
            SBV1_CARD_DRAG_CLASS,
            "min-h-0 flex-1",
            selected && "ring-1 ring-cyan-400/50",
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <Video className="size-3.5 text-cyan-300" />
              <p className="text-xs font-medium text-white">{SBV1_VIDEO_COMPOSE_LABEL}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {hasVideo ? (
                <button
                  type="button"
                  title="全屏预览"
                  className="nodrag rounded p-1 text-white/45 transition hover:bg-white/10 hover:text-white/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewOpen(true);
                  }}
                >
                  <Maximize2 className="size-3.5" />
                </button>
              ) : null}
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin text-cyan-300" />
              ) : null}
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-black/40">
            {isGenerating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 py-10 text-center text-xs text-white/40">
                <Loader2 className="size-6 animate-spin text-cyan-300/70" />
                <span>视频生成中…</span>
              </div>
            ) : hasVideo ? (
              <video
                src={videoUrl ?? undefined}
                className="absolute inset-0 size-full object-contain"
                controls
                playsInline
                muted
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-3 py-4">
                <Pro2MediaNodeEmptyState
                  icon={Video}
                  label="选中本节点，在下方编辑 prompt 并生成"
                  className="min-h-0 pb-0"
                  passNodeDrag
                />
              </div>
            )}
          </div>

          {d.runtime?.status === "error" && d.runtime.failMessage ? (
            <div className="nodrag shrink-0 border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              {d.runtime.failMessage}
            </div>
          ) : null}
        </div>
      </div>
      {previewOpen && videoUrl ? (
        <StoryMediaPreviewModal
          url={videoUrl}
          kind="video"
          title={SBV1_VIDEO_COMPOSE_LABEL}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
