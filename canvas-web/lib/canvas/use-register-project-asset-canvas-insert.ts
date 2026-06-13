"use client";

import { useCallback, useEffect } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { formatCanvasApiError } from "@/lib/canvas-api";
import {
  detectCanvasEditionFromNodes,
  registerProjectAssetCanvasInsert,
  spawnProjectAssetAtViewportCenter,
  spawnProjectAssetOnCanvas,
} from "@/lib/canvas/spawn-project-asset-on-canvas";
import { useCanvasStore } from "@/lib/canvas/store";

export function useRegisterProjectAssetCanvasInsert() {
  const base = useBookMallBaseUrl();
  const { alert } = useDialogs();
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setNodes = useCanvasStore((s) => s.setNodes);

  const spawnActions = useCallback(
    () => ({
      getNodes: () => useCanvasStore.getState().nodes,
      addNode,
      addNodeInGroup,
      setEdges,
      setNodes,
    }),
    [addNode, addNodeInGroup, setEdges, setNodes],
  );

  const insertAtPosition = useCallback(
    async (assetId: string, position: { x: number; y: number }) => {
      if (!base?.trim()) return;
      const edition = detectCanvasEditionFromNodes(
        useCanvasStore.getState().nodes,
      );
      try {
        await spawnProjectAssetOnCanvas({
          base,
          assetId,
          edition,
          position,
          actions: spawnActions(),
        });
      } catch (e) {
        await alert({
          title: "插入失败",
          message: formatCanvasApiError(
            e instanceof Error ? e.message : String(e),
          ),
          variant: "error",
        });
      }
    },
    [alert, base, spawnActions],
  );

  useEffect(() => {
    registerProjectAssetCanvasInsert({ insertAtPosition });
    return () => registerProjectAssetCanvasInsert(null);
  }, [insertAtPosition]);

  const insertAtViewportCenter = useCallback(
    async (assetId: string) => {
      if (!base?.trim()) return;
      const edition = detectCanvasEditionFromNodes(
        useCanvasStore.getState().nodes,
      );
      try {
        await spawnProjectAssetAtViewportCenter({
          base,
          assetId,
          edition,
          actions: spawnActions(),
        });
      } catch (e) {
        await alert({
          title: "插入失败",
          message: formatCanvasApiError(
            e instanceof Error ? e.message : String(e),
          ),
          variant: "error",
        });
      }
    },
    [alert, base, spawnActions],
  );

  return { insertAtViewportCenter };
}
