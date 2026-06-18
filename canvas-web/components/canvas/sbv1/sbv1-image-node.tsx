"use client";

import { useCallback, useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  SBV1_IMAGE_LEFT_ADD_MENU,
  SBV1_IMAGE_RIGHT_ADD_MENU,
} from "@/lib/canvas/sbv1-add-node-menu";
import { useCanvasStore } from "@/lib/canvas/store";
import {
  handleSbv1ImageSideAddNodePick,
  selectSbv1NodeAfterSpawn,
  spawnSbv1NeighborFromNode,
} from "@/lib/canvas/sbv1-spawn-nodes";
import { LibtvImageNode } from "../libtv-image-node";

export function Sbv1ImageNode(props: NodeProps) {
  const { alert } = useDialogs();
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const addNode = useCanvasStore((s) => s.addNode);
  const addNodeInGroup = useCanvasStore((s) => s.addNodeInGroup);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const spawnStore = useMemo(
    () => ({ nodes, edges, addNode, addNodeInGroup, setNodes, setEdges }),
    [nodes, edges, addNode, addNodeInGroup, setNodes, setEdges],
  );

  const onSidePick = useCallback(
    (side: "left" | "right") => (itemId: string, nodeType?: string) => {
      void handleSbv1ImageSideAddNodePick(
        itemId,
        nodeType,
        side,
        alert,
        () => {
          spawnSbv1NeighborFromNode(props.id, side, "sbv1-image", spawnStore);
        },
        () => {
          if (side === "right") {
            spawnSbv1NeighborFromNode(
              props.id,
              "right",
              "sbv1-video-engine",
              spawnStore,
            );
          }
        },
      );
    },
    [props.id, spawnStore, alert],
  );

  return (
    <LibtvImageNode
      {...props}
      edition="sbv1"
      rfNodeType="sbv1-image"
      saveAsAssetKind="sbv1-image"
      leftMenuSections={SBV1_IMAGE_LEFT_ADD_MENU}
      rightMenuSections={SBV1_IMAGE_RIGHT_ADD_MENU}
      onSidePickLeft={onSidePick("left")}
      onSidePickRight={onSidePick("right")}
      onSelectAfterDuplicate={(newId) => selectSbv1NodeAfterSpawn(setNodes, newId)}
    />
  );
}
