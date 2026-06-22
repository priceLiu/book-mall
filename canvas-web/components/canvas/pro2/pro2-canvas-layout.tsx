"use client";

import { useCallback, useEffect, useState } from "react";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { CanvasBackgroundVideoPanel } from "@/components/canvas/canvas-background-video-panel";
import { CanvasCreditsToastHost } from "@/components/canvas/canvas-credits-toast-host";
import { StyleLibraryModal } from "@/components/canvas/style-library-modal";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  spawnPro2StyleAssetFromPreset,
  spawnPro2StyleAssetLeftOfImageFromPreset,
} from "@/lib/canvas/pro2-spawn-style-asset";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";
import { Pro2CanvasToolbar } from "./pro2-canvas-toolbar";

export type Pro2CanvasLayoutProps = {
  projectId: string;
  onUndo: () => void;
  onRedo: () => void;
};

export function Pro2CanvasLayout({
  projectId,
  onUndo,
  onRedo,
}: Pro2CanvasLayoutProps) {
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
      if (styleLibImageNodeId) {
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
        return;
      }
      spawnPro2StyleAssetFromPreset({
        preset,
        addNode,
        setNodes,
        setEdges,
        getNodes,
      });
      closeStyleLib();
    },
    [
      styleLibImageNodeId,
      updateNodeData,
      closeStyleLib,
      addNode,
      setNodes,
      setEdges,
      getNodes,
      getEdges,
    ],
  );

  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <FlowCanvas
        projectId={projectId}
        onUndo={onUndo}
        onRedo={onRedo}
        forceOnlyRenderVisible
        pro2FloatingInspector
      />
      <Pro2CanvasToolbar
        projectId={projectId}
        onOpenStyleLibrary={() => {
          setPro2StyleLibImageNodeId(null);
          setStyleLibOpen(true);
        }}
        onOpenMyHistory={() => {
          window.dispatchEvent(new CustomEvent("canvas:open-my-history"));
        }}
      />
      <StyleLibraryModal
        open={styleLibOpen}
        mode="spawn"
        onClose={closeStyleLib}
        onSpawn={onStylePresetPicked}
      />
      <CanvasCreditsToastHost />
      <CanvasBackgroundVideoPanel projectId={projectId} />
    </div>
  );
}
