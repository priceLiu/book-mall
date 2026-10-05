"use client";

import { memo, useCallback, useMemo } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { JianyingComposeDockPanel } from "@/components/canvas/jianying-compose-dock-panel";
import { collectJianyingLibtvConnectionSnapshot } from "@/lib/canvas/jianying-from-workspace";
import { buildJianyingUpstreamComposeLibraryClips } from "@/lib/canvas/jianying-compose-upstream-assets";
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

  const { hidden } = useLibtvFloatingDock(nodeExists ? dockNodeId : null, {
    minFlowWidth: 0,
    defaultNodeWidth: 720,
    defaultNodeHeight: 840,
  });

  if (suppressDock || !dockNodeId || !nodeExists || hidden) return null;

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

  const composeWorkbench = useMemo(
    () =>
      jianyingSnapshotToWorkbench(
        snapshot.clipSlots
          .filter((s) => s.hasVideo && s.videoUrl)
          .map((s, i) => ({
            sourceNodeId: s.sourceNodeId,
            videoUrl: s.videoUrl!,
            posterUrl: s.posterUrl,
            label: s.label,
            dialogue: s.dialogue,
            audioUrl: snapshot.audioClipSlots[i]?.audioUrl,
          })),
        data?.composeWorkbench ?? null,
      ),
    [snapshot, data?.composeWorkbench],
  );

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

  if (!base || snapshot.renderedCount < 1) return null;

  return (
    <JianyingComposeDockPanel
      base={base}
      projectId={projectId}
      workbench={composeWorkbench}
      upstreamLibraryClips={upstreamLibraryClips}
      onWorkbenchChange={onComposeWorkbenchChange}
    />
  );
});
