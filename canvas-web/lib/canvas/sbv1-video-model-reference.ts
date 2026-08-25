/**
 * 分镜视频 1.0 · 各模型参考模式与 API 传参对齐（与 book-mall 同名模块保持一致）
 */
import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "./system-providers";
import type {
  Sbv1DockInputMode,
  Sbv1ReferenceMode,
  Sbv1VideoEngineNodeData,
} from "./sbv1-workspace-types";
import {
  resolveSbv1VariantIdFromEngine,
  SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS,
} from "./sbv1-video-models";

const DASHSCOPE_T2V_TO_R2V: Record<string, string> = {
  "happyhorse-1.0-t2v": "happyhorse-1.0-r2v",
  "happyhorse-1.1-t2v": "happyhorse-1.1-r2v",
  "wan2.6-t2v": "wan2.6-r2v",
  "wan2.7-t2v": "wan2.7-r2v",
  "wan2.7-t2v-2026-04-25": "wan2.7-r2v",
};

/** 百炼 T2V ↔ R2V：有参考图连到 Dock 时切 R2V，全部断开时切回 T2V */
export function resolveDashscopeVideoModelForRefLinks(
  modelKey: string,
  refLinkCount: number,
): string | null {
  const k = modelKey.trim();
  if (!k) return null;
  if (refLinkCount > 0) {
    return DASHSCOPE_T2V_TO_R2V[k] ?? null;
  }
  for (const [t2v, r2v] of Object.entries(DASHSCOPE_T2V_TO_R2V)) {
    if (r2v === k) return t2v;
  }
  return null;
}

/** 参考图连线变化时同步 engine.modelKey（HappyHorse / Wan T2V↔R2V） */
export function buildDashscopeVideoModelRefSyncPatch(
  data: Pick<Sbv1VideoEngineNodeData, "engine" | "dockInputMode">,
  refLinkCount: number,
): Partial<Sbv1VideoEngineNodeData> | null {
  const modelKey = data.engine?.modelKey?.trim() ?? "";
  const providerId = data.engine?.providerId?.trim() ?? "";
  if (!modelKey || !providerId) return null;

  const nextKey = resolveDashscopeVideoModelForRefLinks(modelKey, refLinkCount);
  if (!nextKey || nextKey === modelKey) return null;

  const engineParams = data.engine?.params ?? {};
  const defaultMode = defaultSbv1DockInputModeForModel(nextKey, { providerId });
  const modePatch = dockInputModeToPatch(defaultMode);
  const engine = { providerId, modelKey: nextKey, params: engineParams };
  const variantId = resolveSbv1VariantIdFromEngine(engine);

  return {
    engine,
    volcengineVariantId: variantId,
    jimengModelId: variantId,
    referenceMode: modePatch.referenceMode,
    dockInputMode: modePatch.dockInputMode,
  };
}

export type Sbv1VideoModelRefRunWarning = {
  title: string;
  message: string;
};

/**
 * 生成前模型与参考图是否匹配（T2V + ref、单图 I2V 多 ref 等）。
 * 返回非 null 时 Dock 应 alert 并阻止生成，由用户自行换模型或调整参考图。
 */
export function resolveSbv1VideoModelRefRunWarning(args: {
  modelKey: string;
  refCount: number;
  providerId?: string;
  multiShots?: boolean;
}): Sbv1VideoModelRefRunWarning | null {
  const refCount = Math.max(0, Math.floor(args.refCount));
  if (refCount <= 0) return null;

  const modelKey = args.modelKey.trim();
  if (!modelKey) return null;

  const caps = getSbv1VideoModelRefCaps(modelKey, {
    providerId: args.providerId,
    multiShots: args.multiShots,
  });

  if (isDashscopeSbv1TextToVideoModel(modelKey)) {
    const r2vKey = DASHSCOPE_T2V_TO_R2V[modelKey];
    const r2vHint = r2vKey ? `「${r2vKey}」` : "参考生视频（R2V）模型";
    return {
      title: "请切换为参考生视频模型",
      message: `您当前选择的是文生视频模型「${modelKey}」，但已添加 ${refCount} 张参考图。文生视频不支持参考图，请先在 Dock 模型列表中选择 ${r2vHint}，或移除参考图后再生成。`,
    };
  }

  const h3Mode = minimaxH3VideoMode(modelKey);
  if (h3Mode === "t2v" || h3Mode === "context_ir") {
    return {
      title: "请切换为图生/参考生视频模型",
      message: `MiniMax H3 文生视频不支持参考图。请改用「图生视频 / 参考生视频」模型，或移除参考图。`,
    };
  }

  if (
    caps.refApi === "single_i2v" &&
    refCount > caps.maxRefsOmni
  ) {
    return {
      title: "参考图超出模型上限",
      message: `当前模型「${modelKey}」最多支持 ${caps.maxRefsOmni} 张参考图，您已添加 ${refCount} 张。请减少参考图，或改用支持多图 / 参考生视频的模型。`,
    };
  }

  if (
    caps.refApi === "wan_first_last_url" &&
    refCount > caps.maxRefsOmni
  ) {
    return {
      title: "参考图超出模型上限",
      message: `当前模型「${modelKey}」在全能参考模式下最多 ${caps.maxRefsOmni} 张图；首尾帧模式最多 2 张。您已添加 ${refCount} 张，请调整参考图或更换模型。`,
    };
  }

  if (caps.refApi === "kling_image_urls" && refCount > caps.maxRefsOmni) {
    return {
      title: "参考图超出模型上限",
      message: `当前模型「${modelKey}」最多支持 ${caps.maxRefsOmni} 张参考图，您已添加 ${refCount} 张。请减少参考图或更换支持更多参考图的模型。`,
    };
  }

  return null;
}

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
  /** 多镜头开启时不可首尾帧（可灵 3.0 图/文生视频） */
  multiShotsBlocksFirstLast?: boolean;
};

const MOTION_KEYS = new Set([
  "kling-2.6/motion-control",
  "kling-3.0/motion-control",
]);

/** API 仅 1 张 image_urls / 无首尾帧槽 */
const SINGLE_I2V_KEYS = new Set([
  "happyhorse/image-to-video",
  "kling-2.6/image-to-video",
  "kling/v3-turbo-text-to-video",
  "grok-imagine/image-to-video",
  "grok-imagine-video-1-5-preview",
]);

const KIE_MULTI_REF_KEYS = new Set(["bytedance/seedance-2"]);

const DASHSCOPE_WAN30_VIDEO_MODEL_KEYS = new Set([
  "wan3.0-video",
  "wan3.0-video-prime",
]);

export function isSbv1Wan30VideoModel(modelKey: string): boolean {
  return DASHSCOPE_WAN30_VIDEO_MODEL_KEYS.has(modelKey.trim());
}

const DASHSCOPE_T2V_KEYS = new Set([
  "wan2.6-t2v",
  "wan2.7-t2v",
  "wan2.7-t2v-2026-04-25",
  "wan3.0-video",
  "wan3.0-video-prime",
  "happyhorse-1.0-t2v",
  "happyhorse-1.1-t2v",
]);

const DASHSCOPE_I2V_KEYS = new Set([
  "happyhorse-1.0-i2v",
  "happyhorse-1.1-i2v",
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

function isVolcengineSbv1Model(modelKey: string, providerId?: string): boolean {
  if (providerId === GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID) return true;
  return (SBV1_VOLCENGINE_GATEWAY_MODEL_KEYS as readonly string[]).includes(
    modelKey.trim(),
  );
}

/** 仅火山 Seedance 生视频须走人像库 asset://；其它模型一律用 OSS HTTPS */
export function sbv1VideoModelUsesPortraitLibrary(
  modelKey?: string,
  providerId?: string,
): boolean {
  return isVolcengineSbv1Model(modelKey?.trim() ?? "", providerId);
}

export function getSbv1VideoModelRefCaps(
  modelKey: string,
  opts?: { multiShots?: boolean; providerId?: string },
): Sbv1VideoModelRefCaps {
  const k = modelKey.trim();

  const h3Mode = minimaxH3VideoMode(k);
  if (h3Mode === "t2v" || h3Mode === "context_ir") {
    return {
      supportedModes: ["omni"],
      refApi: "bailian_r2v_media",
      maxRefsOmni: 0,
    };
  }
  if (h3Mode === "i2v") {
    return {
      supportedModes: ["omni"],
      refApi: "single_i2v",
      maxRefsOmni: 1,
    };
  }
  if (h3Mode === "fl2v") {
    return {
      supportedModes: ["first_last"],
      refApi: "wan_first_last_url",
      maxRefsOmni: 2,
    };
  }
  if (h3Mode === "r2v" || h3Mode === "s2v") {
    return {
      supportedModes: ["omni"],
      refApi: "bailian_r2v_media",
      maxRefsOmni: 9,
    };
  }
  if (h3Mode === "regeneration") {
    return {
      supportedModes: ["omni"],
      refApi: "single_i2v",
      maxRefsOmni: 0,
    };
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

  if (isVolcengineSbv1Model(k, opts?.providerId)) {
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

  if (DASHSCOPE_WAN30_VIDEO_MODEL_KEYS.has(k)) {
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

  if (DASHSCOPE_I2V_KEYS.has(k)) {
    return {
      supportedModes: ["omni"],
      refApi: "single_i2v",
      maxRefsOmni: 1,
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

export type { Sbv1DockInputMode } from "./sbv1-workspace-types";

export type Sbv1DockModeChip = {
  id: Sbv1DockInputMode;
  label: string;
  /** 映射到节点 referenceMode */
  referenceMode: Sbv1ReferenceMode;
};

const DOCK_CHIP_DEFS: Record<
  Sbv1DockInputMode,
  { defaultLabel: string; referenceMode: Sbv1ReferenceMode }
> = {
  t2v: { defaultLabel: "文生视频", referenceMode: "omni" },
  i2v: { defaultLabel: "图生视频", referenceMode: "omni" },
  first_last: { defaultLabel: "首尾帧", referenceMode: "first_last" },
  omni: { defaultLabel: "全能参考", referenceMode: "omni" },
  multi_ref: { defaultLabel: "多图", referenceMode: "omni" },
};

function chip(
  id: Sbv1DockInputMode,
  label?: string,
): Sbv1DockModeChip {
  const def = DOCK_CHIP_DEFS[id];
  return { id, label: label ?? def.defaultLabel, referenceMode: def.referenceMode };
}

/** 按模型返回 Dock 顶栏可点亮的模式 chip（不可用的不展示） */
export function getSbv1VideoDockModeChips(
  modelKey: string,
  opts?: { multiShots?: boolean; providerId?: string },
): Sbv1DockModeChip[] {
  const k = modelKey.trim();
  const caps = getSbv1VideoModelRefCaps(k, opts);

  if (caps.refApi === "motion_control") {
    return [];
  }

  const r2v =
    k === "happyhorse-1.0-r2v" ||
    k === "happyhorse-1.1-r2v" ||
    k === "wan2.7-r2v" ||
    k === "wan2.6-r2v" ||
    k === "wan2.6-r2v-flash";

  if (r2v) {
    const out: Sbv1DockModeChip[] = [chip("omni", "参考生视频")];
    if (caps.supportedModes.includes("first_last")) {
      out.push(chip("first_last"));
    }
    return out;
  }

  if (SINGLE_I2V_KEYS.has(k)) {
    return [chip("i2v")];
  }

  if (isVolcengineSbv1Model(k, opts?.providerId)) {
    return [
      chip("i2v"),
      chip("t2v"),
      chip("first_last"),
      chip("omni"),
      chip("multi_ref", "智能多帧"),
    ];
  }

  if (DASHSCOPE_WAN30_VIDEO_MODEL_KEYS.has(k)) {
    return [
      chip("t2v"),
      chip("i2v"),
      chip("first_last"),
      chip("omni"),
    ];
  }

  if (DASHSCOPE_T2V_KEYS.has(k)) {
    return [chip("t2v")];
  }

  if (DASHSCOPE_I2V_KEYS.has(k)) {
    return [chip("i2v")];
  }

  if (k === "kling-3.0/video") {
    const multi = opts?.multiShots === true;
    const out: Sbv1DockModeChip[] = [chip("t2v"), chip("i2v")];
    if (!multi && caps.supportedModes.includes("first_last")) {
      out.push(chip("first_last"));
    }
    out.push(chip("omni"));
    if (multi) out.push(chip("multi_ref", "多镜头"));
    return out;
  }

  if (k === "kling/v3-turbo-image-to-video") {
    return [chip("i2v"), chip("first_last"), chip("omni")];
  }

  if (k === "wan/2-7-image-to-video") {
    return [chip("i2v"), chip("first_last"), chip("omni")];
  }

  if (KIE_MULTI_REF_KEYS.has(k)) {
    return [chip("i2v"), chip("omni", "多图参考")];
  }

  const h3Mode = minimaxH3VideoMode(k);
  if (h3Mode === "t2v" || h3Mode === "context_ir") {
    return [chip("t2v")];
  }
  if (h3Mode === "i2v") return [chip("i2v")];
  if (h3Mode === "fl2v") return [chip("first_last")];
  if (h3Mode === "r2v" || h3Mode === "s2v") {
    return [chip("omni", "参考生视频")];
  }

  if (caps.supportedModes.includes("first_last")) {
    return [chip("i2v"), chip("first_last"), chip("omni")];
  }

  return [chip("i2v"), chip("omni")];
}

export function resolveSbv1DockInputMode(
  referenceMode: Sbv1ReferenceMode,
  dockInputMode: Sbv1DockInputMode | undefined,
  chips: Sbv1DockModeChip[],
): Sbv1DockInputMode {
  if (dockInputMode && chips.some((c) => c.id === dockInputMode)) {
    return dockInputMode;
  }
  if (referenceMode === "first_last") return "first_last";
  if (referenceMode === "smart_multi") {
    const multi = chips.find((c) => c.id === "multi_ref");
    return multi?.id ?? "omni";
  }
  return chips[0]?.id ?? "omni";
}

/** 切换模型时的默认 Dock 输入模式（与 chip 列表顺序一致） */
export function defaultSbv1DockInputModeForModel(
  modelKey: string,
  opts?: { multiShots?: boolean; providerId?: string },
): Sbv1DockInputMode {
  const chips = getSbv1VideoDockModeChips(modelKey, opts);
  return chips[0]?.id ?? "omni";
}

export function isDashscopeSbv1TextToVideoModel(modelKey: string): boolean {
  return DASHSCOPE_T2V_KEYS.has(modelKey.trim());
}

/** Dock 模型列表 · 已连参考图时禁用百炼 T2V（须用 R2V） */
export function resolveSbv1VideoModelRefLinkBlock(args: {
  modelKey: string;
  refLinkCount: number;
}): { blocked: boolean; reason?: string } {
  const refLinkCount = Math.max(0, Math.floor(args.refLinkCount));
  if (refLinkCount <= 0) return { blocked: false };
  const modelKey = args.modelKey.trim();
  if (!isDashscopeSbv1TextToVideoModel(modelKey)) {
    const h3Mode = minimaxH3VideoMode(modelKey);
    if (h3Mode === "t2v" || h3Mode === "context_ir") {
      return {
        blocked: true,
        reason: `已连接 ${refLinkCount} 张参考图，文生视频不可用；请选 MiniMax H3 图生/参考生视频或断开参考图`,
      };
    }
    return { blocked: false };
  }
  if (DASHSCOPE_WAN30_VIDEO_MODEL_KEYS.has(modelKey)) return { blocked: false };
  const r2vKey = DASHSCOPE_T2V_TO_R2V[modelKey];
  return {
    blocked: true,
    reason: r2vKey
      ? `已连接 ${refLinkCount} 张参考图，文生视频不可用；请选 ${r2vKey} 或断开参考图`
      : `已连接 ${refLinkCount} 张参考图，文生视频模型不可用`,
  };
}

export function dockInputModeToPatch(mode: Sbv1DockInputMode): {
  referenceMode: Sbv1ReferenceMode;
  dockInputMode: Sbv1DockInputMode;
} {
  const ref = DOCK_CHIP_DEFS[mode].referenceMode;
  return {
    dockInputMode: mode,
    referenceMode: mode === "multi_ref" ? "smart_multi" : ref,
  };
}

/** Dock 缩略图右上角角色标识（按模型 + 模式） */
export function sbv1DockRefCornerLabelForModel(
  modelKey: string,
  referenceMode: Sbv1ReferenceMode,
  dockInputMode: Sbv1DockInputMode | undefined,
  index: number,
  total: number,
  opts?: { multiShots?: boolean; providerId?: string },
): string | undefined {
  const k = modelKey.trim();
  const mode =
    dockInputMode ??
    resolveSbv1DockInputMode(
      referenceMode,
      undefined,
      getSbv1VideoDockModeChips(k, opts),
    );

  if (mode === "first_last" || referenceMode === "first_last") {
    if (index === 0) return "首帧";
    if (index === 1) return "尾帧";
    return undefined;
  }

  if (referenceMode === "smart_multi" || mode === "multi_ref") {
    return `第${index + 1}帧`;
  }

  const r2v =
    k === "happyhorse-1.0-r2v" ||
    k === "happyhorse-1.1-r2v" ||
    k === "wan2.7-r2v" ||
    k === "wan2.6-r2v" ||
    k === "wan2.6-r2v-flash";

  if (r2v && (mode === "omni" || referenceMode === "omni")) {
    return String(index + 1);
  }

  if (mode === "i2v" && index === 0 && total <= 1) {
    return "首帧";
  }

  if (mode === "i2v" && index === 0) {
    return "首帧";
  }

  if (referenceMode === "omni" && total > 1) {
    return String(index + 1);
  }

  return sbv1DockRefCornerLabel(referenceMode, index);
}

/** @deprecated 使用 sbv1DockRefCornerLabelForModel */
export function sbv1DockRefCornerLabel(
  referenceMode: Sbv1ReferenceMode,
  index: number,
): string | undefined {
  if (referenceMode === "first_last") {
    if (index === 0) return "首帧";
    if (index === 1) return "尾帧";
    return undefined;
  }
  if (referenceMode === "smart_multi") {
    return `第${index + 1}帧`;
  }
  return undefined;
}

export function clampSbv1ReferenceMode(
  mode: Sbv1ReferenceMode,
  caps: Sbv1VideoModelRefCaps,
): Sbv1ReferenceMode {
  if (caps.supportedModes.includes(mode)) return mode;
  if (caps.supportedModes.includes("omni")) return "omni";
  return caps.supportedModes[0] ?? "omni";
}
