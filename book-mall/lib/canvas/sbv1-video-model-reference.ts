/**
 * 分镜视频 1.0 · 各模型参考模式与 API 传参对齐（与 canvas-web 同名模块保持一致）
 */

export type Sbv1ReferenceMode = "omni" | "first_last" | "smart_multi";

export type Sbv1VideoRefApiStyle =
  | "volcengine"
  | "kling_image_urls"
  | "wan_first_last_url"
  | "bailian_r2v_media"
  | "single_i2v"
  | "motion_control";

export type Sbv1VideoModelRefCaps = {
  supportedModes: readonly Sbv1ReferenceMode[];
  refApi: Sbv1VideoRefApiStyle;
  maxRefsOmni: number;
  multiShotsBlocksFirstLast?: boolean;
};

const VOLCENGINE_VIDEO_KEYS = new Set([
  "doubao-seedance-2.0",
  "doubao-seedance-1.5-pro",
]);

/** 仅火山 Seedance 生视频须走人像库 asset://；其它模型一律用 OSS HTTPS */
export function sbv1VideoModelUsesPortraitLibrary(
  modelKey: string,
  providerId?: string,
): boolean {
  const k = modelKey.trim();
  const pid = providerId?.trim() ?? "";
  return pid.includes("volcengine") || VOLCENGINE_VIDEO_KEYS.has(k);
}

const MOTION_KEYS = new Set([
  "kling-2.6/motion-control",
  "kling-3.0/motion-control",
]);

const SINGLE_I2V_KEYS = new Set([
  "happyhorse/image-to-video",
  "kling-2.6/image-to-video",
  "kling/v3-turbo-text-to-video",
  "grok-imagine/image-to-video",
  "grok-imagine-video-1-5-preview",
]);

const KIE_MULTI_REF_KEYS = new Set(["bytedance/seedance-2"]);

const DASHSCOPE_T2V_KEYS = new Set([
  "wan2.6-t2v",
  "wan2.7-t2v",
  "wan2.7-t2v-2026-04-25",
  "wan3.0-video",
  "happyhorse-1.0-t2v",
  "happyhorse-1.1-t2v",
]);

function minimaxH3VideoMode(modelKey: string): string | null {
  const k = modelKey.trim().toLowerCase();
  if (!k.includes("minimax/minimax-h3")) return null;
  if (k.endsWith("-t2v")) return "t2v";
  if (k.endsWith("-i2v")) return "i2v";
  if (k.endsWith("-fl2v")) return "fl2v";
  if (k.endsWith("-r2v") || k.endsWith("-s2v")) return "r2v";
  if (k.endsWith("-regeneration")) return "regeneration";
  if (k.endsWith("-context-ir")) return "context_ir";
  return null;
}

export function getSbv1VideoModelRefCaps(
  modelKey: string,
  opts?: { multiShots?: boolean; providerId?: string },
): Sbv1VideoModelRefCaps {
  const k = modelKey.trim();
  const providerId = opts?.providerId?.trim() ?? "";
  const isVolc =
    providerId.includes("volcengine") || VOLCENGINE_VIDEO_KEYS.has(k);

  const h3Mode = minimaxH3VideoMode(k);
  if (h3Mode === "t2v" || h3Mode === "context_ir") {
    return { supportedModes: ["omni"], refApi: "bailian_r2v_media", maxRefsOmni: 0 };
  }
  if (h3Mode === "i2v") {
    return { supportedModes: ["omni"], refApi: "single_i2v", maxRefsOmni: 1 };
  }
  if (h3Mode === "fl2v") {
    return {
      supportedModes: ["first_last"],
      refApi: "wan_first_last_url",
      maxRefsOmni: 2,
    };
  }
  if (h3Mode === "r2v" || h3Mode === "s2v") {
    return { supportedModes: ["omni"], refApi: "bailian_r2v_media", maxRefsOmni: 9 };
  }
  if (h3Mode === "regeneration") {
    return { supportedModes: ["omni"], refApi: "single_i2v", maxRefsOmni: 0 };
  }

  if (MOTION_KEYS.has(k)) {
    return {
      supportedModes: ["omni"],
      refApi: "motion_control",
      maxRefsOmni: 1,
    };
  }

  if (SINGLE_I2V_KEYS.has(k)) {
    return {
      supportedModes: ["omni"],
      refApi: "single_i2v",
      maxRefsOmni: 1,
    };
  }

  if (isVolc) {
    return {
      supportedModes: ["omni", "first_last", "smart_multi"],
      refApi: "volcengine",
      maxRefsOmni: 9,
    };
  }

  if (k === "kling-3.0/video") {
    const multi = opts?.multiShots === true;
    return {
      supportedModes: multi ? (["omni"] as const) : (["omni", "first_last"] as const),
      refApi: "kling_image_urls",
      maxRefsOmni: 4,
      multiShotsBlocksFirstLast: true,
    };
  }

  if (k === "kling/v3-turbo-image-to-video") {
    return {
      supportedModes: ["omni", "first_last"],
      refApi: "kling_image_urls",
      maxRefsOmni: 2,
    };
  }

  if (k === "wan/2-7-image-to-video") {
    return {
      supportedModes: ["omni", "first_last"],
      refApi: "wan_first_last_url",
      maxRefsOmni: 1,
    };
  }

  if (k === "wan3.0-video") {
    return {
      supportedModes: ["omni", "first_last"],
      refApi: "bailian_r2v_media",
      maxRefsOmni: 10,
    };
  }

  if (DASHSCOPE_T2V_KEYS.has(k)) {
    return {
      supportedModes: ["omni"],
      refApi: "bailian_r2v_media",
      maxRefsOmni: k.startsWith("happyhorse") ? 9 : 5,
    };
  }

  if (k === "wan2.7-r2v") {
    return {
      supportedModes: ["omni", "first_last"],
      refApi: "bailian_r2v_media",
      maxRefsOmni: 5,
    };
  }

  if (k === "happyhorse-1.0-r2v" || k === "happyhorse-1.1-r2v") {
    return {
      supportedModes: ["omni", "first_last"],
      refApi: "bailian_r2v_media",
      maxRefsOmni: 9,
    };
  }

  if (KIE_MULTI_REF_KEYS.has(k)) {
    return {
      supportedModes: ["omni"],
      refApi: "bailian_r2v_media",
      maxRefsOmni: 8,
    };
  }

  return {
    supportedModes: ["omni"],
    refApi: "single_i2v",
    maxRefsOmni: 1,
  };
}

export function clampSbv1ReferenceMode(
  mode: Sbv1ReferenceMode,
  caps: Sbv1VideoModelRefCaps,
): Sbv1ReferenceMode {
  if (caps.supportedModes.includes(mode)) return mode;
  if (caps.supportedModes.includes("omni")) return "omni";
  return caps.supportedModes[0] ?? "omni";
}
