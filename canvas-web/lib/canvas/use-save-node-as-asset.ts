"use client";

import { useCallback, useMemo } from "react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { openSaveProjectAssetDialog } from "@/components/canvas/save-project-asset-dialog";
import {
  exportNodeToProjectAssetDraft,
  type ExportNodeContext,
} from "@/lib/canvas/project-asset-export";
import { collectGroupChildNodesForAssetExport } from "@/lib/canvas/project-asset-group-children";
import type { ProjectAssetKind } from "@/lib/canvas/project-asset-types";
import type { CanvasProjectEdition } from "@/lib/canvas/project-edition-detect";
import {
  isSbv1PipelineNodeType,
  isStoryPro2PipelineNodeType,
  isStoryProPipelineNodeType,
} from "@/lib/canvas/project-edition-detect";
import { useCanvasStore } from "@/lib/canvas/store";

function detectEditionFromNodes(
  nodes: { type?: string }[],
): CanvasProjectEdition {
  for (const n of nodes) {
    if (isSbv1PipelineNodeType(n.type ?? "")) return "sbv1";
  }
  for (const n of nodes) {
    if (isStoryPro2PipelineNodeType(n.type ?? "")) return "pro2";
  }
  for (const n of nodes) {
    if (isStoryProPipelineNodeType(n.type ?? "")) return "pro";
  }
  return "standard";
}

export function useSaveNodeAsAsset() {
  const { alert } = useDialogs();
  const projectId = useCanvasStore((s) => s.projectId) ?? "";
  const nodes = useCanvasStore((s) => s.nodes);
  const edition = useMemo(() => detectEditionFromNodes(nodes), [nodes]);

  return useCallback(
    (
      nodeId: string,
      nodeType: string,
      data: Record<string, unknown>,
      kindOverride?: ProjectAssetKind,
    ) => {
      if (!projectId) {
        void alert({
          title: "无法保存",
          message: "请先进入已保存的画布项目后再保存为资产。",
          variant: "warning",
        });
        return;
      }
      const live = nodes.find((n) => n.id === nodeId)?.data;
      const nodeData =
        live && typeof live === "object"
          ? (live as Record<string, unknown>)
          : data;
      try {
        openSaveProjectAssetDialog(
          exportNodeToProjectAssetDraft(
            {
              projectId,
              edition,
              nodeId,
              nodeType,
              data: nodeData,
            } satisfies ExportNodeContext,
            kindOverride,
          ),
        );
      } catch (e) {
        void alert({
          title: "无法打开保存对话框",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      }
    },
    [alert, edition, nodes, projectId],
  );
}

export function useSaveGroupAsAsset() {
  const { alert } = useDialogs();
  const projectId = useCanvasStore((s) => s.projectId) ?? "";
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const edition = useMemo(() => detectEditionFromNodes(nodes), [nodes]);

  return useCallback(
    (groupId: string, groupData: Record<string, unknown>) => {
      if (!projectId) {
        void alert({
          title: "无法保存",
          message: "请先进入已保存的画布项目后再保存为资产。",
          variant: "warning",
        });
        return;
      }
      const childNodes = collectGroupChildNodesForAssetExport(groupId, nodes);
      const childIds = new Set(childNodes.map((n) => n.id));
      try {
        openSaveProjectAssetDialog(
          exportNodeToProjectAssetDraft({
            projectId,
            edition,
            nodeId: groupId,
            nodeType: "group",
            data: groupData,
            groupChildren: childNodes.map((n) => {
              const live = nodes.find((node) => node.id === n.id) ?? n;
              return {
                id: live.id,
                type: live.type ?? "",
                position: live.position,
                data: (live.data ?? {}) as Record<string, unknown>,
              };
            }),
            groupEdges: edges
              .filter((e) => childIds.has(e.source) && childIds.has(e.target))
              .map((e) => ({ id: e.id, source: e.source, target: e.target })),
          }),
        );
      } catch (e) {
        void alert({
          title: "无法打开保存对话框",
          message: e instanceof Error ? e.message : String(e),
          variant: "error",
        });
      }
    },
    [alert, edition, edges, nodes, projectId],
  );
}
