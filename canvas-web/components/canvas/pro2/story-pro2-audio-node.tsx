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
import { LibtvAudioNode } from "../libtv-audio-node";

/** 2.0 LibTV 音频节点 */
export function StoryPro2AudioNode(props: NodeProps) {
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
      void handlePro2SideAddNodePick(
        itemId,
        nodeType,
        { alert },
        () => {
          const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
          if (!spawnType) return;
          spawnLibtvNeighborFromAnchor(props.id, side, spawnType, spawnStore);
        },
      );
    },
    [props.id, spawnStore, alert],
  );

  const defaultLabel =
    (props.data as { label?: string }).label?.trim() || "音频";

  return (
    <LibtvAudioNode
      {...props}
      data={{
        ...(props.data as Record<string, unknown>),
        label: defaultLabel,
      }}
      leftMenuSections={PRO2_IMAGE_LEFT_ADD_MENU}
      rightMenuSections={PRO2_RIGHT_ADD_MENU}
      onSidePickLeft={onSidePick("left")}
      onSidePickRight={onSidePick("right")}
      onSelectAfterDuplicate={(newId) =>
        selectPro2NodeAfterSpawn(setNodes, newId)
      }
    />
  );
}
