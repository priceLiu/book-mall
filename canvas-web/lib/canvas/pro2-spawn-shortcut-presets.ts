import {
  LIBTV_AUDIO_TRACK_NODE_HEIGHT,
  LIBTV_AUDIO_TRACK_NODE_WIDTH,
  LIBTV_SQUARE_IMAGE_NODE_WIDTH,
  LIBTV_SQUARE_IMAGE_NODE_HEIGHT,
} from "./libtv-node-chrome";
import {
  buildPro2ImageNodeData,
  buildPro2StarterNodeData,
  buildPro2GeneralTextNodeData,
} from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  PRO2_IMAGE_NODE_HEIGHT,
  PRO2_TEXT_NODE_HEIGHT,
  PRO2_TEXT_NODE_MIN_WIDTH,
  PRO2_TEXT_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import { SBV1_VIDEO_ENGINE_HEIGHT, SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
import { buildSbv1VideoEngineNodeData } from "./sbv1-spawn-nodes";
import { buildPro2AudioNodeData } from "./pro2-spawn-nodes";
import {
  GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
  GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
} from "./system-providers";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { flowPositionAtViewportCenter } from "./viewport-placement";

export type Pro2ShortcutPresetId =
  | "image-to-prompt"
  | "video-to-prompt"
  | "text-to-video"
  | "text-to-music";

/** 视频节点空态 · 左侧添加上游快捷预设 */
export type Pro2VideoShortcutPresetId =
  | "image-ref-to-video"
  | "text-to-video-from-video"
  | "video-to-video"
  | "lip-sync-broadcast"
  | "reference-audio-to-video";

const VIDEO_PRESET_LABEL: Record<Pro2VideoShortcutPresetId, string> = {
  "image-ref-to-video": "预设 - 图(参考)生视频",
  "text-to-video-from-video": "预设 - 文生视频",
  "video-to-video": "预设 - 视频生视频",
  "lip-sync-broadcast": "预设 - 对口型口播",
  "reference-audio-to-video": "预设 - 参考音生视频",
};

const LIP_SYNC_AUDIO_ENGINE = {
  providerId: GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
  modelKey: "MiniMax/speech-2.8-hd",
  params: { voice_id: "" },
} as const;

const REF_AUDIO_AUDIO_ENGINE = {
  providerId: GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
  modelKey: "MiniMax/speech-2.8-hd",
  params: { voice_id: "male-qn-qingse" },
} as const;

const REF_AUDIO_VIDEO_ENGINE = {
  providerId: GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
  modelKey: "doubao-seedance-2.0",
  params: {
    resolution: "720p",
    generate_audio: false,
    ratio: "16:9",
    duration: 15,
  },
} as const;

const PRESET_LABEL: Record<Pro2ShortcutPresetId, string> = {
  "image-to-prompt": "预设 - 图片反推提示词",
  "video-to-prompt": "预设 - 视频反推提示词",
  "text-to-video": "预设 - 文生视频",
  "text-to-music": "预设 - 文字生音乐",
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
    opts?: {
      label?: string;
      pro2Styled?: boolean;
      pro2ShortcutPreset?: boolean;
    },
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

const SHORTCUT_GROUP_OPTS = {
  pro2ShortcutPreset: true as const,
};

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
      buildPro2GeneralTextNodeData({ pro2PresetKind: preset }),
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
      ...SHORTCUT_GROUP_OPTS,
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
      buildSbv1VideoEngineNodeData({
        label: "视频",
        pro2PresetKind: preset,
      }),
    );
    const textId = store.addNode(
      "story-pro2-starter",
      { x: center.x - totalW / 2 + videoW + gap, y },
      buildPro2GeneralTextNodeData({ pro2PresetKind: preset }),
    );
    if (!videoId || !textId) {
      return { groupId: null, focusNodeId: textId || videoId };
    }
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
      ...SHORTCUT_GROUP_OPTS,
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
  if (preset === "text-to-music") {
    const audioW = LIBTV_AUDIO_TRACK_NODE_WIDTH;
    const audioH = LIBTV_AUDIO_TRACK_NODE_HEIGHT;
    const totalMusicW = textW + gap + audioW;
    const musicY = center.y - Math.max(PRO2_TEXT_NODE_HEIGHT, audioH) / 2;
    const textId = store.addNode(
      "story-pro2-starter",
      { x: center.x - totalMusicW / 2, y: musicY },
      buildPro2GeneralTextNodeData({ pro2PresetKind: preset }),
    );
    const audioId = store.addNode(
      "story-pro2-audio",
      { x: center.x - totalMusicW / 2 + textW + gap, y: musicY },
      buildPro2AudioNodeData({
        label: "音频",
        pro2PresetKind: preset,
      }),
    );
    if (!textId || !audioId) {
      return { groupId: null, focusNodeId: textId || audioId };
    }
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${textId}-${audioId}`,
        source: textId,
        target: audioId,
        sourceHandle: "text",
        targetHandle: "in_audio",
      },
    ]);
    const groupId = store.createGroupContaining([textId, audioId], {
      label: PRESET_LABEL[preset],
      ...SHORTCUT_GROUP_OPTS,
    });
    queueMicrotask(() => {
      relayoutShortcutPresetGroup(
        store.setNodes,
        groupId,
        [
          { id: textId, width: textW, height: PRO2_TEXT_NODE_HEIGHT },
          { id: audioId, width: audioW, height: audioH },
        ],
        gap,
      );
      selectPro2NodeAfterSpawn(store.setNodes, textId);
    });
    return { groupId, focusNodeId: textId };
  }

  const textId = store.addNode(
    "story-pro2-starter",
    { x: center.x - totalW / 2, y },
    buildPro2GeneralTextNodeData({ pro2PresetKind: preset }),
  );
  const videoId = store.addNode(
    "sbv1-video-engine",
    { x: center.x - totalW / 2 + textW + gap, y },
    buildSbv1VideoEngineNodeData({
      label: "视频",
      pro2PresetKind: preset,
    }),
  );
  if (!textId || !videoId) {
    return { groupId: null, focusNodeId: textId || videoId };
  }
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
    ...SHORTCUT_GROUP_OPTS,
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

type AttachStarterStore = Pick<
  SpawnStore,
  "addNode" | "setEdges" | "setNodes"
> & {
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

/** 在已有空文本节点上挂载快捷预设（不重复新建文本节点） */
export function attachPro2StarterShortcutPreset(
  starterId: string,
  preset: Pro2ShortcutPresetId,
  nodes: CanvasFlowNode[],
  store: AttachStarterStore,
): void {
  const starter = nodes.find((n) => n.id === starterId);
  if (!starter || starter.type !== "story-pro2-starter") return;

  const gap = 56;
  const textW = starter.width ?? PRO2_TEXT_NODE_WIDTH;
  const sx = starter.position.x;
  const sy = starter.position.y;

  store.updateNodeData(starterId, {
    pro2TextPurpose: "general",
    pro2PresetKind: preset,
  });

  if (preset === "image-to-prompt") {
    const imageId = store.addNode(
      "story-pro2-image",
      { x: sx - LIBTV_SQUARE_IMAGE_NODE_WIDTH - gap, y: sy },
      buildPro2ImageNodeData({
        label: "图片",
        pro2PresetKind: preset,
      }),
    );
    if (!imageId) return;
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${imageId}-${starterId}`,
        source: imageId,
        target: starterId,
        sourceHandle: "image",
        targetHandle: "in_text",
      },
    ]);
    selectPro2NodeAfterSpawn(store.setNodes, starterId);
    return;
  }

  if (preset === "video-to-prompt") {
    const videoId = store.addNode(
      "sbv1-video-engine",
      { x: sx - SBV1_VIDEO_ENGINE_WIDTH - gap, y: sy },
      buildSbv1VideoEngineNodeData({
        label: "视频",
        pro2PresetKind: preset,
      }),
    );
    if (!videoId) return;
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${videoId}-${starterId}`,
        source: videoId,
        target: starterId,
        sourceHandle: "out_video",
        targetHandle: "in_text",
      },
    ]);
    selectPro2NodeAfterSpawn(store.setNodes, starterId);
    return;
  }

  if (preset === "text-to-music") {
    attachTextToMusicPreset(starterId, sx, sy, textW, gap, store);
    return;
  }

  const videoId = store.addNode(
    "sbv1-video-engine",
    { x: sx + textW + gap, y: sy },
    buildSbv1VideoEngineNodeData({
      label: "视频",
      pro2PresetKind: preset,
    }),
  );
  if (!videoId) return;
  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${starterId}-${videoId}`,
      source: starterId,
      target: videoId,
      sourceHandle: "text",
      targetHandle: "in_ref",
    },
  ]);
  selectPro2NodeAfterSpawn(store.setNodes, starterId);
}

function attachTextToMusicPreset(
  starterId: string,
  sx: number,
  sy: number,
  textW: number,
  gap: number,
  store: AttachStarterStore,
): void {
  const audioId = store.addNode(
    "story-pro2-audio",
    { x: sx + textW + gap, y: sy },
    buildPro2AudioNodeData({
      label: "音频",
      pro2PresetKind: "text-to-music",
    }),
  );
  if (!audioId) return;
  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${starterId}-${audioId}`,
      source: starterId,
      target: audioId,
      sourceHandle: "text",
      targetHandle: "in_audio",
    },
  ]);
  selectPro2NodeAfterSpawn(store.setNodes, starterId);
}

/** 在已有空视频节点左侧挂载快捷预设（上游在左、视频锚点在右） */
export function attachPro2VideoShortcutPreset(
  videoId: string,
  preset: Pro2VideoShortcutPresetId,
  nodes: CanvasFlowNode[],
  store: AttachStarterStore,
): void {
  const video = nodes.find((n) => n.id === videoId);
  if (!video || video.type !== "sbv1-video-engine") return;

  const gap = 56;
  const vx = video.position.x;
  const vy = video.position.y;
  const videoW = video.width ?? SBV1_VIDEO_ENGINE_WIDTH;
  const videoH = video.height ?? SBV1_VIDEO_ENGINE_HEIGHT;
  const textW = PRO2_TEXT_NODE_WIDTH;
  const imageW = LIBTV_SQUARE_IMAGE_NODE_WIDTH;
  const imageH = LIBTV_SQUARE_IMAGE_NODE_HEIGHT;
  const audioW = LIBTV_AUDIO_TRACK_NODE_WIDTH;
  const audioH = LIBTV_AUDIO_TRACK_NODE_HEIGHT;

  store.updateNodeData(videoId, { pro2PresetKind: preset });

  if (preset === "image-ref-to-video") {
    const imageId = store.addNode(
      "story-pro2-image",
      {
        x: vx - imageW - gap,
        y: vy + Math.max(0, (videoH - imageH) / 2),
      },
      buildPro2ImageNodeData({
        label: "图片",
        pro2PresetKind: preset,
      }),
    );
    if (!imageId) return;
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${imageId}-${videoId}`,
        source: imageId,
        target: videoId,
        sourceHandle: "image",
        targetHandle: "in_ref",
      },
    ]);
    selectPro2NodeAfterSpawn(store.setNodes, videoId);
    return;
  }

  if (preset === "text-to-video-from-video") {
    const textId = store.addNode(
      "story-pro2-starter",
      {
        x: vx - textW - gap,
        y: vy + Math.max(0, (videoH - PRO2_TEXT_NODE_HEIGHT) / 2),
      },
      buildPro2GeneralTextNodeData({ pro2PresetKind: preset }),
    );
    if (!textId) return;
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${textId}-${videoId}`,
        source: textId,
        target: videoId,
        sourceHandle: "text",
        targetHandle: "in_text",
      },
    ]);
    selectPro2NodeAfterSpawn(store.setNodes, videoId);
    return;
  }

  if (preset === "video-to-video") {
    const upstreamVideoId = store.addNode(
      "sbv1-video-engine",
      {
        x: vx - videoW - gap,
        y: vy,
      },
      buildSbv1VideoEngineNodeData({
        label: "视频",
        pro2PresetKind: preset,
      }),
    );
    if (!upstreamVideoId) return;
    store.setEdges((prev) => [
      ...prev,
      {
        id: `e-${upstreamVideoId}-${videoId}`,
        source: upstreamVideoId,
        target: videoId,
        sourceHandle: "out_video",
        targetHandle: "in_motion_video",
      },
    ]);
    selectPro2NodeAfterSpawn(store.setNodes, videoId);
    return;
  }

  if (
    preset === "lip-sync-broadcast" ||
    preset === "reference-audio-to-video"
  ) {
    attachImageAudioVideoPreset(videoId, preset, vx, vy, videoH, gap, store, {
      imageW,
      imageH,
      audioW,
      audioH,
    });
    return;
  }

  selectPro2NodeAfterSpawn(store.setNodes, videoId);
}

function attachImageAudioVideoPreset(
  videoId: string,
  preset: "lip-sync-broadcast" | "reference-audio-to-video",
  vx: number,
  vy: number,
  videoH: number,
  gap: number,
  store: AttachStarterStore,
  dims: {
    imageW: number;
    imageH: number;
    audioW: number;
    audioH: number;
  },
): void {
  const stackLeft = vx - Math.max(dims.imageW, dims.audioW) - gap;
  const stackTop =
    vy + Math.max(0, (videoH - dims.imageH - dims.audioH - 24) / 2);
  const imageId = store.addNode(
    "story-pro2-image",
    { x: stackLeft, y: stackTop },
    buildPro2ImageNodeData({
      label: "图片",
      pro2PresetKind: preset,
    }),
  );
  const audioOverrides =
    preset === "lip-sync-broadcast"
      ? {
          pro2PresetKind: preset,
          engine: { ...LIP_SYNC_AUDIO_ENGINE },
        }
      : {
          pro2PresetKind: preset,
          engine: { ...REF_AUDIO_AUDIO_ENGINE },
        };
  const audioId = store.addNode(
    "story-pro2-audio",
    { x: stackLeft, y: stackTop + dims.imageH + 24 },
    buildPro2AudioNodeData({
      label: "音频",
      ...audioOverrides,
    }),
  );
  const videoOverrides =
    preset === "reference-audio-to-video"
      ? {
          pro2PresetKind: preset,
          referenceMode: "omni" as const,
          dockInputMode: "omni" as const,
          engine: { ...REF_AUDIO_VIDEO_ENGINE },
        }
      : {
          pro2PresetKind: preset,
          resolution: "720p" as const,
        };
  store.updateNodeData(videoId, videoOverrides);
  if (!imageId || !audioId) return;
  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${imageId}-${videoId}`,
      source: imageId,
      target: videoId,
      sourceHandle: "image",
      targetHandle: "in_ref",
    },
    {
      id: `e-${audioId}-${videoId}`,
      source: audioId,
      target: videoId,
      sourceHandle: "audio",
      targetHandle: "in_ref",
    },
  ]);
  selectPro2NodeAfterSpawn(store.setNodes, videoId);
}
