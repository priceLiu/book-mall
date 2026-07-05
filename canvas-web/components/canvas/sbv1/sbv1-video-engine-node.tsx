"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position, useNodes, useReactFlow } from "@xyflow/react";
import { Maximize2, Play, RefreshCw, Video } from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import { CANVAS_SEMANTIC_STATUS_CLASS } from "@/lib/canvas/canvas-chrome-semantics";
import {
  pickActiveServerInflightTask,
  shouldApplyCanvasTaskRuntimePatch,
  shouldSkipStoryRowTaskApply,
} from "@/lib/canvas/task-pick";
import {
  SBV1_VIDEO_ENGINE_LEFT_ADD_MENU,
  SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU,
} from "@/lib/canvas/sbv1-add-node-menu";
import {
  handleSbv1SideAddNodePick,
  spawnSbv1NeighborFromNode,
} from "@/lib/canvas/sbv1-spawn-nodes";
import { openPro2StyleLibraryForMediaNode } from "@/lib/canvas/pro2-open-style-library";
import { selectLibtvNodeAfterDuplicate } from "@/lib/canvas/select-libtv-node";
import {
  libtvNodeBorderStyle,
  LIBTV_NODE_SIDE_PLUS_LAYER_CLASS,
  LIBTV_NODE_SIDE_PLUS_SIZE,
} from "@/lib/canvas/libtv-node-chrome";
import {
  SBV1_CARD_DRAG_CLASS,
  SBV1_CARD_SHELL_CLASS,
  SBV1_MEDIA_STAGE_CLASS,
  SBV1_NODE_HANDLE_CLASS,
  SBV1_NODE_OUTER_CLASS,
  SBV1_VIDEO_COMPOSE_LABEL,
} from "@/lib/canvas/sbv1-node-chrome";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import type { CanvasNodeRuntime } from "@/lib/canvas/types";
import { resolveLibtvVideoPosterUrl } from "@/lib/canvas/libtv-video-poster";
import { pickTaskResultMediaUrl } from "@/lib/canvas/task-media-url";
import { sbv1VideoPatchFromTask, isSameSbv1MediaDataPatch } from "@/lib/canvas/sbv1-image-task-apply";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { useVideoGeneratingWait } from "@/lib/canvas/use-video-generating-wait";
import { cn } from "@/lib/utils";
import { useLibtvMediaNodeAutoFit } from "@/lib/canvas/libtv-media-node-auto-fit";
import { LazyViewportImage, LazyViewportVideo } from "@/components/canvas/lazy-viewport-media";
import { Pro2MediaNodeEmptyState } from "../pro2/pro2-media-node-empty";
import { LibtvVideoNodeToolbar } from "../libtv-video-node-toolbar";
import { LibtvNodeToolbarPortal } from "../libtv-node-toolbar-portal";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { Pro2NodeSidePlus } from "../pro2/pro2-node-side-plus";
import { LibtvMediaGeneratingState, isLibtvMediaGenerating } from "../libtv-media-generating-state";
import { Pro2CrewTaskStatusBadge } from "../pro2/pro2-crew-task-status-badge";
import { crewNodeShowsParticipatingBadge } from "../libtv-node-header-bar";
import { LibtvNodeErrorBanner } from "../libtv-node-error-banner";
import { useLibtvRuntimeErrorBanner } from "@/lib/canvas/use-libtv-runtime-error-banner";
import {
  useLibtvRuntimeErrorAlert,
  libtvRuntimeErrorAlertTitle,
} from "@/lib/canvas/libtv-runtime-error-alert";

export function Sbv1VideoEngineNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const rfNodes = useNodes();
  const { setNodes: rfSetNodes } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const d = data as unknown as Sbv1VideoEngineNodeData & {
    crewTaskId?: string;
    crewTaskLabel?: string;
  };
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const { succeeded, history } = useNodeTaskHistory(id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);

  const errorBanner = useLibtvRuntimeErrorBanner({
    nodeId: id,
    status: d.runtime?.status,
    taskId: d.runtime?.taskId,
    failCode: d.runtime?.failCode,
    failMessage: d.runtime?.failMessage,
    dismissedFailTaskId: d.runtime?.dismissedFailTaskId,
  });

  useLibtvRuntimeErrorAlert({
    nodeId: id,
    status: d.runtime?.status,
    taskId: d.runtime?.taskId,
    failCode: d.runtime?.failCode,
    failMessage: d.runtime?.failMessage,
    dismissedFailTaskId: d.runtime?.dismissedFailTaskId,
    onAlert: ({ message, failCode }) => {
      void alert({
        title: libtvRuntimeErrorAlertTitle(failCode, message),
        message,
        variant: "error",
        dismissOnly: true,
      });
    },
  });

  const videoUrl =
    d.runtime?.ossUrl ??
    d.runtime?.ephemeralUrl ??
    pickTaskResultMediaUrl(succeeded[succeeded.length - 1] ?? {}) ??
    succeeded[succeeded.length - 1]?.ossUrl ??
    undefined;
  const posterUrl = useMemo(
    () =>
      resolveLibtvVideoPosterUrl({
        nodeId: id,
        runtime: d.runtime,
        latestSucceededTask: succeeded[succeeded.length - 1],
        nodes,
        edges,
      }),
    [id, d.runtime, succeeded, nodes, edges],
  );

  const isGenerating = isLibtvMediaGenerating(d);
  const hasVideo = Boolean(videoUrl);

  const inflightTask = useMemo(
    () => pickActiveServerInflightTask(history, d.runtime?.taskId, d.runtime),
    [
      history,
      d.runtime?.taskId,
      d.runtime?.status,
      d.runtime?.ossUrl,
      d.runtime?.ephemeralUrl,
    ],
  );

  const waitSince =
    inflightTask?.submittedAt ?? inflightTask?.createdAt ?? null;
  const isPending = d.runtime?.status === "pending";
  const { waitHint, isBackground } = useVideoGeneratingWait(
    isGenerating,
    waitSince,
    isPending,
  );

  useEffect(() => {
    if (inflightTask) return;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    const localRt = (node?.data as Sbv1VideoEngineNodeData | undefined)?.runtime;
    const boundId = localRt?.taskId?.trim();
    if (!boundId) return;

    const localSt = localRt?.status;
    if (localSt !== "pending" && localSt !== "running") return;

    const terminal = history.find(
      (t) =>
        t.id === boundId &&
        (t.status === "SUCCEEDED" ||
          t.status === "FAILED" ||
          t.status === "CANCELLED"),
    );
    if (!terminal) return;
    if (shouldSkipStoryRowTaskApply(localRt, terminal, id)) return;

    const nodePatch = sbv1VideoPatchFromTask(terminal);
    if (!nodePatch) return;
    const rtPatch = nodePatch.runtime as Partial<CanvasNodeRuntime> | undefined;
    if (!rtPatch) return;
    if (!shouldApplyCanvasTaskRuntimePatch(localRt, terminal, rtPatch, id)) {
      return;
    }
    if (isSameSbv1MediaDataPatch(node?.data as Record<string, unknown>, nodePatch)) {
      return;
    }
    updateNodeData(id, nodePatch);
  }, [history, id, updateNodeData, inflightTask]);

  /** 乐观 UI 遗留 uploading=true · 任务已终态时清掉并落盘 */
  useEffect(() => {
    if (!d.uploading) return;
    const st = d.runtime?.status;
    if (st !== "done" && st !== "error" && st !== "idle") return;
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    const patch = { uploading: false, uploadError: undefined };
    if (isSameSbv1MediaDataPatch(node?.data as Record<string, unknown>, patch)) {
      return;
    }
    updateNodeData(id, patch);
  }, [d.uploading, d.runtime?.status, id, updateNodeData]);

  const hasToolbarContent = Boolean(
    hasVideo ||
      d.prompt?.trim() ||
      d.refSlots?.some((s) => s.ossUrl || s.blobUrl || s.imageNodeId) ||
      d.runtime?.ossUrl ||
      d.runtime?.ephemeralUrl,
  );
  const soleSelected = useMemo(
    () => selected && rfNodes.filter((n) => n.selected).length === 1,
    [selected, rfNodes],
  );
  const showFloatingToolbar = Boolean(soleSelected && !isGenerating);
  const showToolbar = Boolean(showFloatingToolbar && hasToolbarContent);
  const showSidePlus = Boolean((hovered || selected || connectingFromNodeId) && !isGenerating);

  useLibtvMediaNodeAutoFit({
    nodeId: id,
    mediaUrl: videoUrl,
    posterUrl,
    kind: "video",
    profile: "sbv1-video",
    disabled: !hasVideo || isGenerating,
  });

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
          if (side === "left" && itemId === "style-asset") {
            openPro2StyleLibraryForMediaNode(id);
            return;
          }
          if (side === "left" && (itemId === "image" || nodeType === "sbv1-image")) {
            spawnSbv1NeighborFromNode(id, "left", "sbv1-image", spawnStore);
            return;
          }
          if (
            side === "left" &&
            (itemId === "text" || nodeType === "story-pro2-starter")
          ) {
            spawnSbv1NeighborFromNode(
              id,
              "left",
              "story-pro2-starter",
              spawnStore,
            );
            return;
          }
          if (
            side === "left" &&
            itemId === "video" &&
            nodeType === "sbv1-video-engine"
          ) {
            spawnSbv1NeighborFromNode(
              id,
              "left",
              "sbv1-video-engine",
              spawnStore,
              { connectAsMotionVideo: true },
            );
            return;
          }
          if (
            side === "right" &&
            (itemId === "export" || nodeType === "jianying-export-pro2")
          ) {
            spawnSbv1NeighborFromNode(
              id,
              "right",
              "jianying-export-pro2",
              spawnStore,
            );
            return;
          }
          if (
            side === "right" &&
            (itemId === "video" ||
              itemId === "video-engine" ||
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

  const onDuplicateNode = useCallback(() => {
    const newId = duplicateNode(id, { preserveContent: true });
    if (newId) {
      selectLibtvNodeAfterDuplicate(rfSetNodes, newId, "sbv1-video-engine");
    }
  }, [duplicateNode, id, rfSetNodes]);

  return (
    <>
      <div
        className={SBV1_NODE_OUTER_CLASS}
        data-sbv1-dock-anchor={id}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <Handle
          id="in_text"
          type="target"
          position={Position.Left}
          className={cn(
            SBV1_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : "opacity-100",
          )}
          style={{ top: "22%" }}
          title="文本 / 提示词输入"
        />
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
          style={{ top: "35%" }}
          title="参考图输入"
        />
        <Handle
          id="in_motion_video"
          type="target"
          position={Position.Left}
          className={cn(
            SBV1_NODE_HANDLE_CLASS,
            showSidePlus
              ? "pointer-events-none opacity-0"
              : "opacity-100",
          )}
          style={{ top: "68%" }}
          title="动作视频输入（Motion Control）"
        />
        <Handle
          id="plus_left"
          type="source"
          position={Position.Left}
          className={cn(SBV1_NODE_HANDLE_CLASS, "pointer-events-none opacity-0")}
          style={{ top: "50%" }}
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

        <Pro2NodeSidePlus
          side="left"
          handleId="plus_left"
          handleType="source"
          visible={showSidePlus}
          size={LIBTV_NODE_SIDE_PLUS_SIZE}
          className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
          sections={SBV1_VIDEO_ENGINE_LEFT_ADD_MENU}
          onPick={onSidePick("left")}
        />
        <Pro2NodeSidePlus
          side="right"
          handleId="out_video"
          visible={showSidePlus}
          size={LIBTV_NODE_SIDE_PLUS_SIZE}
          className={LIBTV_NODE_SIDE_PLUS_LAYER_CLASS}
          sections={SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU}
          onPick={onSidePick("right")}
        />

        {showFloatingToolbar ? (
          <LibtvNodeToolbarPortal nodeId={id} visible={showFloatingToolbar}>
            {showToolbar ? (
              <LibtvVideoNodeToolbar
                passNodeDrag
                previewUrl={videoUrl}
                onExpandPreview={() => setPreviewOpen(true)}
                onDuplicateNode={onDuplicateNode}
              />
            ) : (
              <LibtvVideoNodeToolbar
                passNodeDrag
                onDuplicateNode={onDuplicateNode}
              />
            )}
          </LibtvNodeToolbarPortal>
        ) : null}

        <div
          className={cn(
            SBV1_CARD_SHELL_CLASS,
            SBV1_CARD_DRAG_CLASS,
            "min-h-0 flex-1",
          )}
          style={libtvNodeBorderStyle({
            selected: !!selected,
            hovered: hovered && !selected,
            edition: "sbv1",
          })}
        >
          <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Video className="size-3.5 shrink-0 text-white/70" />
              <p className="truncate text-xs font-medium text-white">
                {d.crewTaskLabel?.trim() || SBV1_VIDEO_COMPOSE_LABEL}
              </p>
            </div>
            {crewNodeShowsParticipatingBadge(id, nodes, graphMeta) ? (
              <Pro2CrewTaskStatusBadge nodeId={id} />
            ) : null}
            <div className="relative z-[1] flex shrink-0 items-center gap-1.5">
              {hasVideo ? (
                <button
                  type="button"
                  title="全屏预览"
                  className="nodrag flex size-7 items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewOpen(true);
                  }}
                >
                  <Maximize2 className="size-3.5" />
                </button>
              ) : null}
              {isGenerating ? (
                <RefreshCw className={cn("size-3.5 animate-spin", CANVAS_SEMANTIC_STATUS_CLASS)} />
              ) : null}
            </div>
          </div>

          <div className={cn(SBV1_MEDIA_STAGE_CLASS, "relative")}>
            {isGenerating ? (
              <LibtvMediaGeneratingState
                variant="cyan"
                tone={isBackground ? "background" : "active"}
              >
                {hasVideo ? (
                  posterUrl?.trim() ? (
                    <LazyViewportImage
                      src={posterUrl}
                      alt=""
                      eager
                      className="absolute inset-0"
                      imgClassName="pointer-events-none object-contain opacity-60"
                      rootMargin="280px"
                    />
                  ) : (
                    <LazyViewportVideo
                      src={videoUrl ?? undefined}
                      poster={posterUrl}
                      eager
                      className="absolute inset-0"
                      videoClassName="pointer-events-none object-contain opacity-60"
                      rootMargin="280px"
                    />
                  )
                ) : null}
              </LibtvMediaGeneratingState>
            ) : hasVideo ? (
              <div className="group/video absolute inset-0">
                {posterUrl?.trim() ? (
                  <LazyViewportImage
                    src={posterUrl}
                    alt=""
                    eager
                    className="absolute inset-0"
                    imgClassName="pointer-events-none object-contain"
                    rootMargin="280px"
                  />
                ) : (
                  <LazyViewportVideo
                    src={videoUrl ?? undefined}
                    poster={posterUrl}
                    eager
                    preload="auto"
                    className="absolute inset-0"
                    videoClassName="pointer-events-none object-contain"
                    rootMargin="280px"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <button
                    type="button"
                    aria-label="播放"
                    title="播放视频"
                    className="nodrag pointer-events-auto flex size-20 items-center justify-center rounded-full border border-white/25 bg-black/60 shadow-lg transition-transform group-hover/video:scale-105"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewOpen(true);
                    }}
                  >
                    <Play className="ml-1 size-10 fill-white text-white" />
                  </button>
                </div>
              </div>
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

          <LibtvNodeErrorBanner
            message={errorBanner.message}
            visible={errorBanner.visible}
            onDismiss={errorBanner.dismiss}
          />
          {isGenerating && waitHint ? (
            <p
              className={`border-t border-white/10 px-3 py-1.5 font-mono text-[10px] leading-snug ${
                isBackground ? "text-orange-300/80" : "text-white/45"
              }`}
            >
              {waitHint}
            </p>
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
