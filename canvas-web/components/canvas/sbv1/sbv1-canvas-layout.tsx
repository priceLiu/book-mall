"use client";

import { useCallback, useEffect, useState } from "react";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { CanvasCreditsToastHost } from "@/components/canvas/canvas-credits-toast-host";
import { StyleLibraryModal } from "@/components/canvas/style-library-modal";
import { useCanvasStore } from "@/lib/canvas/store";
import { spawnPro2StyleAssetLeftOfImageFromPreset } from "@/lib/canvas/pro2-spawn-style-asset";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";
import { Sbv1CanvasToolbar } from "./sbv1-canvas-toolbar";

export type Sbv1CanvasLayoutProps = {
  projectId: string;
  onUndo: () => void;
  onRedo: () => void;
};

export function Sbv1CanvasLayout({
  projectId,
  onUndo,
  onRedo,
}: Sbv1CanvasLayoutProps) {
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const styleLibImageNodeId = useCanvasStore((s) => s.pro2StyleLibImageNodeId);
  const setPro2StyleLibImageNodeId = useCanvasStore(
    (s) => s.setPro2StyleLibImageNodeId,
  );

  const getNodes = useCallback(() => useCanvasStore.getState().nodes, []);
  const getEdges = useCallback(() => useCanvasStore.getState().edges, []);

  const [styleLibOpen, setStyleLibOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setStyleLibOpen(true);
    window.addEventListener("canvas:open-pro2-style-library", onOpen);
    return () =>
      window.removeEventListener("canvas:open-pro2-style-library", onOpen);
  }, []);

  const closeStyleLib = useCallback(() => {
    setStyleLibOpen(false);
    setPro2StyleLibImageNodeId(null);
  }, [setPro2StyleLibImageNodeId]);

  const onStylePresetPicked = useCallback(
    (preset: StyleLibraryPreset) => {
      if (!styleLibImageNodeId) {
        closeStyleLib();
        return;
      }
      spawnPro2StyleAssetLeftOfImageFromPreset({
        preset,
        imageNodeId: styleLibImageNodeId,
        addNode,
        setNodes,
        setEdges,
        getNodes,
        getEdges,
        updateNodeData,
      });
      closeStyleLib();
    },
    [
      styleLibImageNodeId,
      closeStyleLib,
      addNode,
      setNodes,
      setEdges,
      getNodes,
      getEdges,
      updateNodeData,
    ],
  );

  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <FlowCanvas
        projectId={projectId}
        onUndo={onUndo}
        onRedo={onRedo}
        forceOnlyRenderVisible
        sbv1Canvas
      />
      <Sbv1CanvasToolbar projectId={projectId} />
      <StyleLibraryModal
        open={styleLibOpen}
        mode="spawn"
        onClose={closeStyleLib}
        onSpawn={onStylePresetPicked}
      />
      <CanvasCreditsToastHost />
    </div>
  );
}
