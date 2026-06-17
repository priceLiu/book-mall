import {
  LIBTV_SQUARE_IMAGE_NODE_WIDTH,
  LIBTV_SQUARE_IMAGE_NODE_HEIGHT,
} from "./libtv-node-chrome";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
} from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  PRO2_IMAGE_NODE_HEIGHT,
  PRO2_TEXT_NODE_HEIGHT,
  PRO2_TEXT_NODE_MIN_WIDTH,
  PRO2_TEXT_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import { SBV1_VIDEO_ENGINE_HEIGHT, SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { flowPositionAtViewportCenter } from "./viewport-placement";

export type Pro2ShortcutPresetId =
  | "image-to-prompt"
  | "video-to-prompt"
  | "text-to-video";

const PRESET_LABEL: Record<Pro2ShortcutPresetId, string> = {
  "image-to-prompt": "预设 - 图片反推提示词",
  "video-to-prompt": "预设 - 视频反推提示词",
  "text-to-video": "预设 - 文生视频",
};

type SpawnStore = {
  addNode: (
    type: string,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  setNodes: Parameters<typeof selectPro2NodeAfterSpawn>[0];
  createGroupContaining: (
    childIds: string[],
    opts?: { label?: string; pro2Styled?: boolean },
  ) => string | null;
};

function presetOrigin(anchor?: { x: number; y: number }) {
  return (
    anchor ??
    flowPositionAtViewportCenter("story-pro2-starter") ?? { x: 420, y: 280 }
  );
}

const SHORTCUT_GROUP_PAD = 28;
const SHORTCUT_GROUP_HEADER = 32;

/** 快捷预设组 · 创建组后立即水平重排子节点 */
function relayoutShortcutPresetGroup(
  setNodes: SpawnStore["setNodes"],
  groupId: string | null,
  children: Array<{ id: string; width: number; height: number }>,
  gap: number,
) {
  if (!groupId || children.length === 0) return;
  const totalW =
    children.reduce((sum, c) => sum + c.width, 0) +
    gap * Math.max(0, children.length - 1);
  const maxH = Math.max(...children.map((c) => c.height));
  const groupW = totalW + SHORTCUT_GROUP_PAD * 2;
  const groupH = maxH + SHORTCUT_GROUP_PAD * 2 + SHORTCUT_GROUP_HEADER;

  const childPositions = new Map<string, { x: number; y: number }>();
  let x = SHORTCUT_GROUP_PAD;
  for (const spec of children) {
    childPositions.set(spec.id, {
      x,
      y: SHORTCUT_GROUP_PAD + SHORTCUT_GROUP_HEADER + (maxH - spec.height) / 2,
    });
    x += spec.width + gap;
  }

  setNodes((prev) => {
    const group = prev.find((n) => n.id === groupId);
    if (!group) return prev;
    return prev.map((n) => {
      if (n.id === groupId) {
        return {
          ...n,
          width: groupW,
          height: groupH,
          style: {
            ...(typeof n.style === "object" && n.style ? n.style : {}),
            width: groupW,
            height: groupH,
          },
          data: { ...n.data, pro2ShortcutPreset: true },
        } as CanvasFlowNode;
      }
      const pos = childPositions.get(n.id);
      if (!pos) return n;
      const spec = children.find((c) => c.id === n.id)!;
      return {
        ...n,
        parentId: groupId,
        extent: "parent" as const,
        position: pos,
        width: spec.width,
        height: spec.height,
        style: { width: spec.width, height: spec.height },
      } as CanvasFlowNode;
    });
  });
}

/** 快捷预设 · 在视口中心生成已连线的节点组（LibTV 2.0 节点） */
export function spawnPro2ShortcutPreset(
  preset: Pro2ShortcutPresetId,
  store: SpawnStore,
  anchor?: { x: number; y: number },
): { groupId: string | null; focusNodeId: string } {
  const gap = 56;
  const center = presetOrigin(anchor);
  const textW = PRO2_TEXT_NODE_WIDTH;
  const imageW = LIBTV_SQUARE_IMAGE_NODE_WIDTH;
  const videoW = SBV1_VIDEO_ENGINE_WIDTH;

  if (preset === "image-to-prompt") {
    const totalW = imageW + gap + textW;
    const maxH = Math.max(PRO2_IMAGE_NODE_HEIGHT, PRO2_TEXT_NODE_HEIGHT);
    const y = center.y - maxH / 2;
    const imageId = store.addNode(
      "story-pro2-image",
      { x: center.x - totalW / 2, y },
      buildPro2ImageNodeData({
        label: "图片",
        pro2PresetKind: preset,
      }),
    );
    const textId = store.addNode(
      "story-pro2-starter",
      { x: center.x - totalW / 2 + imageW + gap, y },
      buildPro2StarterNodeData({ pro2PresetKind: preset }),
    );
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${imageId}-${textId}`,
        source: imageId,
        target: textId,
        sourceHandle: "image",
        targetHandle: "in_text",
      },
    ]);
    const groupId = store.createGroupContaining([imageId, textId], {
      label: PRESET_LABEL[preset],
    });
    queueMicrotask(() => {
      relayoutShortcutPresetGroup(
        store.setNodes,
        groupId,
        [
          { id: imageId, width: imageW, height: LIBTV_SQUARE_IMAGE_NODE_HEIGHT },
          { id: textId, width: textW, height: PRO2_TEXT_NODE_HEIGHT },
        ],
        gap,
      );
      selectPro2NodeAfterSpawn(store.setNodes, textId);
    });
    return { groupId, focusNodeId: textId };
  }

  if (preset === "video-to-prompt") {
    const totalW = videoW + gap + textW;
    const y = center.y - SBV1_VIDEO_ENGINE_HEIGHT / 2;
    const videoId = store.addNode(
      "sbv1-video-engine",
      { x: center.x - totalW / 2, y },
      { label: "视频", pro2PresetKind: preset },
    );
    const textId = store.addNode(
      "story-pro2-starter",
      { x: center.x - totalW / 2 + videoW + gap, y },
      buildPro2StarterNodeData({ pro2PresetKind: preset }),
    );
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${videoId}-${textId}`,
        source: videoId,
        target: textId,
        sourceHandle: "out_video",
        targetHandle: "in_text",
      },
    ]);
    const groupId = store.createGroupContaining([videoId, textId], {
      label: PRESET_LABEL[preset],
    });
    queueMicrotask(() => {
      relayoutShortcutPresetGroup(
        store.setNodes,
        groupId,
        [
          { id: videoId, width: videoW, height: SBV1_VIDEO_ENGINE_HEIGHT },
          { id: textId, width: textW, height: PRO2_TEXT_NODE_HEIGHT },
        ],
        gap,
      );
      selectPro2NodeAfterSpawn(store.setNodes, textId);
    });
    return { groupId, focusNodeId: textId };
  }

  const totalW = textW + gap + videoW;
  const maxH = Math.max(PRO2_TEXT_NODE_HEIGHT, SBV1_VIDEO_ENGINE_HEIGHT);
  const y = center.y - maxH / 2;
  const textId = store.addNode(
    "story-pro2-starter",
    { x: center.x - totalW / 2, y },
    buildPro2StarterNodeData({ pro2PresetKind: preset }),
  );
  const videoId = store.addNode(
    "sbv1-video-engine",
    { x: center.x - totalW / 2 + textW + gap, y },
    { label: "视频", pro2PresetKind: preset },
  );
  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${textId}-${videoId}`,
      source: textId,
      target: videoId,
      sourceHandle: "text",
      targetHandle: "in_ref",
    },
  ]);
  const groupId = store.createGroupContaining([textId, videoId], {
    label: PRESET_LABEL[preset],
  });
  queueMicrotask(() => {
    relayoutShortcutPresetGroup(
      store.setNodes,
      groupId,
      [
        { id: textId, width: textW, height: PRO2_TEXT_NODE_HEIGHT },
        { id: videoId, width: videoW, height: SBV1_VIDEO_ENGINE_HEIGHT },
      ],
      gap,
    );
    selectPro2NodeAfterSpawn(store.setNodes, textId);
  });
  return { groupId, focusNodeId: textId };
}
