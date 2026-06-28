"use client";

import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  findStoryPro2ScriptHubForStarter,
} from "@/lib/canvas/spawn-story-pro2-workspace";
import type { StoryProStarterNodeData } from "@/lib/canvas/story-pro-workspace-types";
import { resolvePro2TextPurpose } from "@/lib/canvas/pro2-text-purpose";
import {
  pushStoryRevision,
  type StoryTextRevision,
} from "@/lib/canvas/story-revision";
import { Pro2TextNodeOutlineModal } from "./pro2-text-node-outline-modal";

/** 全局挂载 · 避免节点 memo 导致双击编辑状态丢失 */
export function Pro2TextNodeOutlineEditorHost() {
  const editorNodeId = useCanvasStore((s) => s.pro2TextOutlineEditorNodeId);
  const closeEditor = useCanvasStore((s) => s.closePro2TextOutlineEditor);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const node = useMemo(
    () =>
      editorNodeId
        ? nodes.find((n) => n.id === editorNodeId && n.type === "story-pro2-starter")
        : undefined,
    [editorNodeId, nodes],
  );

  const d = (node?.data ?? {}) as StoryProStarterNodeData;
  const outlineMd = d.generatedOutlineMd ?? "";

  const nodeLabel = useMemo(() => {
    if (!node) return "文本节点";
    const starters = nodes.filter((n) => n.type === "story-pro2-starter");
    const idx = starters.findIndex((n) => n.id === node.id);
    return `文本节点 ${idx >= 0 ? idx + 1 : ""}`.trim();
  }, [node, nodes]);

  const textPurpose = useMemo(
    () =>
      node
        ? resolvePro2TextPurpose(d, { nodeId: node.id, nodes, edges })
        : "general",
    [node, d, nodes, edges],
  );
  const isGeneral = textPurpose === "general";

  const persistOutline = useCallback(
    (md: string) => {
      if (!node) return;
      const trimmed = md.trim();
      const history = pushStoryRevision(
        (d.generatedOutlineHistory as StoryTextRevision[] | undefined) ?? [],
        trimmed,
      );
      updateNodeData(node.id, {
        generatedOutlineMd: md,
        generatedOutlineHistory: history,
        ...(isGeneral ? { themeInput: md.slice(0, 8000) } : {}),
      });
      const hub = findStoryPro2ScriptHubForStarter(
        nodes,
        edges,
        node.id,
        d.workspaceIds,
      );
      if (hub) {
        updateNodeData(hub.scriptHubId, { outlineMd: md });
      }
    },
    [node, d.workspaceIds, d.generatedOutlineHistory, nodes, edges, updateNodeData, isGeneral],
  );

  if (!node) return null;
  if (!outlineMd.trim() && !isGeneral) return null;

  return (
    <Pro2TextNodeOutlineModal
      open
      title={`${nodeLabel} · ${isGeneral ? "内容" : "故事大纲"}`}
      value={outlineMd}
      onClose={closeEditor}
      onAutoSave={persistOutline}
    />
  );
}
