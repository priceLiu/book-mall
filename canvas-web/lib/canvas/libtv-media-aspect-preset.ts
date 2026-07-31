import {
  LIBTV_IMAGE_NODE_HEADER_HEIGHT,
  LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE,
  LIBTV_VIDEO_NODE_HEADER_HEIGHT,
} from "./libtv-node-chrome";
import {
  PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH,
  PRO2_CHARACTER_THREE_VIEW_WIDTH,
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import {
  SBV1_IMAGE_NODE_MIN_HEIGHT,
  SBV1_IMAGE_NODE_MIN_WIDTH,
  SBV1_VIDEO_ENGINE_MIN_WIDTH,
  SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT,
} from "./sbv1-node-chrome";
import type { Sbv1ImageAspectRatio } from "./sbv1-image-models";
import type { Sbv1AspectRatio } from "./sbv1-workspace-types";
import type { CanvasFlowNode } from "./types";

export type LibtvMediaAspectPresetProfile =
  | "pro2-image"
  | "pro2-frame-cell"
  | "pro2-video-cell"
  | "three-view"
  | "sbv1-image"
  | "sbv1-video";

/** 与 pro2-media-group-layout PRO2_FRAME_CELL_* 同步 */
const PRO2_FRAME_CELL_WIDTH = 296;
const PRO2_FRAME_CELL_MIN_WIDTH = 220;
const PRO2_FRAME_CELL_MIN_HEIGHT = 146;

export const LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES = new Set([
  "sbv1-image",
  "sbv1-video-engine",
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-prop",
  "story-pro2-mood",
]);

/** 解析比例字符串为宽高比数值 */
export function parseAspectRatioToNumbers(ratio: string): {
  w: number;
  h: number;
} {
  const raw = ratio.trim();
  if (!raw || raw === "auto") return { w: 1, h: 1 };
  const parts = raw.split(":");
  if (parts.length !== 2) return { w: 1, h: 1 };
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { w: 1, h: 1 };
  }
  return { w, h };
}

function sizeFromBaseWidth(args: {
  aspectW: number;
  aspectH: number;
  baseWidth: number;
  headerHeight: number;
  minWidth: number;
  minHeight: number;
}): { width: number; height: number } {
  const { aspectW, aspectH, baseWidth, headerHeight, minWidth, minHeight } =
    args;
  let width = baseWidth;
  let stageH = Math.round(width * (aspectH / aspectW));
  let height = headerHeight + stageH;

  if (width < minWidth) {
    width = minWidth;
    stageH = Math.round(width * (aspectH / aspectW));
    height = headerHeight + stageH;
  }
  if (height < minHeight) {
    height = minHeight;
    const stageH2 = Math.max(1, height - headerHeight);
    width = Math.ceil(stageH2 * (aspectW / aspectH));
    height = headerHeight + stageH2;
  }

  return { width: Math.ceil(width), height: Math.ceil(height) };
}

/** 用户在 Dock 选比例后的基准宽/下限（× `LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE`） */
function aspectPresetDim(base: number): number {
  const scale = LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE;
  if (!Number.isFinite(scale) || scale <= 1) return base;
  return Math.ceil(base * scale);
}

/** 按声明比例计算 LibTV 媒体节点外框（含标题栏）· 生成前/选比例后立即应用 */
export function computeLibtvMediaAspectPresetSize(
  aspectRatio: string,
  profile: LibtvMediaAspectPresetProfile,
): { width: number; height: number } {
  const { w, h } = parseAspectRatioToNumbers(aspectRatio);

  if (profile === "sbv1-video") {
    return sizeFromBaseWidth({
      aspectW: w,
      aspectH: h,
      baseWidth: aspectPresetDim(635),
      headerHeight: LIBTV_VIDEO_NODE_HEADER_HEIGHT,
      minWidth: aspectPresetDim(SBV1_VIDEO_ENGINE_MIN_WIDTH),
      minHeight: aspectPresetDim(SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT),
    });
  }

  if (profile === "sbv1-image") {
    return sizeFromBaseWidth({
      aspectW: w,
      aspectH: h,
      baseWidth: aspectPresetDim(635),
      headerHeight: LIBTV_IMAGE_NODE_HEADER_HEIGHT,
      minWidth: aspectPresetDim(SBV1_IMAGE_NODE_MIN_WIDTH),
      minHeight: aspectPresetDim(SBV1_IMAGE_NODE_MIN_HEIGHT),
    });
  }

  if (profile === "three-view") {
    return sizeFromBaseWidth({
      aspectW: w,
      aspectH: h,
      baseWidth: aspectPresetDim(PRO2_CHARACTER_THREE_VIEW_WIDTH),
      headerHeight: LIBTV_IMAGE_NODE_HEADER_HEIGHT,
      minWidth: aspectPresetDim(PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH),
      minHeight: aspectPresetDim(PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT),
    });
  }

  if (profile === "pro2-frame-cell") {
    return sizeFromBaseWidth({
      aspectW: w,
      aspectH: h,
      baseWidth: aspectPresetDim(PRO2_FRAME_CELL_WIDTH),
      headerHeight: LIBTV_IMAGE_NODE_HEADER_HEIGHT,
      minWidth: aspectPresetDim(PRO2_FRAME_CELL_MIN_WIDTH),
      minHeight: aspectPresetDim(PRO2_FRAME_CELL_MIN_HEIGHT),
    });
  }

  if (profile === "pro2-video-cell") {
    return sizeFromBaseWidth({
      aspectW: w,
      aspectH: h,
      baseWidth: aspectPresetDim(PRO2_FRAME_CELL_WIDTH),
      headerHeight: LIBTV_VIDEO_NODE_HEADER_HEIGHT,
      minWidth: aspectPresetDim(PRO2_FRAME_CELL_MIN_WIDTH),
      minHeight: aspectPresetDim(PRO2_FRAME_CELL_MIN_HEIGHT),
    });
  }

  return sizeFromBaseWidth({
    aspectW: w,
    aspectH: h,
    baseWidth: aspectPresetDim(PRO2_IMAGE_NODE_WIDTH),
    headerHeight: LIBTV_IMAGE_NODE_HEADER_HEIGHT,
    minWidth: aspectPresetDim(PRO2_IMAGE_NODE_MIN_WIDTH),
    minHeight: aspectPresetDim(PRO2_IMAGE_NODE_MIN_HEIGHT),
  });
}

export function resolveLibtvMediaAspectPresetProfile(
  node: Pick<CanvasFlowNode, "type" | "data">,
): LibtvMediaAspectPresetProfile | null {
  const type = node.type ?? "";
  const d = (node.data ?? {}) as { pro2MediaRole?: string };
  const role = d.pro2MediaRole;

  if (type === "story-pro2-three-view") return "three-view";
  if (type === "sbv1-video-engine") {
    return role === "video" ? "pro2-video-cell" : "sbv1-video";
  }
  if (type === "sbv1-image") return "sbv1-image";
  if (
    type === "story-pro2-image" ||
    type === "story-pro2-prop" ||
    type === "story-pro2-mood"
  ) {
    if (role === "frame" || role === "scene") return "pro2-frame-cell";
    return "pro2-image";
  }
  return null;
}

export function readNodeAspectRatio(
  node: Pick<CanvasFlowNode, "type" | "data">,
): string {
  const d = node.data as {
    aspectRatio?: Sbv1ImageAspectRatio | Sbv1AspectRatio | string;
    pro2MediaRole?: string;
  };
  const raw = d.aspectRatio?.trim();
  if (raw) return raw;
  if (node.type === "story-pro2-three-view") return "16:9";
  if (node.type === "sbv1-video-engine") return "4:3";
  if (
    d.pro2MediaRole === "frame" ||
    d.pro2MediaRole === "scene" ||
    d.pro2MediaRole === "video"
  ) {
    return "16:9";
  }
  return "auto";
}

/** auto 时按节点类型解析为常用默认比例（与 batch picker 默认一致） */
export function resolveEffectiveAspectRatioForPreset(
  aspectRatio: string,
  profile: LibtvMediaAspectPresetProfile,
): string {
  const raw = aspectRatio.trim();
  if (raw && raw !== "auto") return raw;
  if (
    profile === "three-view" ||
    profile === "pro2-frame-cell" ||
    profile === "pro2-video-cell"
  ) {
    return "16:9";
  }
  if (profile === "sbv1-video") return "4:3";
  return "1:1";
}

export function libtvNodeUsesAspectPreset(node: {
  type?: string;
  data?: unknown;
}): boolean {
  if (!node.type || !LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES.has(node.type)) {
    return false;
  }
  return Boolean(
    (node.data as { mediaAspectPreset?: string } | undefined)?.mediaAspectPreset
      ?.trim(),
  );
}

/**
 * 粘贴/本地上传：按图片 natural 尺寸自适配外框，不用固定 1:1 比例预设。
 * 分镜/场景/视频格与用户显式选择 aspectRatio 时仍走 preset。
 */
export function shouldSkipLibtvMediaAspectPresetForNaturalMedia(
  node: Pick<CanvasFlowNode, "type" | "data">,
): boolean {
  const d = (node.data ?? {}) as {
    aspectRatio?: string;
    blobUrl?: string;
    ossUrl?: string;
    uploading?: boolean;
    imageMode?: string;
    pro2MediaRole?: string;
    pro2HdFromGridSplit?: boolean;
    gridSplitCrop?: unknown;
    runtime?: { status?: string };
  };

  if (d.pro2HdFromGridSplit || d.gridSplitCrop) return false;

  const role = d.pro2MediaRole?.trim();
  if (role === "frame" || role === "scene" || role === "video") {
    return false;
  }

  const ar = d.aspectRatio?.trim();
  if (ar && ar !== "auto") return false;

  if (d.blobUrl?.trim() || d.uploading || d.imageMode === "upload") {
    return true;
  }

  const rt = d.runtime?.status;
  if (
    rt === "pending" ||
    rt === "running" ||
    rt === "succeeded" ||
    rt === "failed"
  ) {
    return false;
  }

  if (d.ossUrl?.trim() && !role) {
    return true;
  }

  return false;
}
