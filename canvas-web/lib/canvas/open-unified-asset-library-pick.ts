"use client";

import type { OpenAssetLibraryOptions } from "@/docker-shared/global-asset-library/unified-asset-library-types";
import { unifiedToGlobalPickItem } from "@/docker-shared/global-asset-library/unified-asset-library-types";
import { spawnCanvasNodesFromGlobalAssetPick } from "@/lib/canvas/spawn-global-asset-pick";
import {
  detectCanvasEditionFromNodes,
  spawnProjectAssetAtViewportCenter,
  type SpawnProjectAssetActions,
} from "@/lib/canvas/spawn-project-asset-on-canvas";
import { useCanvasStore } from "@/lib/canvas/store";

type SpawnAt = { x: number; y: number };

export function buildCanvasUnifiedPickOptions(args: {
  projectId?: string | null;
  spawnAtScreen?: SpawnAt;
  actions: SpawnProjectAssetActions;
  baseUrl?: string;
  maxSelect?: number;
}): OpenAssetLibraryOptions {
  const spawnAtScreen = args.spawnAtScreen ?? {
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
  };
  const base = args.baseUrl ?? "";

  return {
    app: "canvas",
    mode: "pick",
    title: "资产库",
    projectId: args.projectId ?? undefined,
    defaultSection: "shared",
    maxSelect: args.maxSelect ?? 9,
    onPickUnified: async (items) => {
      const edition =
        detectCanvasEditionFromNodes(useCanvasStore.getState().nodes) === "sbv1"
          ? "sbv1"
          : "pro2";
      const catalogLike = items
        .filter((i) => i.insertMode !== "projectAssetInsert")
        .map(unifiedToGlobalPickItem)
        .filter((i) => i.ossUrl?.trim());
      if (catalogLike.length) {
        spawnCanvasNodesFromGlobalAssetPick(catalogLike, {
          edition,
          spawnAtScreen,
          addNode: args.actions.addNode,
          setNodes: args.actions.setNodes,
        });
      }
      for (const item of items.filter((i) => i.insertMode === "projectAssetInsert")) {
        if (!base) continue;
        await spawnProjectAssetAtViewportCenter({
          base,
          assetId: item.id,
          edition,
          actions: args.actions,
        });
      }
    },
  };
}
