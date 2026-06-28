"use client";

import { useCallback, useEffect, useState } from "react";
import { FlowCanvas } from "@/components/canvas/flow-canvas";
import { CanvasCreditsToastHost } from "@/components/canvas/canvas-credits-toast-host";
import { StyleLibraryModal } from "@/components/canvas/style-library-modal";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  spawnPro2StyleAssetFromPreset,
  spawnPro2StyleAssetLeftOfImageFromPreset,
} from "@/lib/canvas/pro2-spawn-style-asset";
import type { StyleLibraryPreset } from "@/lib/canvas/style-library/catalog";
import { Pro2CanvasToolbar } from "./pro2-canvas-toolbar";
import { Pro2CrewBulletin } from "./pro2-crew-bulletin";
import { Pro2ProductionGateBanner } from "./pro2-production-gate-banner";
import { shouldShowCrewBulletinRail } from "@/lib/canvas/crew-bulletin-context";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  useCrewBulletinSubscription,
  broadcastCrewBulletinLocalChange,
} from "@/lib/canvas/use-crew-bulletin-subscription";

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
  const base = useBookMallBaseUrl();
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

  const nodes = useCanvasStore((s) => s.nodes);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const showCrewBulletin = shouldShowCrewBulletinRail(
    nodes,
    graphMeta ?? undefined,
  );

  useCrewBulletinSubscription(base, projectId, showCrewBulletin);

  useEffect(() => {
    const onChanged = () => broadcastCrewBulletinLocalChange(projectId);
    window.addEventListener("canvas:crew-bulletin-changed", onChanged);
    return () =>
      window.removeEventListener("canvas:crew-bulletin-changed", onChanged);
  }, [projectId]);

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
      <Pro2ProductionGateBanner />
      {showCrewBulletin ? <Pro2CrewBulletin /> : null}
      <StyleLibraryModal
        open={styleLibOpen}
        mode="spawn"
        dockSpawn={Boolean(styleLibImageNodeId)}
        onClose={closeStyleLib}
        onSpawn={onStylePresetPicked}
      />
      <CanvasCreditsToastHost />
    </div>
  );
}
