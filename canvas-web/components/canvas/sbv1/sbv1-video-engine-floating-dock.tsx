"use client";

import { memo, useCallback, useMemo } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { buildSbv1DockMentionables } from "@/lib/canvas/sbv1-dock-mentionables";
import { buildPro2DockMentionables } from "@/lib/canvas/pro2-dock-mentionables";
import { resolvePro2VideoBoardCellDockLinks } from "@/lib/canvas/pro2-video-board-dock-links";
import { resolveSbv1VideoEngineInputs } from "@/lib/canvas/resolve-sbv1-video-engine-inputs";
import { resolveSbv1UpstreamRefLinks } from "@/lib/canvas/sbv1-upstream-ref-links";
import { resolveSbv1UpstreamTextLinks } from "@/lib/canvas/sbv1-upstream-text-links";
import { sbv1TextLinksToDockUpstream } from "@/lib/canvas/sbv1-upstream-text-links";
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
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);

  const data = useCanvasStore(
    useCallback(
      (s) => s.nodes.find((n) => n.id === nodeId)?.data as Sbv1VideoEngineNodeData | undefined,
      [nodeId],
    ),
  );

  const nodeData = (data ?? {}) as Sbv1VideoEngineNodeData & {
    pro2MediaRole?: string;
    pro2ControllerNodeId?: string;
  };

  const isPro2VideoBoardCell =
    nodeData.pro2MediaRole === "video" &&
    Boolean(nodeData.pro2ControllerNodeId?.trim());

  const pro2BoardDockLinks = useMemo(
    () =>
      isPro2VideoBoardCell
        ? resolvePro2VideoBoardCellDockLinks(nodeId, nodes, edges)
        : [],
    [isPro2VideoBoardCell, nodeId, nodes, edges],
  );

  const upstreamLinks = useMemo(
    () => resolveSbv1UpstreamRefLinks(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const upstreamTextLinks = useMemo(
    () => resolveSbv1UpstreamTextLinks(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const mentionables = useMemo(() => {
    const items = buildSbv1DockMentionables(upstreamLinks, nodes);
    const pro2Items = buildPro2DockMentionables(pro2BoardDockLinks);
    const seen = new Set(items.map((i) => i.id));
    for (const item of pro2Items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    return items;
  }, [upstreamLinks, nodes, pro2BoardDockLinks]);

  const dockUpstreamForChips = useMemo(() => {
    const textAsDock = sbv1TextLinksToDockUpstream(upstreamTextLinks);
    const seen = new Set<string>();
    const merged = [...pro2BoardDockLinks, ...textAsDock];
    return merged.filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [pro2BoardDockLinks, upstreamTextLinks]);

  const hasVideo = Boolean(
    nodeData.runtime?.ossUrl?.trim() || nodeData.runtime?.ephemeralUrl?.trim(),
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
      dockInputMode: latestData.dockInputMode,
      modelKey: latestData.engine?.modelKey,
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
      upstreamTextLinks={upstreamTextLinks}
      extraDockUpstreamLinks={dockUpstreamForChips}
      mentionables={mentionables}
      isGenerating={isGenerating}
      onPatch={onPatch}
      onRun={onRun}
      placement={placement}
      hidden={hidden}
      sendTitle={
        isPro2VideoBoardCell && hasVideo ? "重新生成视频" : undefined
      }
    />
  );
});
