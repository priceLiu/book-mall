/** 参考生视频 · AI 视频引擎模型清单（独立于 story video-engine） */

export const REF_VIDEO_BAILIAN_MODEL_KEYS = [
  "happyhorse-1.0-r2v",
  "happyhorse-1.1-r2v",
  "wan2.6-r2v",
  "wan2.6-r2v-flash",
  "wan2.7-r2v",
] as const;

export const REF_VIDEO_KIE_MODEL_KEYS = ["bytedance/seedance-2"] as const;

export const REF_VIDEO_MODEL_KEYS = [
  ...REF_VIDEO_BAILIAN_MODEL_KEYS,
  ...REF_VIDEO_KIE_MODEL_KEYS,
] as const;

export type RefVideoModelKey = (typeof REF_VIDEO_MODEL_KEYS)[number];

export const REF_VIDEO_DEFAULT_MODEL_KEY: RefVideoModelKey =
  "happyhorse-1.0-r2v";

export const REF_VIDEO_RATIO_OPTIONS = [
  "16:9",
  "9:16",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "1:1",
] as const;

export type RefVideoModelMeta = {
  modelKey: RefVideoModelKey;
  displayName: string;
  providerKind: "BAILIAN_R2V" | "KIE";
  maxRefImages: number;
  defaultParams: Record<string, unknown>;
};

export const REF_VIDEO_MODEL_META: Record<
  RefVideoModelKey,
  RefVideoModelMeta
> = {
  "happyhorse-1.0-r2v": {
    modelKey: "happyhorse-1.0-r2v",
    displayName: "HappyHorse-1.0-R2V",
    providerKind: "BAILIAN_R2V",
    maxRefImages: 9,
    defaultParams: {
      ratio: "16:9",
      resolution: "1080P",
      duration: 5,
      seed: "",
    },
  },
  "happyhorse-1.1-r2v": {
    modelKey: "happyhorse-1.1-r2v",
    displayName: "HappyHorse-1.1-R2V",
    providerKind: "BAILIAN_R2V",
    maxRefImages: 9,
    defaultParams: {
      ratio: "16:9",
      resolution: "1080P",
      duration: 5,
      seed: "",
    },
  },
  "wan2.6-r2v": {
    modelKey: "wan2.6-r2v",
    displayName: "Wan 2.6 R2V",
    providerKind: "BAILIAN_R2V",
    maxRefImages: 9,
    defaultParams: {
      ratio: "16:9",
      resolution: "1080P",
      duration: 5,
      seed: "",
      prompt_extend: true,
    },
  },
  "wan2.6-r2v-flash": {
    modelKey: "wan2.6-r2v-flash",
    displayName: "Wan 2.6 R2V Flash",
    providerKind: "BAILIAN_R2V",
    maxRefImages: 9,
    defaultParams: {
      ratio: "16:9",
      resolution: "1080P",
      duration: 5,
      seed: "",
      prompt_extend: true,
    },
  },
  "wan2.7-r2v": {
    modelKey: "wan2.7-r2v",
    displayName: "Wan 2.7 R2V",
    providerKind: "BAILIAN_R2V",
    maxRefImages: 9,
    defaultParams: {
      ratio: "16:9",
      resolution: "1080P",
      duration: 5,
      seed: "",
      prompt_extend: true,
    },
  },
  "bytedance/seedance-2": {
    modelKey: "bytedance/seedance-2",
    displayName: "Seedance 2",
    providerKind: "KIE",
    maxRefImages: 8,
    defaultParams: {
      aspect_ratio: "16:9",
      resolution: "1080p",
      duration: 5,
    },
  },
};

export function isRefVideoModelKey(k: string): k is RefVideoModelKey {
  return (REF_VIDEO_MODEL_KEYS as readonly string[]).includes(k);
}

export function refVideoProviderKind(
  modelKey: string,
): "BAILIAN_R2V" | "KIE" | null {
  if (!isRefVideoModelKey(modelKey)) return null;
  return REF_VIDEO_MODEL_META[modelKey].providerKind;
}

export const REF_GRID_NODE_TYPES = [
  "ref-grid-4",
  "ref-grid-6",
  "ref-grid-9",
] as const;

export type RefGridNodeType = (typeof REF_GRID_NODE_TYPES)[number];

export function isRefGridNodeType(t: string): t is RefGridNodeType {
  return (REF_GRID_NODE_TYPES as readonly string[]).includes(t);
}

export function refGridSlotCount(type: string): number {
  if (type === "ref-grid-4") return 4;
  if (type === "ref-grid-6") return 6;
  if (type === "ref-grid-9") return 9;
  return 0;
}

/** 宫格节点默认 / 最小尺寸（拖入画布初值与 NodeResizer 下限） */
export const REF_GRID_NODE_SIZE: Record<
  RefGridNodeType,
  { width: number; height: number }
> = {
  "ref-grid-4": { width: 960, height: 880 },
  "ref-grid-6": { width: 1120, height: 800 },
  "ref-grid-9": { width: 1120, height: 1120 },
};

export function refGridNodeSize(type: string): { width: number; height: number } {
  if (isRefGridNodeType(type)) return REF_GRID_NODE_SIZE[type];
  return REF_GRID_NODE_SIZE["ref-grid-6"];
}

/** 参考生视频 · AI 视频引擎 / 视频生成 节点尺寸 */
export const REF_VIDEO_NODE_SIZE = { width: 1120, height: 1120 } as const;

export function emptyRefGridSlots(count: number) {
  return Array.from({ length: count }, () => ({}));
}
