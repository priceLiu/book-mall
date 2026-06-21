"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDelayedPointerHover } from "@/lib/canvas/use-delayed-pointer-hover";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position, useNodes, useReactFlow } from "@xyflow/react";
import { Maximize2, Play, RefreshCw, Video } from "lucide-react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  runtimePatchFromCanvasTask,
  shouldApplyCanvasTaskRuntimePatch,
  isServerInflightTaskStatus,
} from "@/lib/canvas/task-pick";
import {
  SBV1_VIDEO_ENGINE_LEFT_ADD_MENU,
  SBV1_VIDEO_ENGINE_RIGHT_ADD_MENU,
} from "@/lib/canvas/sbv1-add-node-menu";
import {
  handleSbv1SideAddNodePick,
  spawnSbv1NeighborFromNode,
} from "@/lib/canvas/sbv1-spawn-nodes";
import { selectLibtvNodeAfterDuplicate } from "@/lib/canvas/select-libtv-node";
import {
  SBV1_CARD_DRAG_CLASS,
  SBV1_CARD_SHELL_CLASS,
  SBV1_MEDIA_STAGE_CLASS,
  SBV1_NODE_HANDLE_CLASS,
  SBV1_NODE_OUTER_CLASS,
  SBV1_VIDEO_COMPOSE_LABEL,
  SBV1_VIDEO_ENGINE_MIN_WIDTH,
  SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT,
} from "@/lib/canvas/sbv1-node-chrome";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { useSaveNodeAsAsset } from "@/lib/canvas/use-save-node-as-asset";
import { pickTaskResultMediaUrl } from "@/lib/canvas/task-media-url";
import { useNodeTaskHistory } from "@/lib/canvas/use-node-task-history";
import { cn } from "@/lib/utils";
import { useLibtvMediaNodeAutoFit } from "@/lib/canvas/libtv-media-node-auto-fit";
import { LazyViewportImage, LazyViewportVideo } from "@/components/canvas/lazy-viewport-media";
import { Pro2MediaNodeEmptyState } from "../pro2/pro2-media-node-empty";
import { Pro2ImageNodeToolbar } from "../pro2/pro2-image-node-toolbar";
import { StoryMediaPreviewModal } from "../story-column-media-panel";
import { Pro2NodeResizer } from "../pro2/pro2-node-resizer";
import { Pro2NodeSidePlus } from "../pro2/pro2-node-side-plus";
import { LibtvMediaGeneratingState, isLibtvMediaGenerating } from "../libtv-media-generating-state";
import { LibtvNodeErrorBanner } from "../libtv-node-error-banner";
import { useLibtvRuntimeErrorBanner } from "@/lib/canvas/use-libtv-runtime-error-banner";

export function Sbv1VideoEngineNode({ id, data, selected }: NodeProps) {
  const { alert } = useDialogs();
  const rfNodes = useNodes();
  const { setNodes: rfSetNodes } = useReactFlow();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const d = data as unknown as Sbv1VideoEngineNodeData;
  const saveAsAsset = useSaveNodeAsAsset();
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);
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

  const lastAlertedErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (d.runtime?.status !== "error") return;
    const msg = d.runtime.failMessage?.trim();
    if (!msg) return;
    const sig = `${d.runtime.taskId ?? ""}:${d.runtime.failCode ?? ""}:${msg}`;
    if (lastAlertedErrorRef.current === sig) return;
    lastAlertedErrorRef.current = sig;
    void alert({
      title: "视频生成失败",
      message: msg,
      variant: "error",
    });
  }, [
    alert,
    d.runtime?.status,
    d.runtime?.taskId,
    d.runtime?.failCode,
    d.runtime?.failMessage,
  ]);

  const videoUrl =
    d.runtime?.ossUrl ??
    d.runtime?.ephemeralUrl ??
    pickTaskResultMediaUrl(succeeded[succeeded.length - 1] ?? {}) ??
    succeeded[succeeded.length - 1]?.ossUrl ??
    undefined;
  const posterUrl =
    d.runtime?.posterUrl ??
    succeeded[succeeded.length - 1]?.posterUrl ??
    undefined;

  const isGenerating = isLibtvMediaGenerating(d);
  const hasVideo = Boolean(videoUrl);

  const inflightTask = useMemo(() => {
    const boundId = d.runtime?.taskId;
    if (boundId) {
      const bound = history.find((t) => t.id === boundId);
      if (
        bound &&
        isServerInflightTaskStatus(bound.status)
      ) {
        return bound;
      }
    }
    return history.find(
      (t) => isServerInflightTaskStatus(t.status),
    );
  }, [history, d.runtime?.taskId]);

  useEffect(() => {
    if (!inflightTask) return;
    const patch = runtimePatchFromCanvasTask(inflightTask);
    if (patch?.status === "pending" || patch?.status === "running") {
      setNodeRuntime(id, patch);
    }
  }, [inflightTask, id, setNodeRuntime]);

  /** 任务已在服务端成功但 runtime 仍停在 pending/running（Gateway 已终态 / 刷新 / 轮询竞态） */
  useEffect(() => {
    if (inflightTask) return;
    const boundId = d.runtime?.taskId?.trim();
    const terminal = boundId
      ? history.find((t) => t.id === boundId && t.status === "SUCCEEDED")
      : succeeded[succeeded.length - 1];
    if (!terminal || terminal.status !== "SUCCEEDED") return;
    const patch = runtimePatchFromCanvasTask(terminal);
    if (!patch || patch.status !== "done") return;
    if (!shouldApplyCanvasTaskRuntimePatch(d.runtime, terminal, patch)) return;
    if (
      d.runtime?.status === "done" &&
      (d.runtime.ossUrl || d.runtime.ephemeralUrl)
    ) {
      return;
    }
    setNodeRuntime(id, patch);
  }, [history, succeeded, d.runtime, id, setNodeRuntime, inflightTask]);

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
  const showToolbar = Boolean(soleSelected && hasToolbarContent && !isGenerating);
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
          if (side === "left" && (itemId === "image" || nodeType === "sbv1-image")) {
            spawnSbv1NeighborFromNode(id, "left", "sbv1-image", spawnStore);
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
      <Pro2NodeResizer
        isVisible={Boolean(selected)}
        minWidth={SBV1_VIDEO_ENGINE_MIN_WIDTH}
        minHeight={SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT}
      />
      <div
        className={SBV1_NODE_OUTER_CLASS}
        data-sbv1-dock-anchor={id}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
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

        {showToolbar ? (
          <Pro2ImageNodeToolbar
            passNodeDrag
            minimal
            className="absolute left-1/2 z-40 -translate-x-1/2"
            style={{ top: -60 }}
            previewUrl={videoUrl}
            onExpandPreview={() => setPreviewOpen(true)}
            onSaveAsAsset={() =>
              saveAsAsset(
                id,
                "sbv1-video-engine",
                { ...d, videoUrl } as unknown as Record<string, unknown>,
                "STORYBOARD_VIDEO",
              )
            }
            onDuplicateNode={onDuplicateNode}
          />
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
                <RefreshCw className="size-3.5 animate-spin text-cyan-300" />
              ) : null}
            </div>
          </div>

          <div className={SBV1_MEDIA_STAGE_CLASS}>
            {isGenerating ? (
              <LibtvMediaGeneratingState
                label="视频生成中…"
                variant="cyan"
              />
            ) : hasVideo ? (
              <div className="group/video absolute inset-0">
                {posterUrl?.trim() ? (
                  <LazyViewportImage
                    src={posterUrl}
                    alt=""
                    className="absolute inset-0"
                    imgClassName="pointer-events-none object-contain"
                    rootMargin="280px"
                  />
                ) : (
                  <LazyViewportVideo
                    src={videoUrl ?? undefined}
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
                    className="nodrag pointer-events-auto flex size-20 items-center justify-center rounded-full border border-white/25 bg-black/50 shadow-lg backdrop-blur-sm transition-transform group-hover/video:scale-105"
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
