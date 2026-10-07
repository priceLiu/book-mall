"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PlatformAssetHubModal } from "./platform-asset-hub-modal";
import type { PlatformAssetHubSection } from "./platform-asset-hub-types";
import { createCanvasGlobalAssetLibraryApi } from "@/lib/global-asset-library-api";
import { useCanvasStore } from "@/lib/canvas/store";
import type { GlobalAssetPickItem } from "@/docker-shared/global-asset-library/types";
import type { CameraShotPreset } from "@/lib/canvas/camera-shot-library/catalog";
import { spawnCanvasNodesFromGlobalAssetPick } from "@/lib/canvas/spawn-global-asset-pick";
import { detectCanvasEditionFromNodes } from "@/lib/canvas/spawn-project-asset-on-canvas";

type HubOpenDetail = {
  section?: PlatformAssetHubSection;
  pickCatalog?: boolean;
  spawnAtScreen?: { x: number; y: number };
};

export function PlatformAssetHubHost() {
  const api = useMemo(() => createCanvasGlobalAssetLibraryApi(), []);
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<PlatformAssetHubSection>("catalog");
  const [catalogPick, setCatalogPick] = useState<{
    maxSelect: number;
    onPick: (items: GlobalAssetPickItem[]) => void | Promise<void>;
  } | null>(null);

  const platformAssetDockNodeId = useCanvasStore((s) => s.platformAssetDockNodeId);
  const setPlatformAssetDockNodeId = useCanvasStore(
    (s) => s.setPlatformAssetDockNodeId,
  );
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);

  const close = useCallback(() => {
    setOpen(false);
    setCatalogPick(null);
    setPlatformAssetDockNodeId(null);
  }, [setPlatformAssetDockNodeId]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<HubOpenDetail>).detail ?? {};
      setSection(detail.section ?? "catalog");
      if (detail.pickCatalog) {
        const spawnAtScreen = detail.spawnAtScreen ?? {
          x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
          y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
        };
        setCatalogPick({
          maxSelect: 9,
          onPick: (items) => {
            const edition =
              detectCanvasEditionFromNodes(useCanvasStore.getState().nodes) ===
              "sbv1"
                ? "sbv1"
                : "pro2";
            spawnCanvasNodesFromGlobalAssetPick(items, {
              edition,
              spawnAtScreen,
              addNode,
              setNodes,
            });
          },
        });
      } else {
        setCatalogPick(null);
      }
      setOpen(true);
    };
    window.addEventListener("canvas:open-platform-asset-hub", onOpen);
    return () =>
      window.removeEventListener("canvas:open-platform-asset-hub", onOpen);
  }, [addNode, setNodes]);

  const onCameraShotInsertToDock = useCallback(
    (preset: CameraShotPreset) => {
      const nodeId = platformAssetDockNodeId;
      if (!nodeId) return;
      const nodes = useCanvasStore.getState().nodes;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const prev = String((node.data as { dockInput?: string }).dockInput ?? "");
      const token = `@<${preset.id}>`;
      const next = prev.trim() ? `${prev.trimEnd()} ${token} ` : `${token} `;
      updateNodeData(nodeId, { dockInput: next });
    },
    [platformAssetDockNodeId, updateNodeData],
  );

  return (
    <PlatformAssetHubModal
      open={open}
      onClose={close}
      api={api}
      initialSection={section}
      catalogPick={catalogPick ?? undefined}
      onCameraShotInsertToDock={
        platformAssetDockNodeId ? onCameraShotInsertToDock : undefined
      }
    />
  );
}

export function openPlatformAssetHub(opts?: HubOpenDetail) {
  window.dispatchEvent(
    new CustomEvent("canvas:open-platform-asset-hub", { detail: opts ?? {} }),
  );
}
