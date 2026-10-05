"use client";

import { memo, useCallback, useEffect, useMemo } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { JianyingComposeDockPanel } from "@/components/canvas/jianying-compose-dock-panel";
import {
  composeWorkbenchStructuralEquals,
  libtvOrderNodeIdsEqual,
} from "@/lib/canvas/jianying-compose-workbench-sync";
import { jianyingSnapshotClipsForComposeWorkbench } from "@/lib/canvas/jianying-compose-workbench";
import { buildJianyingUpstreamComposeLibraryClips } from "@/lib/canvas/jianying-compose-upstream-assets";
import { collectJianyingLibtvConnectionSnapshot } from "@/lib/canvas/jianying-from-workspace";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingAutoRenderNodeData } from "@/lib/canvas/types";
import {
  useLibtvFloatingDock,
  useLibtvSoleSelectedNodeId,
} from "@/lib/canvas/use-libtv-floating-dock";
import { useLibtvShouldSuppressFloatingDock } from "@/lib/canvas/libtv-floating-dock-selection";
import { jianyingSnapshotToWorkbench } from "@private/platform-compose-ui";

/** 2.0 · 自动成片：仅平台迷你时间线浮窗（合成/下载仍走节点或全屏） */
export function JianyingAutoRenderFloatingDock() {
  const suppressDock = useLibtvShouldSuppressFloatingDock();
  const dockNodeId = useLibtvSoleSelectedNodeId("jianying-auto-render-pro2");

  const nodeExists = useCanvasStore(
    useCallback(
      (s) => (dockNodeId ? s.nodes.some((n) => n.id === dockNodeId) : false),
      [dockNodeId],
    ),
  );

  useLibtvFloatingDock(nodeExists ? dockNodeId : null, {
    minFlowWidth: 0,
    defaultNodeWidth: 720,
    defaultNodeHeight: 840,
  });

  if (suppressDock || !dockNodeId || !nodeExists) return null;

  return <JianyingAutoRenderComposeOverlay key={dockNodeId} nodeId={dockNodeId} />;
}

const JianyingAutoRenderComposeOverlay = memo(function JianyingAutoRenderComposeOverlay({
  nodeId,
}: {
  nodeId: string;
}) {
  const base = useBookMallBaseUrl();
  const projectId = useCanvasStore((s) => s.projectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  const data = useCanvasStore(
    useCallback(
      (s) =>
        s.nodes.find((n) => n.id === nodeId)?.data as
          | JianyingAutoRenderNodeData
          | undefined,
      [nodeId],
    ),
  );

  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const snapshot = useMemo(
    () =>
      collectJianyingLibtvConnectionSnapshot(
        nodeId,
        nodes,
        edges,
        data?.clipOrderNodeIds,
        data?.audioOrderNodeIds,
      ),
    [nodeId, nodes, edges, data?.clipOrderNodeIds, data?.audioOrderNodeIds],
  );

  const composeSnapshotClips = useMemo(
    () => jianyingSnapshotClipsForComposeWorkbench(snapshot),
    [snapshot],
  );

  const composeWorkbench = useMemo(
    () =>
      jianyingSnapshotToWorkbench(
        composeSnapshotClips,
        data?.composeWorkbench ?? null,
      ),
    [composeSnapshotClips, data?.composeWorkbench],
  );

  const composeMiniOpenSeq = useCanvasStore((s) => s.jianyingComposeMiniOpenSeq);
  const requestJianyingComposeMiniOpen = useCanvasStore(
    (s) => s.requestJianyingComposeMiniOpen,
  );

  useEffect(() => {
    if (snapshot.renderedCount >= 1) {
      requestJianyingComposeMiniOpen(nodeId);
    }
  }, [nodeId, snapshot.renderedCount, requestJianyingComposeMiniOpen]);

  const upstreamLibraryClips = useMemo(
    () =>
      buildJianyingUpstreamComposeLibraryClips(
        snapshot.clipSlots,
        snapshot.audioClipSlots,
      ),
    [snapshot.clipSlots, snapshot.audioClipSlots],
  );

  const onComposeWorkbenchChange = useCallback(
    (next: typeof composeWorkbench) => {
      updateNodeData(nodeId, { composeWorkbench: next });
    },
    [nodeId, updateNodeData],
  );

  useEffect(() => {
    const orderStale =
      !libtvOrderNodeIdsEqual(data?.clipOrderNodeIds, snapshot.orderNodeIds) ||
      !libtvOrderNodeIdsEqual(data?.audioOrderNodeIds, snapshot.audioOrderNodeIds);
    const workbenchStale = !composeWorkbenchStructuralEquals(
      composeWorkbench,
      data?.composeWorkbench,
    );
    if (!orderStale && !workbenchStale) return;
    const snapVideoSet = new Set(snapshot.orderNodeIds);
    const snapAudioSet = new Set(snapshot.audioOrderNodeIds);
    const clipOrderNodeIds = [
      ...composeWorkbench.orderedClipIds.filter((id) => snapVideoSet.has(id)),
      ...snapshot.orderNodeIds.filter(
        (id) => !composeWorkbench.orderedClipIds.includes(id),
      ),
    ];
    const wbAudio = composeWorkbench.orderedAudioClipIds ?? [];
    const audioOrderNodeIds = [
      ...wbAudio.filter((id) => snapAudioSet.has(id)),
      ...snapshot.audioOrderNodeIds.filter((id) => !wbAudio.includes(id)),
    ];
    updateNodeData(nodeId, {
      composeWorkbench,
      clipOrderNodeIds,
      audioOrderNodeIds,
    });
  }, [
    composeWorkbench,
    data?.audioOrderNodeIds,
    data?.clipOrderNodeIds,
    data?.composeWorkbench,
    nodeId,
    snapshot.audioOrderNodeIds,
    snapshot.orderNodeIds,
    updateNodeData,
  ]);

  if (!base || snapshot.renderedCount < 1) return null;

  return (
    <JianyingComposeDockPanel
      base={base}
      projectId={projectId}
      nodeId={nodeId}
      workbench={composeWorkbench}
      snapshot={snapshot}
      upstreamLibraryClips={upstreamLibraryClips}
      composeMiniOpenSeq={composeMiniOpenSeq}
      onWorkbenchChange={onComposeWorkbenchChange}
    />
  );
});
