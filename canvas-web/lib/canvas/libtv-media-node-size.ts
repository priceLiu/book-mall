import {
  LIBTV_IMAGE_NODE_HEADER_HEIGHT,
  LIBTV_MEDIA_FIT_VERSION,
  LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION,
  LIBTV_AUDIO_TRACK_LAYOUT_VERSION,
} from "./libtv-node-chrome";
import {
  computeLibtvMediaAspectPresetSize,
  computeLibtvMediaBoxFromAspect,
  libtvMediaProfileBoxLimits,
  LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES,
  parseAspectRatioToNumbers,
  readAspectPresetProfileFromFitKey,
  readNodeAspectRatio,
  resolveEffectiveAspectRatioForPreset,
  resolveLibtvMediaAspectPresetProfile,
  shouldSkipLibtvMediaAspectPresetForNaturalMedia,
} from "./libtv-media-aspect-preset";
import {
  SBV1_IMAGE_NODE_HEIGHT,
  SBV1_IMAGE_NODE_MIN_HEIGHT,
  SBV1_IMAGE_NODE_MIN_WIDTH,
  SBV1_IMAGE_NODE_WIDTH,
  SBV1_MEDIA_CARD_HEADER_HEIGHT,
  SBV1_VIDEO_ENGINE_HEIGHT,
  SBV1_VIDEO_ENGINE_MIN_WIDTH,
  SBV1_VIDEO_ENGINE_RESIZE_MIN_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";
import {
  PRO2_IMAGE_NODE_HEIGHT,
  PRO2_IMAGE_NODE_MIN_HEIGHT,
  PRO2_IMAGE_NODE_MIN_WIDTH,
  PRO2_IMAGE_NODE_WIDTH,
  PRO2_AUDIO_NODE_HEIGHT,
  PRO2_AUDIO_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import type { CanvasFlowNode } from "./types";
import { groupHasSbv1VideoChildren } from "./sbv1-media-group-meta";

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

/** 按媒体宽高比计算 LibTV 媒体卡外框尺寸（含标题栏）· 与 preset 共用顶边算法 */
export function computeLibtvMediaNodeSize(
  naturalWidth: number,
  naturalHeight: number,
  profile: LibtvMediaAutoFitProfile,
): LibtvMediaNodeSize {
  const nw = Math.max(1, naturalWidth);
  const nh = Math.max(1, naturalHeight);
  const presetProfile =
    profile === "sbv1-video" || profile === "sbv1-media"
      ? "sbv1-video"
      : "pro2-image";

  return computeLibtvMediaBoxFromAspect({
    aspectW: nw,
    aspectH: nh,
    profile: presetProfile,
    ...libtvMediaProfileBoxLimits(presetProfile),
  });
}

function readNodeMeasuredBox(node: LibtvMediaNodeBoxInput): LibtvMediaNodeSize {
  const style = node.style as
    | { width?: number | string; height?: number | string }
    | undefined;
  const w = Math.max(
    1,
    Math.round(
      (typeof node.width === "number" ? node.width : undefined) ??
        numericStyleDim(style?.width) ??
        node.measured?.width ??
        320,
    ),
  );
  const h = Math.max(
    1,
    Math.round(
      (typeof node.height === "number" ? node.height : undefined) ??
        numericStyleDim(style?.height) ??
        node.measured?.height ??
        240,
    ),
  );
  return { width: w, height: h };
}

function autoFitProfileForNode(node: Pick<CanvasFlowNode, "type">): LibtvMediaAutoFitProfile {
  if (node.type === "sbv1-video-engine") return "sbv1-video";
  return "sbv1-media";
}

function factoryLibtvMediaNodeBox(node: Pick<CanvasFlowNode, "type">): LibtvMediaNodeSize {
  if (node.type === "sbv1-video-engine") {
    return { width: SBV1_VIDEO_ENGINE_WIDTH, height: SBV1_VIDEO_ENGINE_HEIGHT };
  }
  if (node.type === "sbv1-image" || node.type === "story-pro2-image") {
    return { width: SBV1_IMAGE_NODE_WIDTH, height: SBV1_IMAGE_NODE_HEIGHT };
  }
  if (node.type === "story-pro2-audio") {
    return { width: PRO2_AUDIO_NODE_WIDTH, height: PRO2_AUDIO_NODE_HEIGHT };
  }
  return { width: PRO2_IMAGE_NODE_WIDTH, height: PRO2_IMAGE_NODE_HEIGHT };
}

/** 旧音频节点外框（方卡 354×398 或偏短横条）→ 迁移为音轨条 */
function isLegacyPro2AudioNodeBox(width: number, height: number): boolean {
  return (
    height > PRO2_AUDIO_NODE_HEIGHT * 1.15 ||
    width < PRO2_AUDIO_NODE_WIDTH * 0.82
  );
}

function pro2AudioTrackBoxNeedsMigrate(node: CanvasFlowNode): boolean {
  if (node.type !== "story-pro2-audio") return false;
  const d = node.data as {
    manualSize?: boolean;
    audioTrackLayoutVersion?: number;
  };
  if (d.manualSize) return false;
  if ((d.audioTrackLayoutVersion ?? 0) < LIBTV_AUDIO_TRACK_LAYOUT_VERSION) {
    return true;
  }
  const box = readNodeMeasuredBox(node);
  return (
    box.width !== PRO2_AUDIO_NODE_WIDTH ||
    box.height !== PRO2_AUDIO_NODE_HEIGHT ||
    isLegacyPro2AudioNodeBox(box.width, box.height)
  );
}

/**
 * LibTV 媒体节点外框 · 唯一真源（比例 preset / 媒体自适配 / 出厂默认）。
 * 组布局、hydrate 迁移、Dock 改比例、auto-fit 均须走此函数，禁止各读 node.width 分叉。
 */
export function resolveLibtvMediaNodeBoxSize(
  node: CanvasFlowNode,
  allNodes?: CanvasFlowNode[],
): LibtvMediaNodeSize {
  const data = node.data as {
    pro2MediaRole?: string;
    gridSplitFrameCrop?: boolean;
    mediaFit?: boolean;
    mediaNaturalW?: number;
    mediaNaturalH?: number;
  };

  if (data.gridSplitFrameCrop && data.mediaFit) {
    return readNodeMeasuredBox(node);
  }

  const presetProfile = resolveLibtvMediaAspectPresetProfile(node, allNodes);
  if (
    presetProfile &&
    !shouldSkipLibtvMediaAspectPresetForNaturalMedia(node)
  ) {
    const effectiveRatio = resolveEffectiveAspectRatioForPreset(
      readNodeAspectRatio(node),
      presetProfile,
    );
    return computeLibtvMediaAspectPresetSize(effectiveRatio, presetProfile);
  }

  if (
    data.mediaFit &&
    typeof data.mediaNaturalW === "number" &&
    typeof data.mediaNaturalH === "number" &&
    data.mediaNaturalW >= 1 &&
    data.mediaNaturalH >= 1
  ) {
    return computeLibtvMediaNodeSize(
      data.mediaNaturalW,
      data.mediaNaturalH,
      autoFitProfileForNode(node),
    );
  }

  return factoryLibtvMediaNodeBox(node);
}

/**
 * hydrate 前检测：媒体外框尺寸算法/版本变更后，须 fitView 重定位（Pro2 默认恢复旧视口会溢出屏幕）。
 */
export function libtvMediaNodesNeedViewportReflow(
  nodes: CanvasFlowNode[],
): boolean {
  for (const n of nodes) {
    const d = (n.data ?? {}) as {
      mediaAspectPresetSizeVersion?: number;
      mediaAspectPreset?: string;
      mediaFit?: boolean;
      manualSize?: boolean;
    };

    if (n.type === "jianying-auto-render-pro2" && n.parentId) {
      if (!groupHasSbv1VideoChildren(n.parentId, nodes)) continue;
      const engines = nodes.filter(
        (x) => x.parentId === n.parentId && x.type === "sbv1-video-engine",
      );
      if (engines.length === 0) continue;
      let best: LibtvMediaNodeSize | null = null;
      let bestArea = 0;
      for (const e of engines) {
        const dims = resolveLibtvMediaNodeBoxSize(e, nodes);
        const area = dims.width * dims.height;
        if (area >= bestArea) {
          bestArea = area;
          best = dims;
        }
      }
      if (!best) continue;
      const w = Math.round(n.width ?? 0);
      const h = Math.round(n.height ?? 0);
      if (d.manualSize || w !== best.width || h !== best.height) return true;
      continue;
    }

    if (!n.type || !LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES.has(n.type)) {
      if (pro2AudioTrackBoxNeedsMigrate(n)) return true;
      continue;
    }
    if (shouldSkipLibtvMediaAspectPresetForNaturalMedia(n)) continue;

    const version = d.mediaAspectPresetSizeVersion ?? 0;
    if (version < LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION) return true;

    const profile = resolveLibtvMediaAspectPresetProfile(n, nodes);
    if (!profile) continue;

    const expected = resolveLibtvMediaNodeBoxSize(n, nodes);
    const w = Math.round(n.width ?? 0);
    const h = Math.round(n.height ?? 0);
    if (w !== expected.width || h !== expected.height) return true;
  }
  return false;
}

/** hydrate / 打开画布：外框与 canonical 不一致时写回（含错误 profile 的 fitKey） */
export function reconcileLibtvMediaNodeBoxSizes(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  let changed = false;
  const next = nodes.map((n) => {
    let expected: LibtvMediaNodeSize | null = null;
    let profile: ReturnType<typeof resolveLibtvMediaAspectPresetProfile> = null;
    let effectiveRatio = "";

    if (n.type === "jianying-auto-render-pro2" && n.parentId) {
      if (groupHasSbv1VideoChildren(n.parentId, nodes)) {
        const engines = nodes.filter(
          (x) =>
            x.parentId === n.parentId && x.type === "sbv1-video-engine",
        );
        let best: LibtvMediaNodeSize | null = null;
        let bestArea = 0;
        for (const e of engines) {
          const dims = resolveLibtvMediaNodeBoxSize(e, nodes);
          const area = dims.width * dims.height;
          if (area >= bestArea) {
            bestArea = area;
            best = dims;
          }
        }
        expected = best;
      }
    } else if (n.type === "story-pro2-audio") {
      if (!pro2AudioTrackBoxNeedsMigrate(n)) return n;
      expected = {
        width: PRO2_AUDIO_NODE_WIDTH,
        height: PRO2_AUDIO_NODE_HEIGHT,
      };
    } else if (n.type && LIBTV_MEDIA_ASPECT_PRESET_NODE_TYPES.has(n.type)) {
      if (shouldSkipLibtvMediaAspectPresetForNaturalMedia(n)) {
        return n;
      }
      profile = resolveLibtvMediaAspectPresetProfile(n, nodes);
      if (!profile) return n;
      expected = resolveLibtvMediaNodeBoxSize(n, nodes);
      effectiveRatio = resolveEffectiveAspectRatioForPreset(
        readNodeAspectRatio(n),
        profile,
      );
    } else {
      return n;
    }

    if (!expected) return n;
    const d = n.data as {
      mediaAspectPreset?: string;
      mediaAspectPresetSizeVersion?: number;
      mediaFitKey?: string;
      mediaFit?: boolean;
      mediaFitVersion?: number;
      manualSize?: boolean;
    };
    const measured = readNodeMeasuredBox(n);
    if (!effectiveRatio && profile) {
      effectiveRatio = resolveEffectiveAspectRatioForPreset(
        readNodeAspectRatio(n),
        profile,
      );
    }
    const fitKeyProfile = readAspectPresetProfileFromFitKey(d.mediaFitKey);
    const sizeOk =
      measured.width === expected.width && measured.height === expected.height;
    const metaOk =
      n.type === "jianying-auto-render-pro2"
        ? !d.manualSize
        : profile &&
          d.mediaAspectPreset === effectiveRatio &&
          d.mediaAspectPresetSizeVersion ===
            LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION &&
          d.mediaFit === true &&
          d.mediaFitVersion === LIBTV_MEDIA_FIT_VERSION &&
          (!fitKeyProfile || fitKeyProfile === profile) &&
          !d.manualSize;

    if (sizeOk && metaOk) return n;

    changed = true;
    if (n.type === "jianying-auto-render-pro2" || n.type === "story-pro2-audio") {
      return {
        ...n,
        width: expected.width,
        height: expected.height,
        style: {
          ...(typeof n.style === "object" && n.style ? n.style : {}),
          width: expected.width,
          height: expected.height,
        },
        data: {
          ...n.data,
          manualSize: false,
          ...(n.type === "story-pro2-audio"
            ? { audioTrackLayoutVersion: LIBTV_AUDIO_TRACK_LAYOUT_VERSION }
            : {}),
        },
      } as CanvasFlowNode;
    }

    const { w, h } = parseAspectRatioToNumbers(effectiveRatio);
    return {
      ...n,
      width: expected.width,
      height: expected.height,
      style: {
        ...(typeof n.style === "object" && n.style ? n.style : {}),
        width: expected.width,
        height: expected.height,
      },
      data: {
        ...n.data,
        mediaAspectPreset: effectiveRatio,
        mediaAspectPresetSizeVersion: LIBTV_MEDIA_ASPECT_PRESET_SIZE_VERSION,
        mediaFit: true,
        mediaFitKey: `aspect-preset|${effectiveRatio}|${profile}`,
        mediaFitVersion: LIBTV_MEDIA_FIT_VERSION,
        mediaNaturalW: w * 100,
        mediaNaturalH: h * 100,
        manualSize: false,
      },
    } as CanvasFlowNode;
  });
  return changed ? next : nodes;
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
    mediaAspectPreset?: string;
  };

  if (d.mediaAspectPreset?.trim()) return false;

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
    const tooTall = h > expected.height * 1.12;
    const widthOff =
      Math.abs(w - expected.width) > Math.max(12, expected.width * 0.08);
    const heightOff =
      Math.abs(h - expected.height) > Math.max(12, expected.height * 0.08);
    // 比例明显错时忽略 manualSize（历史误标会永久锁死矮框）
    if (d.manualSize && !aspectMismatch && !tooShort && !widthOff && !heightOff) {
      return false;
    }
    if (tooShort || tooTall || widthOff || heightOff) return true;
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
    if (
      w >= SBV1_VIDEO_ENGINE_MIN_WIDTH * 0.95 &&
      h <= SBV1_VIDEO_ENGINE_HEIGHT + 3
    ) {
      return true;
    }
    // 出厂 1:1 方卡（粘贴/上传前的默认外框）
    if (
      w >= PRO2_IMAGE_NODE_MIN_WIDTH * 0.9 &&
      h >= PRO2_IMAGE_NODE_MIN_HEIGHT * 0.9 &&
      Math.abs(w - h) <= 16
    ) {
      return true;
    }
    return false;
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
