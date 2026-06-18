"use client";

import { useCallback, useMemo } from "react";
import { useNodes } from "@xyflow/react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { buildSbv1DockMentionables } from "@/lib/canvas/sbv1-dock-mentionables";
import { resolveSbv1VideoEngineInputs } from "@/lib/canvas/resolve-sbv1-video-engine-inputs";
import { refreshSbv1UpstreamPortraitStatuses } from "@/lib/canvas/refresh-sbv1-upstream-portrait";
import { resolveSbv1UpstreamRefLinks } from "@/lib/canvas/sbv1-upstream-ref-links";
import type { Sbv1VideoEngineNodeData } from "@/lib/canvas/sbv1-workspace-types";
import { busEnqueueStoryRun } from "@/lib/canvas/canvas-run-bus";
import { useCanvasStore } from "@/lib/canvas/store";
import { libtvFloatingDockHidden } from "@/lib/canvas/use-viewport-transform-active";
import { useStableLibtvDockFlowPlacement } from "@/lib/canvas/libtv-dock-flow-placement";
import { Sbv1VideoEngineChatInput } from "./sbv1-video-engine-chat-input";
import { useSbv1DockPlacement } from "./use-sbv1-dock-placement";

/** 分镜视频 1.0 · 视频引擎浮动输入坞（选中节点时显示在节点下方） */
export function Sbv1VideoEngineFloatingDock() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const rfNodes = useNodes();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const selectedEngine = useMemo(() => {
    const picked = rfNodes.filter(
      (n) => n.selected && n.type === "sbv1-video-engine",
    );
    return picked.length === 1 ? picked[0] : null;
  }, [rfNodes]);

  const storeNode = useMemo(() => {
    if (!selectedEngine) return null;
    return nodes.find((n) => n.id === selectedEngine.id) ?? null;
  }, [selectedEngine, nodes]);

  const nodeId = storeNode?.id ?? "";
  const dockHidden = useCanvasStore((s) =>
    libtvFloatingDockHidden(
      s.canvasGeometryDragging,
      s.canvasDraggingNodeId,
      nodeId || null,
    ),
  );

  const placement = useStableLibtvDockFlowPlacement(
    useSbv1DockPlacement(selectedEngine?.id ?? null),
  );

  const d = (storeNode?.data ?? {}) as Sbv1VideoEngineNodeData;
  const upstreamLinks = useMemo(
    () => (nodeId ? resolveSbv1UpstreamRefLinks(nodeId, nodes, edges) : []),
    [nodeId, nodes, edges],
  );
  const mentionables = useMemo(() => {
    const storeNode = nodes.find((n) => n.id === nodeId);
    const prompt = (storeNode?.data as { prompt?: string } | undefined)?.prompt ?? "";
    return buildSbv1DockMentionables(upstreamLinks, nodes, prompt);
  }, [upstreamLinks, nodes, nodeId]);

  const isGenerating =
    d.runtime?.status === "pending" || d.runtime?.status === "running";

  const onPatch = useCallback(
    (patch: Partial<Sbv1VideoEngineNodeData>) => {
      if (!nodeId) return;
      updateNodeData(nodeId, patch);
    },
    [nodeId, updateNodeData],
  );

  const onRun = useCallback(async () => {
    const projectId = useCanvasStore.getState().projectId ?? undefined;
    if (base) {
      await refreshSbv1UpstreamPortraitStatuses({
        base,
        engineNodeId: nodeId,
        nodes: useCanvasStore.getState().nodes,
        edges: useCanvasStore.getState().edges,
        updateNodeData,
        projectId,
      });
    }

    const { nodes: latestNodes, edges: latestEdges } = useCanvasStore.getState();
    const storeNode = latestNodes.find((n) => n.id === nodeId);
    const latestData = (storeNode?.data ?? {}) as Sbv1VideoEngineNodeData;
    const prompt = (latestData.prompt ?? "").trim();
    const resolved = resolveSbv1VideoEngineInputs(latestNodes, latestEdges, nodeId, {
      prompt,
      referenceMode: latestData.referenceMode ?? "omni",
    });
    if (!resolved.ok) {
      await alert({
        title: "无法生成",
        message: resolved.error,
        variant: "warning",
      });
      return;
    }
    if (
      latestData.referenceMode === "first_last" &&
      resolved.portraitAssetRefs.length < 1
    ) {
      await alert({
        title: "首尾帧模式",
        message: "请至少连接一张已入库的参考图。",
        variant: "warning",
      });
      return;
    }
    if (!latestData.engine?.providerId?.trim() || !latestData.engine?.modelKey?.trim()) {
      await alert({
        title: "请选择模型",
        message: "请选择火山 Seedance 模型后再生成。",
        variant: "warning",
      });
      return;
    }
    if (!base) {
      await alert({
        title: "画布未就绪",
        message: "请刷新页面后重试。",
        variant: "error",
      });
      return;
    }
    busEnqueueStoryRun({ nodeId, forceFresh: true });
  }, [nodeId, base, alert, updateNodeData]);

  if (!storeNode || !placement) return null;

  return (
    <Sbv1VideoEngineChatInput
      nodeId={nodeId}
      data={d}
      upstreamLinks={upstreamLinks}
      mentionables={mentionables}
      isGenerating={isGenerating}
      onPatch={onPatch}
      onRun={onRun}
      placement={placement}
      hidden={dockHidden}
    />
  );
}
