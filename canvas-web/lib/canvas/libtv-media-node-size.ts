import {
  LIBTV_IMAGE_NODE_HEADER_HEIGHT,
  LIBTV_MEDIA_AUTO_FIT_LONG_EDGE,
} from "./libtv-node-chrome";
import {
  SBV1_IMAGE_NODE_MIN_HEIGHT,
  SBV1_IMAGE_NODE_MIN_WIDTH,
  SBV1_MEDIA_CARD_HEADER_HEIGHT,
  SBV1_VIDEO_ENGINE_HEIGHT,
  SBV1_VIDEO_ENGINE_MIN_WIDTH,
  SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT,
} from "./sbv1-node-chrome";
import {
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
} from "./story-pro2-node-chrome";

export type LibtvMediaAutoFitProfile = "square-image" | "sbv1-video" | "sbv1-media";

export type LibtvMediaNodeSize = {
  width: number;
  height: number;
};

/** RF Node.style 可能是 CSSProperties（width 为 string|number）；只取数值 */
function numericStyleDim(
  value: number | string | undefined,
): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

type LibtvMediaNodeBoxInput = {
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
  /** React Flow CSSProperties；width/height 可能是 string，读取时再 coerce */
  style?: unknown;
  data?: unknown;
};

/** 按媒体宽高比计算 LibTV 媒体卡外框尺寸（含标题栏） */
export function computeLibtvMediaNodeSize(
  naturalWidth: number,
  naturalHeight: number,
  profile: LibtvMediaAutoFitProfile,
): LibtvMediaNodeSize {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const headerHeight =
    profile === "sbv1-video"
      ? SBV1_MEDIA_CARD_HEADER_HEIGHT
      : profile === "sbv1-media"
        ? LIBTV_IMAGE_NODE_HEADER_HEIGHT
        : LIBTV_IMAGE_NODE_HEADER_HEIGHT;
  const minWidth =
    profile === "sbv1-video" || profile === "sbv1-media"
      ? SBV1_VIDEO_ENGINE_MIN_WIDTH
      : profile === "square-image"
        ? SBV1_IMAGE_NODE_MIN_WIDTH
        : PRO2_IMAGE_NODE_MIN_WIDTH;
  const minHeight =
    profile === "sbv1-video" || profile === "sbv1-media"
      ? SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT
      : profile === "square-image"
        ? SBV1_IMAGE_NODE_MIN_HEIGHT
        : PRO2_IMAGE_NODE_MIN_HEIGHT;

  if (profile === "sbv1-video" || profile === "sbv1-media") {
    let width = 635;
    let stageHeight = width * (nh / nw);
    let height = headerHeight + stageHeight;

    if (height < minHeight) {
      height = minHeight;
      stageHeight = Math.max(1, height - headerHeight);
      width = stageHeight * (nw / nh);
    }
    if (width < minWidth) {
      width = minWidth;
      stageHeight = width * (nh / nw);
      height = headerHeight + stageHeight;
    }

    return {
      width: Math.ceil(width),
      height: Math.ceil(height),
    };
  }

  const longEdge = Math.max(nw, nh);
  const scale = LIBTV_MEDIA_AUTO_FIT_LONG_EDGE / longEdge;
  let width = Math.ceil(nw * scale);
  let stageHeight = Math.ceil(nh * scale);
  let height = headerHeight + stageHeight;

  if (width < minWidth) {
    width = minWidth;
    stageHeight = Math.ceil(width * (nh / nw));
    height = headerHeight + stageHeight;
  }
  if (height < minHeight) {
    height = minHeight;
    stageHeight = Math.max(1, height - headerHeight);
    width = Math.ceil(stageHeight * (nw / nh));
  }

  return { width, height };
}

/** 外框与 mediaNatural* / 默认横条盒不一致时须重算 */
export function isLibtvMediaNodeBoxStale(
  node: LibtvMediaNodeBoxInput,
  profile: LibtvMediaAutoFitProfile,
): boolean {
  if (profile !== "sbv1-media" && profile !== "sbv1-video") return false;

  const d = (node.data ?? {}) as {
    mediaFit?: boolean;
    mediaNaturalW?: number;
    mediaNaturalH?: number;
    manualSize?: boolean;
  };

  // 优先用节点显式宽高（store），避免 RF measured 滞后掩盖矮框
  const style = node.style as
    | { width?: number | string; height?: number | string }
    | undefined;
  const w = Math.max(
    1,
    Math.round(
      (typeof node.width === "number" ? node.width : undefined) ??
        numericStyleDim(style?.width) ??
        node.measured?.width ??
        1,
    ),
  );
  const h = Math.max(
    1,
    Math.round(
      (typeof node.height === "number" ? node.height : undefined) ??
        numericStyleDim(style?.height) ??
        node.measured?.height ??
        1,
    ),
  );

  const nw = d.mediaNaturalW;
  const nh = d.mediaNaturalH;
  if (
    typeof nw === "number" &&
    typeof nh === "number" &&
    nw >= 1 &&
    nh >= 1
  ) {
    const expected = computeLibtvMediaNodeSize(nw, nh, profile);
    const boxAspect = w / h;
    const mediaAspect = nw / nh;
    const aspectMismatch =
      (mediaAspect < 0.92 && boxAspect > 1.05) ||
      (mediaAspect > 1.08 && boxAspect < 0.95);
    const tooShort = h < expected.height * 0.88;
    // 比例明显错时忽略 manualSize（历史误标会永久锁死矮框）
    if (d.manualSize && !aspectMismatch && !tooShort) return false;
    if (tooShort) return true;
    if (
      w >= expected.width * 0.85 &&
      Math.abs(w - expected.width) <= expected.width * 0.12 &&
      h < expected.height * 0.95
    ) {
      return true;
    }
    if (aspectMismatch) return true;
    return false;
  }

  if (d.manualSize) return false;
  if (!d.mediaFit) {
    // 有媒体但未 fit，且停在出厂横条 → 视为 stale，强制重算
    return (
      w >= SBV1_VIDEO_ENGINE_MIN_WIDTH * 0.95 &&
      h <= SBV1_VIDEO_ENGINE_HEIGHT + 3
    );
  }

  const stuckAtFactoryDefault =
    w >= SBV1_VIDEO_ENGINE_MIN_WIDTH * 0.95 &&
    h <= SBV1_VIDEO_ENGINE_HEIGHT + 3;
  return stuckAtFactoryDefault;
}

/** 组内/重排：按 mediaNatural* 修正「宽正确、高偏矮」的横条盒 */
export function resolveLibtvImageCellSize(
  node: LibtvMediaNodeBoxInput,
): LibtvMediaNodeSize {
  const d = (node.data ?? {}) as {
    mediaFit?: boolean;
    mediaNaturalW?: number;
    mediaNaturalH?: number;
  };
  const style = node.style as
    | { width?: number | string; height?: number | string }
    | undefined;
  const w = Math.max(
    1,
    Math.round(
      node.measured?.width ??
        (typeof node.width === "number" ? node.width : undefined) ??
        numericStyleDim(style?.width) ??
        SBV1_VIDEO_ENGINE_MIN_WIDTH,
    ),
  );
  const h = Math.max(
    1,
    Math.round(
      node.measured?.height ??
        (typeof node.height === "number" ? node.height : undefined) ??
        numericStyleDim(style?.height) ??
        SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT,
    ),
  );

  if (
    !d.mediaFit ||
    typeof d.mediaNaturalW !== "number" ||
    typeof d.mediaNaturalH !== "number" ||
    d.mediaNaturalW < 1 ||
    d.mediaNaturalH < 1
  ) {
    return { width: w, height: h };
  }

  const expected = computeLibtvMediaNodeSize(
    d.mediaNaturalW,
    d.mediaNaturalH,
    "sbv1-media",
  );
  const mediaPortrait = d.mediaNaturalH > d.mediaNaturalW;
  const boxTooShort = h < expected.height * 0.88;

  if (mediaPortrait && h <= w * 1.08 && boxTooShort) {
    return {
      width: w,
      height: Math.max(
        expected.height,
        Math.ceil(expected.height * (w / expected.width)),
      ),
    };
  }

  if (boxTooShort && w >= expected.width * 0.85) {
    return {
      width: w,
      height: Math.ceil(expected.height * (w / expected.width)),
    };
  }

  return { width: w, height: h };
}
