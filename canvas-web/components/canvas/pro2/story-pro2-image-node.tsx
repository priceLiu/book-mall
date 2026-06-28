"use client";

import { useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { handlePro2SideAddNodePick } from "@/lib/canvas/pro2-add-node-pick";
import {
  PRO2_IMAGE_LEFT_ADD_MENU,
  PRO2_RIGHT_ADD_MENU,
} from "@/lib/canvas/pro2-add-node-menu";
import {
  resolveLibtvSideSpawnNodeType,
  spawnLibtvNeighborFromAnchor,
} from "@/lib/canvas/libtv-side-spawn";
import { useCanvasStore } from "@/lib/canvas/store";
import { selectPro2NodeAfterSpawn } from "@/lib/canvas/pro2-spawn-select";
import { openPro2StyleLibraryForMediaNode } from "@/lib/canvas/pro2-open-style-library";
import { LibtvImageNode } from "../libtv-image-node";

export function StoryPro2ImageNode(props: NodeProps) {
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const addNode = useCanvasStore((s) => s.addNode);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const spawnStore = useMemo(
    () => ({ nodes, addNode, setNodes, setEdges }),
    [nodes, addNode, setNodes, setEdges],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          if (itemId === "style-asset") {
            openPro2StyleLibraryForMediaNode(props.id);
            return;
          }
          const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
          if (!spawnType) return;
          spawnLibtvNeighborFromAnchor(props.id, side, spawnType, spawnStore);
        },
      );
    },
    [props.id, spawnStore, alert],
  );

  return (
    <LibtvImageNode
      {...props}
      edition="pro2"
      rfNodeType="story-pro2-image"
      saveAsAssetKind="story-pro2-image"
      leftMenuSections={PRO2_IMAGE_LEFT_ADD_MENU}
      rightMenuSections={PRO2_RIGHT_ADD_MENU}
      onSidePickLeft={onSidePick("left")}
      onSidePickRight={onSidePick("right")}
      onSelectAfterDuplicate={(newId) => selectPro2NodeAfterSpawn(setNodes, newId)}
    />
  );
}
