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
import { useLibtvIsNodeSoleSelected } from "@/lib/canvas/libtv-floating-dock-selection";
import { useLibtvMediaNodeAutoFit } from "@/lib/canvas/libtv-media-node-auto-fit";
import { LazyViewportImage, LazyViewportVideo } from "@/components/canvas/lazy-viewport-media";
import { Pro2MediaNodeEmptyState } from "../pro2/pro2-media-node-empty";
import { LibtvVideoNodeToolbar } from "../libtv-video-node-toolbar";
import { LibtvNodeToolbarPortal } from "../libtv-node-toolbar-portal";
import { LibtvEditableNodeTitle } from "../libtv-editable-node-title";
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
import { isMislabeledVendorSuccessError } from "@/lib/canvas/friendly-task-error";
import {
  pro2VideoBoardRowMediaUrl,
  pickPro2VideoBoardRowApplyTask,
  pickPro2VideoBoardRowSucceededTask,
  pro2VideoBoardRowRuntime,
} from "@/lib/canvas/pro2-video-board-cell-task";
import type { StoryProVideoRow } from "@/lib/canvas/story-pro-workspace-types";

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
    pro2MediaRole?: string;
    pro2ControllerNodeId?: string;
    label?: string;
  };
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const isPro2VideoBoardCell =
    d.pro2MediaRole === "video" && Boolean(d.pro2ControllerNodeId?.trim());
  const pro2ControllerNodeId = d.pro2ControllerNodeId?.trim() ?? "";
  const pro2RowKey = (d as { pro2RowKey?: string }).pro2RowKey?.trim() ?? "";

  const { succeeded, history } = useNodeTaskHistory(id);
  const { succeeded: columnSucceeded, history: columnHistory } =
    useNodeTaskHistory(
      isPro2VideoBoardCell && pro2ControllerNodeId
        ? pro2ControllerNodeId
        : null,
    );

  const rowRuntime = useMemo(() => {
    if (!isPro2VideoBoardCell || !pro2ControllerNodeId || !pro2RowKey) {
      return undefined;
    }
    const col = nodes.find((n) => n.id === pro2ControllerNodeId);
    const rows = (col?.data as { rows?: StoryProVideoRow[] } | undefined)?.rows;
    return pro2VideoBoardRowRuntime(rows, pro2RowKey);
  }, [isPro2VideoBoardCell, pro2ControllerNodeId, pro2RowKey, nodes]);

  const rowApplyTask = useMemo(() => {
    if (!isPro2VideoBoardCell || !pro2ControllerNodeId || !pro2RowKey) {
      return undefined;
    }
    return pickPro2VideoBoardRowApplyTask(
      columnHistory,
      pro2ControllerNodeId,
      pro2RowKey,
      d.runtime ?? rowRuntime,
    );
  }, [
    isPro2VideoBoardCell,
    pro2ControllerNodeId,
    pro2RowKey,
    columnHistory,
    d.runtime,
    rowRuntime,
  ]);

  const rowDisplayTask = useMemo(() => {
    if (!isPro2VideoBoardCell || !pro2ControllerNodeId || !pro2RowKey) {
      return undefined;
    }
    return (
      pickPro2VideoBoardRowSucceededTask(
        columnHistory,
        pro2ControllerNodeId,
        pro2RowKey,
      ) ??
      (rowApplyTask?.status !== "FAILED" && rowApplyTask?.status !== "CANCELLED"
        ? rowApplyTask
        : undefined)
    );
  }, [
    isPro2VideoBoardCell,
    pro2ControllerNodeId,
    pro2RowKey,
    columnHistory,
    rowApplyTask,
  ]);

  const rowSucceeded = useMemo(() => {
    if (!isPro2VideoBoardCell) return columnSucceeded;
    return columnSucceeded.filter(
      (t) =>
        t.nodeId === pro2ControllerNodeId &&
        t.storyScope?.rowKey === pro2RowKey &&
        t.storyScope?.mediaKind === "video",
    );
  }, [
    isPro2VideoBoardCell,
    columnSucceeded,
    pro2ControllerNodeId,
    pro2RowKey,
  ]);

  const taskHistory = isPro2VideoBoardCell ? columnHistory : history;
  const taskSucceeded = isPro2VideoBoardCell ? rowSucceeded : succeeded;

  const [previewOpen, setPreviewOpen] = useState(false);
  const { hovered, onPointerEnter, onPointerLeave } = useDelayedPointerHover();
  const connectingFromNodeId = useCanvasStore((s) => s.connectingFromNodeId);

  const latestSucceeded = taskSucceeded[taskSucceeded.length - 1];
  const succeededMediaUrl =
    pickTaskResultMediaUrl(latestSucceeded ?? {}) ??
    latestSucceeded?.ossUrl ??
    undefined;

  const videoUrl =
    succeededMediaUrl ??
    pro2VideoBoardRowMediaUrl({ runtime: d.runtime, task: rowDisplayTask }) ??
    pro2VideoBoardRowMediaUrl({ runtime: rowRuntime, task: rowDisplayTask }) ??
    undefined;
  const hasVideo = Boolean(videoUrl);
  const stageVideoFit: "cover" | "contain" = isPro2VideoBoardCell
    ? "cover"
    : "contain";
  const stageVideoFitClass =
    stageVideoFit === "cover" ? "object-cover" : "object-contain";

  const errorBanner = useLibtvRuntimeErrorBanner({
    nodeId: id,
    status: d.runtime?.status,
    taskId: d.runtime?.taskId,
    failCode: d.runtime?.failCode,
    failMessage: d.runtime?.failMessage,
    dismissedFailTaskId: d.runtime?.dismissedFailTaskId,
    hasMedia: hasVideo,
  });

  useLibtvRuntimeErrorAlert({
    nodeId: id,
    status: d.runtime?.status,
    taskId: d.runtime?.taskId,
    failCode: d.runtime?.failCode,
    failMessage: d.runtime?.failMessage,
    dismissedFailTaskId: d.runtime?.dismissedFailTaskId,
    enabled: !hasVideo && !isMislabeledVendorSuccessError(d.runtime?.failCode, d.runtime?.failMessage),
    onAlert: ({ message, failCode }) => {
      void alert({
        title: libtvRuntimeErrorAlertTitle(failCode, message, "video"),
        message,
        variant: "error",
        dismissOnly: true,
      });
    },
  });

  const posterUrl = useMemo(
    () =>
      resolveLibtvVideoPosterUrl({
        nodeId: id,
        runtime: d.runtime ?? rowRuntime,
        latestSucceededTask:
          rowDisplayTask ??
          taskSucceeded[taskSucceeded.length - 1],
        nodes,
        edges,
      }),
    [id, d.runtime, rowRuntime, rowDisplayTask, taskSucceeded, nodes, edges],
  );

  const nodeEdition = isPro2VideoBoardCell ? "pro2" : "sbv1";
  const defaultVideoTitle = isPro2VideoBoardCell
    ? "分镜视频"
    : SBV1_VIDEO_COMPOSE_LABEL;
  const nodeTitle =
    d.label?.trim() ||
    d.crewTaskLabel?.trim() ||
    defaultVideoTitle;
  const isGenerating = isLibtvMediaGenerating(d) && !hasVideo;

  const inflightTask = useMemo(
    () =>
      pickActiveServerInflightTask(
        taskHistory,
        rowApplyTask?.id ?? d.runtime?.taskId,
        d.runtime ?? rowRuntime,
      ),
    [
      taskHistory,
      rowApplyTask?.id,
      d.runtime,
      rowRuntime,
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

    const terminal = taskHistory.find(
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
  }, [taskHistory, id, updateNodeData, inflightTask]);

  /** 分镜视频组格 · 任务在 video 列上，从列级任务写回子节点 runtime */
  useEffect(() => {
    if (!isPro2VideoBoardCell || !rowApplyTask) return;
    if (
      rowApplyTask.status !== "SUCCEEDED" &&
      rowApplyTask.status !== "FAILED" &&
      rowApplyTask.status !== "CANCELLED"
    ) {
      return;
    }
    const node = useCanvasStore.getState().nodes.find((n) => n.id === id);
    const localRt = (node?.data as Sbv1VideoEngineNodeData | undefined)?.runtime;
    if (
      (rowApplyTask.status === "FAILED" ||
        rowApplyTask.status === "CANCELLED") &&
      (pickPro2VideoBoardRowSucceededTask(
        columnHistory,
        pro2ControllerNodeId,
        pro2RowKey,
      ) ||
        localRt?.ossUrl?.trim() ||
        localRt?.ephemeralUrl?.trim())
    ) {
      return;
    }
    if (shouldSkipStoryRowTaskApply(localRt, rowApplyTask, id)) return;
    const nodePatch = sbv1VideoPatchFromTask(rowApplyTask);
    if (!nodePatch) return;
    const rtPatch = nodePatch.runtime as Partial<CanvasNodeRuntime> | undefined;
    if (!rtPatch) return;
    if (
      !shouldApplyCanvasTaskRuntimePatch(localRt, rowApplyTask, rtPatch, id)
    ) {
      return;
    }
    if (isSameSbv1MediaDataPatch(node?.data as Record<string, unknown>, nodePatch)) {
      return;
    }
    updateNodeData(id, nodePatch);
  }, [
    isPro2VideoBoardCell,
    rowApplyTask,
    id,
    updateNodeData,
    columnHistory,
    pro2ControllerNodeId,
    pro2RowKey,
  ]);

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

  /** 已有成片但 runtime 仍标 error / pending / running · 自动恢复为 done */
  useEffect(() => {
    const st = d.runtime?.status;
    if (
      !hasVideo ||
      (st !== "error" && st !== "pending" && st !== "running")
    ) {
      return;
    }
    const url =
      videoUrl ??
      pro2VideoBoardRowMediaUrl({ runtime: rowRuntime, task: rowDisplayTask });
    if (!url?.trim()) return;
    updateNodeData(id, {
      runtime: {
        ...d.runtime,
        status: "done",
        ossUrl: d.runtime?.ossUrl ?? url,
        ephemeralUrl: d.runtime?.ephemeralUrl,
        failCode: undefined,
        failMessage: undefined,
      },
    });
  }, [
    hasVideo,
    d.runtime,
    id,
    updateNodeData,
    rowDisplayTask,
    rowRuntime,
    videoUrl,
  ]);

  const hasToolbarContent = Boolean(
    hasVideo ||
      d.prompt?.trim() ||
      d.refSlots?.some((s) => s.ossUrl || s.blobUrl || s.imageNodeId) ||
      d.runtime?.ossUrl ||
      d.runtime?.ephemeralUrl,
  );
  const soleSelected = useLibtvIsNodeSoleSelected(id, Boolean(selected));
  const showFloatingToolbar = Boolean(soleSelected && !isGenerating);
  const showToolbar = Boolean(showFloatingToolbar && hasToolbarContent);
  const showSidePlus = Boolean((hovered || selected || connectingFromNodeId) && !isGenerating);

  useLibtvMediaNodeAutoFit({
    nodeId: id,
    mediaUrl: videoUrl,
    posterUrl,
    kind: "video",
    profile: "sbv1-video",
    disabled: isPro2VideoBoardCell || !hasVideo || isGenerating,
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
            (itemId === "auto-render" || nodeType === "jianying-auto-render-pro2")
          ) {
            spawnSbv1NeighborFromNode(
              id,
              "right",
              "jianying-auto-render-pro2",
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
            edition: nodeEdition,
          })}
        >
          <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Video className="size-3.5 shrink-0 text-white/70" />
              <LibtvEditableNodeTitle
                nodeId={id}
                defaultLabel={defaultVideoTitle}
                textClassName="text-xs font-medium text-white"
              />
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
                variant={isPro2VideoBoardCell ? "violet" : "cyan"}
                tone={isBackground ? "background" : "active"}
              >
                {hasVideo ? (
                  posterUrl?.trim() ? (
                    <LazyViewportImage
                      src={posterUrl}
                      alt=""
                      eager
                      className="absolute inset-0"
                      imgClassName={cn("pointer-events-none opacity-60", stageVideoFitClass)}
                      rootMargin="280px"
                    />
                  ) : (
                    <LazyViewportVideo
                      src={videoUrl ?? undefined}
                      poster={posterUrl}
                      eager
                      className="absolute inset-0"
                      videoClassName={cn("pointer-events-none opacity-60", stageVideoFitClass)}
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
                    imgClassName={cn("pointer-events-none", stageVideoFitClass)}
                    rootMargin="280px"
                  />
                ) : (
                  <LazyViewportVideo
                    src={videoUrl ?? undefined}
                    poster={posterUrl}
                    eager
                    preload="auto"
                    className="absolute inset-0"
                    videoClassName={cn("pointer-events-none", stageVideoFitClass)}
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
              <div
                className="absolute inset-0 flex flex-col items-center justify-center px-3 py-4"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Pro2MediaNodeEmptyState
                  icon={Video}
                  label={
                    isPro2VideoBoardCell
                      ? "添加或生成视频"
                      : "选中本节点，在下方编辑 prompt 并生成"
                  }
                  className="min-h-0 pb-0"
                  passNodeDrag
                />
                {isPro2VideoBoardCell && !selected ? (
                  <p className="mt-3 text-[10px] text-white/35">
                    选中节点以编辑提示词
                  </p>
                ) : null}
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
          posterUrl={posterUrl}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
