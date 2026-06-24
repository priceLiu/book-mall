"use client";

import { memo, useCallback, useMemo } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { buildSbv1DockMentionables } from "@/lib/canvas/sbv1-dock-mentionables";
import { resolveSbv1VideoEngineInputs } from "@/lib/canvas/resolve-sbv1-video-engine-inputs";
import { resolveSbv1UpstreamRefLinks } from "@/lib/canvas/sbv1-upstream-ref-links";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import {
  optimisticLibtvMediaRunStart,
  revertOptimisticLibtvMediaRunStart,
} from "@/lib/canvas/libtv-image-node-run";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  useLibtvFloatingDock,
  useLibtvSoleSelectedNodeId,
} from "@/lib/canvas/use-libtv-floating-dock";
import { SBV1_VIDEO_DOCK_PLACEMENT_OPTS } from "@/lib/canvas/sbv1-video-dock-placement";
import { Sbv1VideoEngineChatInput } from "./sbv1-video-engine-chat-input";

/** 分镜视频 1.0 · 视频引擎浮动输入坞（选中节点时显示在节点下方） */
export function Sbv1VideoEngineFloatingDock() {
  const dockNodeId = useLibtvSoleSelectedNodeId("sbv1-video-engine");

  const nodeExists = useCanvasStore(
    useCallback(
      (s) => (dockNodeId ? s.nodes.some((n) => n.id === dockNodeId) : false),
      [dockNodeId],
    ),
  );

  const { placement, hidden } = useLibtvFloatingDock(
    nodeExists ? dockNodeId : null,
    SBV1_VIDEO_DOCK_PLACEMENT_OPTS,
  );

  if (!dockNodeId || !nodeExists || !placement) return null;

  return (
    <Sbv1VideoEngineFloatingDockBody
      key={dockNodeId}
      nodeId={dockNodeId}
      placement={placement}
      hidden={hidden}
    />
  );
}

const Sbv1VideoEngineFloatingDockBody = memo(function Sbv1VideoEngineFloatingDockBody({
  nodeId,
  placement,
  hidden,
}: {
  nodeId: string;
  placement: NonNullable<ReturnType<typeof useLibtvFloatingDock>["placement"]>;
  hidden: boolean;
}) {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);

  const data = useCanvasStore(
    useCallback(
      (s) => s.nodes.find((n) => n.id === nodeId)?.data as Sbv1VideoEngineNodeData | undefined,
      [nodeId],
    ),
  );

  const nodeData = (data ?? {}) as Sbv1VideoEngineNodeData;

  const upstreamLinks = useMemo(
    () => resolveSbv1UpstreamRefLinks(nodeId, useCanvasStore.getState().nodes, edges),
    [nodeId, edges],
  );

  const mentionables = useMemo(
    () => buildSbv1DockMentionables(upstreamLinks, useCanvasStore.getState().nodes),
    [upstreamLinks],
  );

  const isGenerating =
    nodeData.runtime?.status === "pending" || nodeData.runtime?.status === "running";

  const onPatch = useCallback(
    (patch: Partial<Sbv1VideoEngineNodeData>) => {
      updateNodeData(nodeId, patch);
    },
    [nodeId, updateNodeData],
  );

  const onRun = useCallback(async () => {
    // 点击即响应：先同步写入乐观「生成中」，再让浏览器绘制一帧，
    // 然后才跑上游解析 / 校验 / 入队（这些在大画布上可能是几十~上百 ms 的同步开销，
    // 放到首帧绘制之后，保证转圈第一时间出现）。
    optimisticLibtvMediaRunStart(nodeId, updateNodeData, setNodeRuntime);

    const revertPending = () =>
      revertOptimisticLibtvMediaRunStart(nodeId, updateNodeData, setNodeRuntime);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const { nodes: latestNodes, edges: latestEdges } = useCanvasStore.getState();
    const storeNode = latestNodes.find((n) => n.id === nodeId);
    const latestData = (storeNode?.data ?? {}) as Sbv1VideoEngineNodeData;

    const prompt = (latestData.prompt ?? "").trim();
    const resolved = resolveSbv1VideoEngineInputs(latestNodes, latestEdges, nodeId, {
      prompt,
      referenceMode: latestData.referenceMode ?? "omni",
    });
    if (!resolved.ok) {
      revertPending();
      await alert({
        title: "无法生成",
        message: resolved.error,
        variant: "warning",
      });
      return;
    }
    if (
      latestData.referenceMode === "first_last" &&
      resolved.portraitAssetRefs.length < 1 &&
      resolved.imageInputs.length < 1
    ) {
      revertPending();
      await alert({
        title: "首尾帧模式",
        message: "请至少连接一张参考图（已入库或未入库均可）。",
        variant: "warning",
      });
      return;
    }
    if (!latestData.engine?.providerId?.trim() || !latestData.engine?.modelKey?.trim()) {
      revertPending();
      await alert({
        title: "请选择模型",
        message: "请选择火山 Seedance 模型后再生成。",
        variant: "warning",
      });
      return;
    }
    if (!base) {
      revertPending();
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    busEnqueueStoryRun({ nodeId, forceFresh: true });
  }, [nodeId, base, alert, updateNodeData, setNodeRuntime]);

  return (
    <Sbv1VideoEngineChatInput
      key={nodeId}
      nodeId={nodeId}
      data={nodeData}
      upstreamLinks={upstreamLinks}
      mentionables={mentionables}
      isGenerating={isGenerating}
      onPatch={onPatch}
      onRun={onRun}
      placement={placement}
      hidden={hidden}
    />
  );
});
