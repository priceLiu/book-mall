import {
  LIBTV_IMAGE_NODE_HEADER_HEIGHT,
  LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE,
  LIBTV_MEDIA_TOP_EDGE_LANDSCAPE_BASE,
  LIBTV_MEDIA_TOP_EDGE_PORTRAIT_BASE,
  LIBTV_MEDIA_TOP_EDGE_SQUARE_BASE,
  LIBTV_VIDEO_NODE_HEADER_HEIGHT,
} from "./libtv-node-chrome";
import {
  PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT,
  PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH,
  PRO2_CHARACTER_THREE_VIEW_WIDTH,
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
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
import { groupHasSbv1VideoChildren } from "./sbv1-media-group-meta";

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

export type LibtvMediaBoxOrientation = "landscape" | "portrait" | "square";

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

/** 由宽高比判定横 / 竖 / 方 */
export function libtvMediaBoxOrientation(
  aspectW: number,
  aspectH: number,
): LibtvMediaBoxOrientation {
  if (aspectW === aspectH) return "square";
  if (aspectW > aspectH) return "landscape";
  return "portrait";
}

/** 用户在 Dock 选比例后的顶边基准（× scale） */
function aspectPresetDim(base: number): number {
  const scale = LIBTV_MEDIA_ASPECT_PRESET_SIZE_SCALE;
  if (!Number.isFinite(scale) || scale <= 1) return base;
  return Math.ceil(base * scale);
}

/** 三种标准顶边长度之一（全尺寸媒体卡） */
export function libtvMediaTopEdgeSpan(
  orientation: LibtvMediaBoxOrientation,
): number {
  switch (orientation) {
    case "landscape":
      return aspectPresetDim(LIBTV_MEDIA_TOP_EDGE_LANDSCAPE_BASE);
    case "portrait":
      return aspectPresetDim(LIBTV_MEDIA_TOP_EDGE_PORTRAIT_BASE);
    case "square":
      return aspectPresetDim(LIBTV_MEDIA_TOP_EDGE_SQUARE_BASE);
  }
}

/** 横版 / 方形：固定 stage 宽（顶边），按 aspect 算 stage 高与外框总高 */
export function sizeFromFixedTopEdge(args: {
  aspectW: number;
  aspectH: number;
  topEdgeWidth: number;
  headerHeight: number;
  minWidth: number;
  minHeight: number;
}): { width: number; height: number } {
  const { aspectW, aspectH, topEdgeWidth, headerHeight, minWidth, minHeight } =
    args;
  let width = topEdgeWidth;
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

/** 竖版：固定 stage 长边（高），按 aspect 算宽与外框总高 */
export function sizeFromFixedPortraitStageHeight(args: {
  aspectW: number;
  aspectH: number;
  stageLongEdge: number;
  headerHeight: number;
  minWidth: number;
  minHeight: number;
}): { width: number; height: number } {
  const {
    aspectW,
    aspectH,
    stageLongEdge,
    headerHeight,
    minWidth,
    minHeight,
  } = args;
  let stageH = stageLongEdge;
  let width = Math.round(stageH * (aspectW / aspectH));
  let height = headerHeight + stageH;

  if (width < minWidth) {
    width = minWidth;
    stageH = Math.round(width * (aspectH / aspectW));
    height = headerHeight + stageH;
  }
  if (height < minHeight) {
    height = minHeight;
    stageH = Math.max(1, height - headerHeight);
    width = Math.ceil(stageH * (aspectW / aspectH));
    height = headerHeight + stageH;
  }

  return { width: Math.ceil(width), height: Math.ceil(height) };
}

type LibtvMediaBoxPresetOpts = {
  aspectW: number;
  aspectH: number;
  headerHeight: number;
  minWidth: number;
  minHeight: number;
  profile: LibtvMediaAspectPresetProfile;
};

function resolveLandscapeWidthForProfile(
  profile: LibtvMediaAspectPresetProfile,
): number {
  if (profile === "pro2-frame-cell" || profile === "pro2-video-cell") {
    return PRO2_FRAME_CELL_WIDTH;
  }
  if (profile === "three-view") {
    return aspectPresetDim(PRO2_CHARACTER_THREE_VIEW_WIDTH);
  }
  return libtvMediaTopEdgeSpan("landscape");
}

function resolvePortraitStageHeightForProfile(
  profile: LibtvMediaAspectPresetProfile,
): number {
  if (profile === "pro2-frame-cell" || profile === "pro2-video-cell") {
    return PRO2_FRAME_CELL_WIDTH;
  }
  if (profile === "three-view") {
    return Math.round(
      aspectPresetDim(PRO2_CHARACTER_THREE_VIEW_WIDTH) * (16 / 9),
    );
  }
  return libtvMediaTopEdgeSpan("portrait");
}

function resolveSquareEdgeForProfile(
  profile: LibtvMediaAspectPresetProfile,
): number {
  if (profile === "pro2-frame-cell" || profile === "pro2-video-cell") {
    return PRO2_FRAME_CELL_WIDTH;
  }
  if (profile === "three-view") {
    return aspectPresetDim(PRO2_CHARACTER_THREE_VIEW_WIDTH);
  }
  return libtvMediaTopEdgeSpan("square");
}

/**
 * LibTV 媒体外框 · 唯一尺寸算法（@ zoom 100%）。
 * 横版固定宽 · 竖版固定 stage 高 · 方形固定边长。
 */
export function computeLibtvMediaBoxFromAspect(args: LibtvMediaBoxPresetOpts): {
  width: number;
  height: number;
} {
  const { aspectW, aspectH, headerHeight, minWidth, minHeight, profile } = args;
  const orientation = libtvMediaBoxOrientation(aspectW, aspectH);

  if (orientation === "portrait") {
    return sizeFromFixedPortraitStageHeight({
      aspectW,
      aspectH,
      stageLongEdge: resolvePortraitStageHeightForProfile(profile),
      headerHeight,
      minWidth,
      minHeight,
    });
  }

  const topEdgeWidth =
    orientation === "square"
      ? resolveSquareEdgeForProfile(profile)
      : resolveLandscapeWidthForProfile(profile);

  return sizeFromFixedTopEdge({
    aspectW,
    aspectH,
    topEdgeWidth,
    headerHeight,
    minWidth,
    minHeight,
  });
}

export function libtvMediaProfileBoxLimits(profile: LibtvMediaAspectPresetProfile): {
  headerHeight: number;
  minWidth: number;
  minHeight: number;
} {
  if (profile === "sbv1-video" || profile === "sbv1-image") {
    return {
      headerHeight: LIBTV_VIDEO_NODE_HEADER_HEIGHT,
      minWidth: aspectPresetDim(SBV1_VIDEO_ENGINE_MIN_WIDTH),
      minHeight: aspectPresetDim(SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT),
    };
  }
  if (profile === "pro2-video-cell") {
    return {
      headerHeight: LIBTV_VIDEO_NODE_HEADER_HEIGHT,
      minWidth: PRO2_FRAME_CELL_MIN_WIDTH,
      minHeight: PRO2_FRAME_CELL_MIN_HEIGHT,
    };
  }
  if (profile === "pro2-frame-cell") {
    return {
      headerHeight: LIBTV_IMAGE_NODE_HEADER_HEIGHT,
      minWidth: PRO2_FRAME_CELL_MIN_WIDTH,
      minHeight: PRO2_FRAME_CELL_MIN_HEIGHT,
    };
  }
  if (profile === "three-view") {
    return {
      headerHeight: LIBTV_IMAGE_NODE_HEADER_HEIGHT,
      minWidth: aspectPresetDim(PRO2_CHARACTER_THREE_VIEW_MIN_WIDTH),
      minHeight: aspectPresetDim(PRO2_CHARACTER_THREE_VIEW_MIN_HEIGHT),
    };
  }
  return {
    headerHeight: LIBTV_IMAGE_NODE_HEADER_HEIGHT,
    minWidth: aspectPresetDim(PRO2_IMAGE_NODE_MIN_WIDTH),
    minHeight: aspectPresetDim(PRO2_IMAGE_NODE_MIN_HEIGHT),
  };
}

/** 按声明比例计算 LibTV 媒体节点外框（含标题栏）· 生成前/选比例后立即应用 */
export function computeLibtvMediaAspectPresetSize(
  aspectRatio: string,
  profile: LibtvMediaAspectPresetProfile,
): { width: number; height: number } {
  const { w, h } = parseAspectRatioToNumbers(aspectRatio);
  const limits = libtvMediaProfileBoxLimits(profile);
  return computeLibtvMediaBoxFromAspect({
    aspectW: w,
    aspectH: h,
    profile,
    ...limits,
  });
}

export function resolveLibtvMediaAspectPresetProfile(
  node: Pick<CanvasFlowNode, "type" | "data" | "parentId">,
  allNodes?: CanvasFlowNode[],
): LibtvMediaAspectPresetProfile | null {
  const type = node.type ?? "";
  const d = (node.data ?? {}) as { pro2MediaRole?: string };
  const role = d.pro2MediaRole;

  if (type === "story-pro2-three-view") return "three-view";
  if (type === "sbv1-video-engine") {
    return role === "video" ? "pro2-video-cell" : "sbv1-video";
  }
  /** sbv1 图片与视频合成须同一 profile，避免 350×2 vs 635×2 分叉 */
  if (type === "sbv1-image") return "sbv1-video";
  if (
    type === "story-pro2-image" ||
    type === "story-pro2-prop" ||
    type === "story-pro2-mood"
  ) {
    // 分镜/场景格固定小宫格；其余只要组内已有视频引擎，就与 sbv1-video 外框对齐
    // （含 pro2Kind=frame-board 混组：此前只认 isSbv1MediaGroup，导致图 700、视频 1270）
    if (
      node.parentId &&
      allNodes &&
      groupHasSbv1VideoChildren(node.parentId, allNodes)
    ) {
      return "sbv1-video";
    }
    if (role === "scene" || role === "frame") return "three-view";
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
  if (profile === "sbv1-video" || profile === "sbv1-image") return "4:3";
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

export function readAspectPresetProfileFromFitKey(
  fitKey?: string | null,
): LibtvMediaAspectPresetProfile | null {
  if (!fitKey?.startsWith("aspect-preset|")) return null;
  const profile = fitKey.split("|")[2]?.trim();
  if (
    profile === "pro2-image" ||
    profile === "pro2-frame-cell" ||
    profile === "pro2-video-cell" ||
    profile === "three-view" ||
    profile === "sbv1-image" ||
    profile === "sbv1-video"
  ) {
    return profile;
  }
  return null;
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
    runtime?: { status?: string; ossUrl?: string; ephemeralUrl?: string };
  };

  if (d.pro2HdFromGridSplit || d.gridSplitCrop) return false;

  const role = d.pro2MediaRole?.trim();
  if (role === "frame" || role === "scene" || role === "video") {
    return false;
  }

  /** 本地上传 / 拖入：须优先于 aspectRatio（视频节点默认 16:9 不应挡住 natural fit） */
  if (d.uploading || d.imageMode === "upload") return true;
  if (d.blobUrl?.trim()) return true;
  if (node.type === "sbv1-video-engine") {
    const mediaUrl =
      d.runtime?.ossUrl?.trim() || d.runtime?.ephemeralUrl?.trim();
    if (mediaUrl) {
      const rt = d.runtime?.status;
      if (!rt || rt === "done" || rt === "idle") return true;
    }
  }

  const ar = d.aspectRatio?.trim();
  if (ar && ar !== "auto") return false;

  if (
    d.ossUrl?.trim() &&
    (role === "generic" || role === "prop" || role === "mood" || !role)
  ) {
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

  return false;
}
