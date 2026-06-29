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
import type { Pro2ImageMediaRole } from "@/lib/canvas/story-pro2-workspace-types";
import { LibtvImageNode } from "../libtv-image-node";

const PLACEHOLDER_LABELS: Record<string, string> = {
  "story-pro2-prop": "道具",
  "story-pro2-mood": "氛围",
  "story-pro2-audio": "音效",
};

const PLACEHOLDER_ROLES: Record<string, Pro2ImageMediaRole | undefined> = {
  "story-pro2-prop": "prop",
  "story-pro2-mood": "mood",
};

/** 2.0 LibTV 媒体卡 · 道具/氛围与 story-pro2-image 同构（音效仍占位） */
export function StoryPro2PlaceholderMediaNode(props: NodeProps) {
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
          const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
          if (!spawnType) return;
          spawnLibtvNeighborFromAnchor(props.id, side, spawnType, spawnStore);
        },
      );
    },
    [props.id, spawnStore, alert],
  );

  const nodeType = props.type ?? "story-pro2-prop";
  const defaultLabel = PLACEHOLDER_LABELS[nodeType] ?? "设计";
  const mediaRole = PLACEHOLDER_ROLES[nodeType];

  if (nodeType === "story-pro2-audio") {
    return (
      <LibtvImageNode
        {...props}
        data={{
          ...(props.data as Record<string, unknown>),
          label: (props.data as { label?: string }).label ?? defaultLabel,
        }}
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

  return (
    <LibtvImageNode
      {...props}
      data={{
        ...(props.data as Record<string, unknown>),
        label: (props.data as { label?: string }).label ?? defaultLabel,
        pro2MediaRole: mediaRole,
      }}
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
