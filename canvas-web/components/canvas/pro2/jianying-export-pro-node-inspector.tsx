"use client";

import type { NodeProps } from "@xyflow/react";

import { useCanvasStore } from "@/lib/canvas/store";
import type { JianyingExportNodeData } from "@/lib/canvas/types";
import { collectJianyingFramesForExportNode } from "@/lib/canvas/jianying-from-workspace";
import { findStoryPro2WorkspaceForStarter } from "@/lib/canvas/spawn-story-pro2-workspace";
import { resolveStarterForHub } from "@/lib/canvas/story-workspace-resolver";
import { JianyingExportPro2Panel } from "./jianying-export-pro2-panel";

export function JianyingExportPro2Inspector({ id, data }: NodeProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const d = data as unknown as JianyingExportNodeData;

  const starter = d.hubNodeId
    ? resolveStarterForHub(nodes, edges, d.hubNodeId)
    : undefined;
  const stored = (
    starter?.data as {
      workspaceIds?: import("@/lib/canvas/story-pro-workspace-types").StoryPro2WorkspaceIds;
    }
  )?.workspaceIds;
  const ws =
    starter && d.hubNodeId
      ? findStoryPro2WorkspaceForStarter(nodes, edges, starter.id, stored)
      : null;

  const frames = collectJianyingFramesForExportNode(id, nodes, edges, ws);

  return <JianyingExportPro2Panel nodeId={id} data={d} frames={frames} />;
}
