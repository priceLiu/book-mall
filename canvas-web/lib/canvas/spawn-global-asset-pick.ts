"use client";

import type { GlobalAssetPickItem } from "@/docker-shared/global-asset-library";

import { flowPositionAtScreenPoint, flowPositionAtViewportCenter } from "./viewport-placement";
import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { buildSbv1ImageNodeData, selectSbv1NodeAfterSpawn } from "./sbv1-spawn-nodes";
import type { CanvasFlowNode, CanvasNodeType } from "./types";

type SpawnArgs = {
  edition: "pro2" | "sbv1";
  spawnAtScreen?: { x: number; y: number };
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
};

/** 从 GALD 选用素材 · 在画布生成图片节点 */
export function spawnCanvasNodesFromGlobalAssetPick(
  items: GlobalAssetPickItem[],
  args: SpawnArgs,
): void {
  const nodeType: CanvasNodeType =
    args.edition === "sbv1" ? "sbv1-image" : "story-pro2-image";

  items.forEach((item, index) => {
    const url = item.ossUrl?.trim();
    if (!url) return;

    const fromPlatformCatalog =
      item.catalogKind !== "works" && item.scope === "platform";

    const data =
      args.edition === "sbv1"
        ? buildSbv1ImageNodeData({
            ossUrl: url,
            label: item.title,
            globalCatalogMarked: fromPlatformCatalog,
          })
        : buildPro2ImageNodeData({
            ossUrl: url,
            label: item.title,
            globalCatalogMarked: fromPlatformCatalog,
          });

    const screen = args.spawnAtScreen
      ? {
          x: args.spawnAtScreen.x + index * 48,
          y: args.spawnAtScreen.y + index * 32,
        }
      : undefined;

    const pos = screen
      ? flowPositionAtScreenPoint(nodeType, screen, data)
      : flowPositionAtViewportCenter(nodeType, data);

    const id = args.addNode(nodeType, pos, data);
    if (!id) return;
    if (args.edition === "sbv1") {
      selectSbv1NodeAfterSpawn(args.setNodes, id);
    } else {
      selectPro2NodeAfterSpawn(args.setNodes, id);
    }
  });
}
