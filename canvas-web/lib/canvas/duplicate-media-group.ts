"use client";

import { nanoid } from "nanoid";
import { duplicateCanvasNodeData } from "./clone-node-data";
import {
  ensurePro2FrameBoardToVideoBoardEdge,
  ensurePro2HubToMediaGroupEdge,
} from "./pro2-hub-media-group-edge";
import { PRO2_MEDIA_GROUP_EXTRA, PRO2_MEDIA_GROUP_PAD } from "./pro2-media-group-layout";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const COPY_GAP = 80;

/** 复制媒体组（含全部子节点）并自 hub 再连一条线 */
export function duplicateMediaGroupInGraph(
  groupId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  newGroupId: string;
} | null {
  const group = nodes.find((n) => n.id === groupId && n.type === "group");
  if (!group) return null;

  const children = nodes.filter((n) => n.parentId === groupId);
  if (!children.length) return null;

  const idMap = new Map<string, string>();
  idMap.set(groupId, `g_${nanoid(8)}`);
  for (const c of children) {
    idMap.set(c.id, `n_${nanoid(8)}`);
  }
  const newGroupId = idMap.get(groupId)!;

  const groupW =
    (group.width as number | undefined) ??
    (group.measured?.width as number | undefined) ??
    320;
  const offsetX = groupW + PRO2_MEDIA_GROUP_PAD + PRO2_MEDIA_GROUP_EXTRA + COPY_GAP;

  const gd = group.data as {
    label?: string;
    color?: string;
    pro2Kind?: string;
    pro2HubNodeId?: string;
    pro2ControllerNodeId?: string;
    pro2Styled?: boolean;
    sbv1Styled?: boolean;
    pro2LayoutVersion?: number;
  };

  const newGroup: CanvasFlowNode = {
    ...group,
    id: newGroupId,
    selected: true,
    position: {
      x: group.position.x + offsetX,
      y: group.position.y,
    },
    data: {
      ...structuredClone(group.data as Record<string, unknown>),
      label: gd.label?.trim() ? `${gd.label.trim()} 副本` : "分组 副本",
    },
  };

  const childIdSet = new Set(children.map((c) => c.id));

  const newChildren: CanvasFlowNode[] = children.map((c) => {
    const newId = idMap.get(c.id)!;
    const cd = c.data as Record<string, unknown>;
    return {
      ...c,
      id: newId,
      selected: false,
      parentId: newGroupId,
      extent: "parent" as const,
      data: {
        ...duplicateCanvasNodeData(cd, true),
        pro2GroupId: newGroupId,
      },
    };
  });

  const nextNodes = [
    ...nodes.map((n) => ({ ...n, selected: false })),
    newGroup,
    ...newChildren,
  ];

  let nextEdges = [...edges];
  const hubId = gd.pro2HubNodeId?.trim();
  const frameGroupId =
    gd.pro2Kind === "video-board" && gd.pro2ControllerNodeId
      ? (() => {
          const videoCol = nodes.find((n) => n.id === gd.pro2ControllerNodeId);
          const frameColumnId = (
            videoCol?.data as { frameColumnId?: string }
          )?.frameColumnId?.trim();
          if (!frameColumnId) return null;
          return (
            nodes.find(
              (n) =>
                n.type === "group" &&
                (n.data as { pro2ControllerNodeId?: string })
                  .pro2ControllerNodeId === frameColumnId,
            )?.id ?? null
          );
        })()
      : null;

  if (frameGroupId) {
    ensurePro2FrameBoardToVideoBoardEdge(
      (fn) => {
        nextEdges = fn(nextEdges);
      },
      frameGroupId,
      newGroupId,
    );
  } else if (hubId && nodes.some((n) => n.id === hubId)) {
    ensurePro2HubToMediaGroupEdge(
      (fn) => {
        nextEdges = fn(nextEdges);
      },
      hubId,
      newGroupId,
    );
  }

  const duplicatedInternalEdges: CanvasFlowEdge[] = edges
    .filter(
      (e) =>
        childIdSet.has(e.source) &&
        childIdSet.has(e.target) &&
        idMap.has(e.source) &&
        idMap.has(e.target),
    )
    .map((e) => ({
      ...e,
      id: `e_${nanoid(8)}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));

  nextEdges = [...nextEdges, ...duplicatedInternalEdges];

  return { nodes: nextNodes, edges: nextEdges, newGroupId };
}
