"use client";

import { memo, useCallback, useMemo } from "react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { Pro2InputDockShell } from "@/components/canvas/pro2/pro2-input-dock-shell";
import { collectJianyingLibtvConnectionSnapshot } from "@/lib/canvas/jianying-from-workspace";
import {
  JIANYING_AUTO_RENDER_DOCK_FLOW_H,
  JIANYING_AUTO_RENDER_DOCK_FLOW_W,
  JIANYING_AUTO_RENDER_DOCK_PLACEMENT_OPTS,
  JIANYING_AUTO_RENDER_DOCK_SCREEN_W,
} from "@/lib/canvas/jianying-auto-render-dock-placement";
import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingAutoRenderNodeData } from "@/lib/canvas/types";
import {
  useLibtvFloatingDock,
  useLibtvSoleSelectedNodeId,
} from "@/lib/canvas/use-libtv-floating-dock";
import { JianyingMediaRenderActions } from "../jianying-media-render-actions";

/** 2.0 · 自动成片浮动 Dock（800×250 · 恒定屏上尺寸） */
export function JianyingAutoRenderFloatingDock() {
  const dockNodeId = useLibtvSoleSelectedNodeId("jianying-auto-render-pro2");

  const nodeExists = useCanvasStore(
    useCallback(
      (s) => (dockNodeId ? s.nodes.some((n) => n.id === dockNodeId) : false),
      [dockNodeId],
    ),
  );

  const { placement, hidden } = useLibtvFloatingDock(
    nodeExists ? dockNodeId : null,
    JIANYING_AUTO_RENDER_DOCK_PLACEMENT_OPTS,
  );

  if (!dockNodeId || !nodeExists || !placement) return null;

  return (
    <JianyingAutoRenderFloatingDockBody
      key={dockNodeId}
      nodeId={dockNodeId}
      placement={placement}
      hidden={hidden}
    />
  );
}

const JianyingAutoRenderFloatingDockBody = memo(function JianyingAutoRenderFloatingDockBody({
  nodeId,
  placement,
  hidden,
}: {
  nodeId: string;
  placement: NonNullable<ReturnType<typeof useLibtvFloatingDock>["placement"]>;
  hidden: boolean;
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
      ),
    [nodeId, nodes, edges, data?.clipOrderNodeIds],
  );

  const exportFrames = useMemo(
    () =>
      snapshot.frames.map((f) => ({
        ...f,
        dialogue: f.dialogue ?? "",
      })),
    [snapshot.frames],
  );

  const onClipOrderChange = useCallback(
    (orderNodeIds: string[]) => {
      updateNodeData(nodeId, { clipOrderNodeIds: orderNodeIds });
    },
    [nodeId, updateNodeData],
  );

  return (
    <Pro2InputDockShell
      flowAnchor={placement}
      hidden={hidden}
      hideExpand
      flowSize={{
        w: JIANYING_AUTO_RENDER_DOCK_FLOW_W,
        h: JIANYING_AUTO_RENDER_DOCK_FLOW_H,
      }}
      screenWidth={JIANYING_AUTO_RENDER_DOCK_SCREEN_W}
      dockClassName="jianying-auto-render-dock"
    >
      <JianyingMediaRenderActions
        nodeId={nodeId}
        base={base}
        projectId={projectId}
        frames={exportFrames}
        clipSlots={snapshot.clipSlots}
        clipOrderNodeIds={snapshot.orderNodeIds}
        onClipOrderChange={onClipOrderChange}
        persisted={data?.mediaRenderResult}
        inFlight={data?.mediaRenderInFlight}
        spawnPreview={false}
        layout="dock"
        connectedCount={snapshot.connectedCount}
        renderedCount={snapshot.renderedCount}
      />
    </Pro2InputDockShell>
  );
});
