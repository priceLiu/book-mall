"use client";

import { useCallback, useState, type MouseEvent } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Clapperboard, Maximize2, Play } from "lucide-react";

import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import {
  libtvNodeBorderStyle,
  LIBTV_INPUT_DOCK_BG,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
} from "@/lib/canvas/libtv-node-chrome";
import { useLibtvMediaNodeAutoFit } from "@/lib/canvas/libtv-media-node-auto-fit";
import { JIANYING_AUTO_RENDER_LEFT_ADD_MENU } from "@/lib/canvas/sbv1-add-node-menu";
import { spawnSbv1NeighborFromNode } from "@/lib/canvas/sbv1-spawn-nodes";
import {
  SBV1_CARD_DRAG_CLASS,
  SBV1_CARD_SHELL_CLASS,
  SBV1_MEDIA_STAGE_CLASS,
  SBV1_NODE_HANDLE_CLASS,
  SBV1_NODE_OUTER_CLASS,
} from "@/lib/canvas/sbv1-node-chrome";
import { isMediaRenderJobInflight } from "@/lib/canvas/media-render-in-flight";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingAutoRenderNodeData } from "@/lib/canvas/types";
import { RF_NO_DRAG } from "@/lib/canvas/react-flow-classes";
import { cn } from "@/lib/utils";
import { LazyViewportImage, LazyViewportVideo } from "../lazy-viewport-media";
import { LibtvMediaGeneratingState } from "../libtv-media-generating-state";
import { useMediaRenderCancel } from "@/lib/canvas/use-media-render-cancel";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { Pro2NodeSidePlus } from "./pro2-node-side-plus";

/** 2.0 · 自动成片：媒体卡 + 浮动 Dock（云端剪辑） */
export function JianyingAutoRenderPro2Node({ id, data, selected }: NodeProps) {
  const d = data as unknown as JianyingAutoRenderNodeData;
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const [previewOpen, setPreviewOpen] = useState(false);

  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);

  const renderInFlight = isMediaRenderJobInflight(d.mediaRenderInFlight);
  // 本地成片先写 videoUrl；勿被旧的 mediaRenderResult.downloadUrl（OSS）挡住刷新
  const videoUrl =
    d.videoUrl?.trim() || d.mediaRenderResult?.downloadUrl?.trim() || "";
  const posterUrl =
    d.posterUrl?.trim() || d.mediaRenderResult?.posterUrl?.trim() || undefined;
  const hasVideo = Boolean(videoUrl);
  /**
   * 扫光：剪辑进行中且尚未拿到本地成片（progressLabel 非空）。
   * 本地成片就绪后 Dock 仍可显示「云端同步中」，节点结束扫光并刷新预览。
   */
  const ffmpegPhase =
    renderInFlight &&
    (Boolean(d.mediaRenderInFlight?.progressLabel?.trim()) || !hasVideo);
  const title = d.label?.trim() || "自动成片";
  const { requestCancel: requestMediaRenderCancel } = useMediaRenderCancel(id);
  const showSidePlus = Boolean(hovered || selected || connectingFromNodeId);
  const stageVideoFitClass = "object-contain";

  useLibtvMediaNodeAutoFit({
    nodeId: id,
    mediaUrl: videoUrl || undefined,
    posterUrl,
    kind: "video",
    profile: "sbv1-video",
    disabled: ffmpegPhase || !hasVideo,
  });

  const onLeftPick = useCallback(
    (itemId: string, nodeType?: string) => {
      if (itemId !== "video" && nodeType !== "sbv1-video-engine") return;
      const s = useCanvasStore.getState();
      spawnSbv1NeighborFromNode(id, "left", "sbv1-video-engine", {
        nodes: s.nodes,
        edges: s.edges,
        addNode: s.addNode,
        addNodeInGroup: s.addNodeInGroup,
        setNodes: s.setNodes,
        setEdges: s.setEdges,
      });
    },
    [id],
  );

  const openPreview = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setPreviewOpen(true);
  }, []);

  const borderStyle = libtvNodeBorderStyle({
    selected: !!selected,
    hovered: hovered && !selected,
    edition: "sbv1",
  });

  return (
    <>
      <div
        className={SBV1_NODE_OUTER_CLASS}
        data-sbv1-dock-anchor={id}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <Handle
          id="in_video"
          type="target"
          position={Position.Left}
          className={cn(
            SBV1_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : selected
                ? "opacity-100"
                : "pointer-events-none opacity-0",
          )}
          title="各镜视频"
        />
        <Pro2NodeSidePlus
          side="left"
          handleId="plus_left"
          visible={showSidePlus}
          size={LIBTV_NODE_SIDE_PLUS_SIZE}
          className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
          sections={JIANYING_AUTO_RENDER_LEFT_ADD_MENU}
          onPick={onLeftPick}
        />

        <div
          className={cn(
            SBV1_CARD_SHELL_CLASS,
            SBV1_CARD_DRAG_CLASS,
            "min-h-0 flex-1",
          )}
          style={borderStyle}
        >
          <div className="relative flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
            <Clapperboard className="size-3.5 shrink-0 text-white/70" />
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-white">
              {title}
            </p>
            {hasVideo ? (
              <button
                type="button"
                className={cn(
                  RF_NO_DRAG,
                  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white/80",
                )}
                onClick={openPreview}
                title="全屏预览"
              >
                <Maximize2 className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div
            className={cn(SBV1_MEDIA_STAGE_CLASS, "group/stage relative")}
            style={{ backgroundColor: LIBTV_INPUT_DOCK_BG }}
          >
            {ffmpegPhase ? (
              <LibtvMediaGeneratingState
                variant="cyan"
                onCancel={() => void requestMediaRenderCancel()}
              />
            ) : hasVideo ? (
              <div className="group/video absolute inset-0">
                {posterUrl ? (
                  <LazyViewportImage
                    src={posterUrl}
                    alt=""
                    eager
                    className="absolute inset-0"
                    imgClassName={cn("pointer-events-none", stageVideoFitClass)}
                    rootMargin="280px"
                  />
                ) : (
                  <LazyViewportVideo
                    src={videoUrl}
                    poster={posterUrl}
                    eager
                    preload="metadata"
                    className="absolute inset-0"
                    videoClassName={cn("pointer-events-none", stageVideoFitClass)}
                    rootMargin="280px"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <button
                    type="button"
                    aria-label="播放成片"
                    title="播放成片"
                    className={cn(
                      RF_NO_DRAG,
                      "pointer-events-auto flex size-20 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/60 shadow-lg transition-transform group-hover/video:scale-105",
                    )}
                    onClick={openPreview}
                  >
                    <Play className="ml-1 size-10 fill-white text-white" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[400px] items-center justify-center px-4 text-center text-[12px] text-white/40">
                接入视频后，选中节点并在下方 Dock 点击「自动剪辑成片」
              </div>
            )}
          </div>
        </div>
      </div>

      {previewOpen && hasVideo ? (
        <StoryMediaPreviewModal
          url={videoUrl}
          kind="video"
          title={title}
          posterUrl={posterUrl}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
