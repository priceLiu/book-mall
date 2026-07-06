"use client";

import { handlePro2SideAddNodePick } from "./pro2-add-node-pick";
import { openPro2StyleLibraryForMediaNode } from "./pro2-open-style-library";
import {
  spawnLibtvNeighborFromAnchor,
  type LibtvSideSpawnStore,
} from "./libtv-side-spawn";
import { resolveLibtvSideSpawnNodeType } from "./libtv-side-spawn";
import { handlePro2GroupSidePick } from "./pro2-group-side-spawn";
import {
  spawnJianyingAutoRenderNode,
} from "./spawn-jianying-render-preview";
import {
  handleSbv1GroupSidePick,
  handleSbv1SideAddNodePick,
  spawnSbv1NeighborFromNode,
} from "./sbv1-spawn-nodes";
import { sideConnectSideFromHandle } from "./libtv-side-connect-menu";
import type { Pro2AddNodePickDialogs } from "./pro2-add-node-pick";
import { useCanvasStore } from "./store";

export type SideConnectPickContext = {
  fromNodeId: string;
  fromHandleId: string;
  screenAnchor: { x: number; y: number };
};

/** 侧栏 + 拖线松手 · 菜单选中后在落点生成并连线 */
export async function runLibtvSideConnectPick(
  ctx: SideConnectPickContext,
  itemId: string,
  nodeType: string | undefined,
  store: LibtvSideSpawnStore,
  dialogs: Pro2AddNodePickDialogs,
): Promise<void> {
  const anchorNode = store.nodes.find((n) => n.id === ctx.fromNodeId);
  if (!anchorNode?.type) return;

  const side = sideConnectSideFromHandle(ctx.fromHandleId);
  const atScreen = ctx.screenAnchor;
  const spawnOpts = { atScreen };

  if (itemId === "style-asset") {
    openPro2StyleLibraryForMediaNode(ctx.fromNodeId);
    return;
  }

  if (anchorNode.type === "jianying-export-pro2") {
    if (
      side === "left" &&
      (itemId === "video" || nodeType === "sbv1-video-engine")
    ) {
      spawnSbv1NeighborFromNode(
        ctx.fromNodeId,
        "left",
        "sbv1-video-engine",
        store,
        spawnOpts,
      );
    } else if (
      side === "right" &&
      (itemId === "auto-render" || nodeType === "jianying-auto-render-pro2")
    ) {
      const canvas = useCanvasStore.getState();
      spawnJianyingAutoRenderNode(
        ctx.fromNodeId,
        {
          nodes: canvas.nodes,
          edges: canvas.edges,
          addNode: store.addNode,
          setNodes: store.setNodes,
          setEdges: store.setEdges,
          updateNodeData: canvas.updateNodeData,
        },
        { ...spawnOpts, replicateVideoEdgesFrom: ctx.fromNodeId },
      );
    }
    return;
  }

  if (anchorNode.type === "jianying-auto-render-pro2") {
    if (
      side === "left" &&
      (itemId === "video" || nodeType === "sbv1-video-engine")
    ) {
      spawnSbv1NeighborFromNode(
        ctx.fromNodeId,
        "left",
        "sbv1-video-engine",
        store,
        spawnOpts,
      );
    }
    return;
  }

  if (anchorNode.type === "group") {
    const isSbv1 = Boolean(
      (anchorNode.data as { sbv1Styled?: boolean }).sbv1Styled,
    );
    if (isSbv1) {
      await handleSbv1GroupSidePick(
        ctx.fromNodeId,
        side,
        itemId,
        nodeType,
        dialogs.alert,
        store,
      );
    } else {
      await handlePro2GroupSidePick(
        ctx.fromNodeId,
        side,
        itemId,
        nodeType,
        dialogs.alert,
        store,
      );
    }
    return;
  }

  if (
    anchorNode.type === "sbv1-video-engine" ||
    anchorNode.type === "sbv1-image"
  ) {
    await handleSbv1SideAddNodePick(
      itemId,
      nodeType,
      dialogs.alert,
      () => {
        if (
          side === "left" &&
          (itemId === "image" || nodeType === "sbv1-image")
        ) {
          spawnSbv1NeighborFromNode(
            ctx.fromNodeId,
            "left",
            "sbv1-image",
            store,
            {
              ...spawnOpts,
              spawnMode:
                itemId === "txt2img"
                  ? "txt2img"
                  : itemId === "img2img"
                    ? "img2img"
                    : undefined,
            },
          );
          return;
        }
        if (
          side === "left" &&
          (itemId === "text" || nodeType === "story-pro2-starter")
        ) {
          spawnSbv1NeighborFromNode(
            ctx.fromNodeId,
            "left",
            "story-pro2-starter",
            store,
            spawnOpts,
          );
          return;
        }
        if (
          side === "left" &&
          itemId === "video" &&
          nodeType === "sbv1-video-engine"
        ) {
          spawnSbv1NeighborFromNode(
            ctx.fromNodeId,
            "left",
            "sbv1-video-engine",
            store,
            { ...spawnOpts, connectAsMotionVideo: true },
          );
          return;
        }
        if (
          side === "right" &&
          (itemId === "export" || nodeType === "jianying-export-pro2")
        ) {
          spawnSbv1NeighborFromNode(
            ctx.fromNodeId,
            "right",
            "jianying-export-pro2",
            store,
            spawnOpts,
          );
          return;
        }
        if (
          side === "right" &&
          (itemId === "auto-render" || nodeType === "jianying-auto-render-pro2")
        ) {
          spawnSbv1NeighborFromNode(
            ctx.fromNodeId,
            "right",
            "jianying-auto-render-pro2",
            store,
            spawnOpts,
          );
          return;
        }
        if (
          side === "right" &&
          (itemId === "video" ||
            itemId === "video-engine" ||
            itemId === "video-compose" ||
            nodeType === "sbv1-video-engine")
        ) {
          spawnSbv1NeighborFromNode(
            ctx.fromNodeId,
            "right",
            "sbv1-video-engine",
            store,
            spawnOpts,
          );
        }
      },
    );
    return;
  }

  if (anchorNode.type === "story-pro2-style-asset") {
    await handlePro2SideAddNodePick(itemId, nodeType, dialogs, () => {
      if (side === "left") {
        if (
          itemId === "txt2img" ||
          itemId === "img2img" ||
          itemId === "image" ||
          nodeType === "story-pro2-image"
        ) {
          spawnLibtvNeighborFromAnchor(
            ctx.fromNodeId,
            "left",
            "story-pro2-image",
            store,
            spawnOpts,
          );
        }
        return;
      }
      if (itemId === "text" || nodeType === "story-pro2-starter") {
        spawnLibtvNeighborFromAnchor(
          ctx.fromNodeId,
          "right",
          "story-pro2-starter",
          store,
          spawnOpts,
        );
        return;
      }
      if (itemId === "image" || nodeType === "story-pro2-image") {
        spawnLibtvNeighborFromAnchor(
          ctx.fromNodeId,
          "right",
          "story-pro2-image",
          store,
          spawnOpts,
        );
      }
    });
    return;
  }

  await handlePro2SideAddNodePick(itemId, nodeType, dialogs, () => {
    const spawnType = resolveLibtvSideSpawnNodeType(itemId, nodeType);
    if (
      spawnType === "story-pro2-three-view" ||
      spawnType === "sbv1-video-engine"
    ) {
      spawnLibtvNeighborFromAnchor(
        ctx.fromNodeId,
        side,
        spawnType,
        store,
        spawnOpts,
      );
      return;
    }
    if (itemId === "script" || nodeType === "story-pro2-script-hub") {
      spawnLibtvNeighborFromAnchor(
        ctx.fromNodeId,
        "right",
        "story-pro2-script-hub",
        store,
        spawnOpts,
      );
      return;
    }
    if (itemId === "text" || nodeType === "story-pro2-starter") {
      spawnLibtvNeighborFromAnchor(
        ctx.fromNodeId,
        side,
        "story-pro2-starter",
        store,
        spawnOpts,
      );
      return;
    }
    if (itemId === "image" || nodeType === "story-pro2-image") {
      spawnLibtvNeighborFromAnchor(
        ctx.fromNodeId,
        side,
        "story-pro2-image",
        store,
        spawnOpts,
      );
    }
  });
}
