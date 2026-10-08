"use client";

import type { OpenAssetLibraryOptions } from "@/docker-shared/global-asset-library/unified-asset-library-types";
import { buildCanvasUnifiedPickOptions } from "@/lib/canvas/open-unified-asset-library-pick";
import type { SpawnProjectAssetActions } from "@/lib/canvas/spawn-project-asset-on-canvas";
import { useCanvasStore } from "@/lib/canvas/store";

type OpenCanvasAssetLibraryArgs = {
  projectId?: string | null;
  baseUrl?: string;
  spawnAtScreen?: { x: number; y: number };
  defaultSection?: OpenAssetLibraryOptions["defaultSection"];
  openAssetLibrary: (options: OpenAssetLibraryOptions) => void;
};

export function getCanvasSpawnProjectAssetActions(): SpawnProjectAssetActions {
  const s = useCanvasStore.getState();
  return {
    getNodes: () => useCanvasStore.getState().nodes,
    addNode: s.addNode,
    addNodeInGroup: s.addNodeInGroup,
    setNodes: s.setNodes,
    setEdges: s.setEdges,
  };
}

/** 画布统一入口：顶栏 / 双击添加节点 · 资产库 */
export function openCanvasAssetLibrary(args: OpenCanvasAssetLibraryArgs) {
  const opts = buildCanvasUnifiedPickOptions({
    projectId: args.projectId,
    spawnAtScreen: args.spawnAtScreen,
    baseUrl: args.baseUrl ?? "",
    actions: getCanvasSpawnProjectAssetActions(),
    maxSelect: 9,
  });
  if (args.defaultSection) {
    opts.defaultSection = args.defaultSection;
  }
  args.openAssetLibrary(opts);
}
