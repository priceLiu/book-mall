/**
 * 分镜视频 · 同产品线多 route modelKey 折叠为一条选模项，分类由 Dock chip 决定。
 */
import type {
  CanvasProviderDto,
  CanvasProviderModelDto,
} from "@/lib/canvas-providers-api";
import type { LibtvDockEngineModelEntry } from "./libtv-dock-engine-models";
import { STORY_PRO_VIDEO_MINIMAX_MODEL_KEYS } from "./story-prompts";
import type {
  Sbv1DockInputMode,
  Sbv1ReferenceMode,
  Sbv1VideoEngineNodeData,
} from "./sbv1-workspace-types";
import {
  resolveSbv1VariantIdFromEngine,
} from "./sbv1-video-models";

export type Sbv1VideoModelFamily = {
  id: string;
  displayName: string;
  memberKeys: readonly string[];
  /** 选模列表代表 key（须为 Gateway 已登记的真实 modelKey） */
  defaultRouteKey: string;
  /** Dock 可切换的分类（不含 multi_ref 时由具体模型另行追加） */
  dockInputModes: readonly Sbv1DockInputMode[];
};

const HAPPYHORSE_10: Sbv1VideoModelFamily = {
  id: "happyhorse-1.0",
  displayName: "HappyHorse 1.0",
  memberKeys: [
    "happyhorse-1.0-t2v",
    "happyhorse-1.0-i2v",
    "happyhorse-1.0-r2v",
  ],
  defaultRouteKey: "happyhorse-1.0-t2v",
  dockInputModes: ["t2v", "i2v", "omni"],
};

const HAPPYHORSE_11: Sbv1VideoModelFamily = {
  id: "happyhorse-1.1",
  displayName: "HappyHorse 1.1",
  memberKeys: [
    "happyhorse-1.1-t2v",
    "happyhorse-1.1-i2v",
    "happyhorse-1.1-r2v",
  ],
  defaultRouteKey: "happyhorse-1.1-t2v",
  dockInputModes: ["t2v", "i2v", "omni"],
};

const WAN_26: Sbv1VideoModelFamily = {
  id: "wan2.6",
  displayName: "通义万相 2.6",
  memberKeys: ["wan2.6-t2v", "wan2.6-r2v", "wan2.6-r2v-flash"],
  defaultRouteKey: "wan2.6-t2v",
  dockInputModes: ["t2v", "omni"],
};

const WAN_27: Sbv1VideoModelFamily = {
  id: "wan2.7",
  displayName: "通义万相 2.7",
  memberKeys: ["wan2.7-t2v", "wan2.7-t2v-2026-04-25", "wan2.7-r2v"],
  defaultRouteKey: "wan2.7-t2v",
  dockInputModes: ["t2v", "omni"],
};

const MINIMAX_H3: Sbv1VideoModelFamily = {
  id: "minimax-h3",
  displayName: "MiniMax H3",
  memberKeys: STORY_PRO_VIDEO_MINIMAX_MODEL_KEYS,
  defaultRouteKey: "MiniMax/MiniMax-H3-t2v",
  dockInputModes: ["t2v", "i2v", "first_last", "omni"],
};

export const SBV1_VIDEO_MODEL_FAMILIES: readonly Sbv1VideoModelFamily[] = [
  MINIMAX_H3,
  HAPPYHORSE_10,
  HAPPYHORSE_11,
  WAN_26,
  WAN_27,
];

const MEMBER_TO_FAMILY = new Map<string, Sbv1VideoModelFamily>();
for (const family of SBV1_VIDEO_MODEL_FAMILIES) {
  for (const key of family.memberKeys) {
    MEMBER_TO_FAMILY.set(key.toLowerCase(), family);
  }
}

export function resolveSbv1VideoModelFamily(
  modelKey: string,
): Sbv1VideoModelFamily | null {
  const k = modelKey.trim().toLowerCase();
  if (!k) return null;
  return MEMBER_TO_FAMILY.get(k) ?? null;
}

export function sbv1VideoModelFamilyMatches(
  a: string,
  b: string,
): boolean {
  const fa = resolveSbv1VideoModelFamily(a);
  const fb = resolveSbv1VideoModelFamily(b);
  if (fa && fb) return fa.id === fb.id;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function resolveSbv1VideoFamilyDisplayName(modelKey: string): string | null {
  return resolveSbv1VideoModelFamily(modelKey)?.displayName ?? null;
}

function omniRouteForFamily(
  currentKey: string,
  family: Sbv1VideoModelFamily,
): string {
  const k = currentKey.trim().toLowerCase();
  if (family.id === "minimax-h3") {
    if (k.endsWith("-s2v")) return "MiniMax/MiniMax-H3-s2v";
    if (k.endsWith("-r2v")) return "MiniMax/MiniMax-H3-r2v";
    return "MiniMax/MiniMax-H3-r2v";
  }
  if (family.id === "happyhorse-1.0") return "happyhorse-1.0-r2v";
  if (family.id === "happyhorse-1.1") return "happyhorse-1.1-r2v";
  if (family.id === "wan2.6") {
    if (k.includes("r2v-flash")) return "wan2.6-r2v-flash";
    return "wan2.6-r2v";
  }
  if (family.id === "wan2.7") return "wan2.7-r2v";
  return currentKey;
}

/** 按 Dock 分类解析家族内实际上游 modelKey */
export function resolveSbv1VideoFamilyRouteModelKey(
  modelKey: string,
  dockInputMode: Sbv1DockInputMode,
): string {
  const family = resolveSbv1VideoModelFamily(modelKey);
  if (!family) return modelKey.trim();

  const k = modelKey.trim();

  if (family.id === "minimax-h3") {
    switch (dockInputMode) {
      case "t2v":
        if (k.toLowerCase().endsWith("-context-ir")) {
          return "MiniMax/MiniMax-H3-context-ir";
        }
        return "MiniMax/MiniMax-H3-t2v";
      case "i2v":
        return "MiniMax/MiniMax-H3-i2v";
      case "first_last":
        return "MiniMax/MiniMax-H3-fl2v";
      case "omni":
      case "multi_ref":
        return omniRouteForFamily(k, family);
      default:
        return family.defaultRouteKey;
    }
  }

  if (family.id === "happyhorse-1.0" || family.id === "happyhorse-1.1") {
    const prefix = family.id === "happyhorse-1.0" ? "happyhorse-1.0" : "happyhorse-1.1";
    switch (dockInputMode) {
      case "t2v":
        return `${prefix}-t2v`;
      case "i2v":
        return `${prefix}-i2v`;
      case "omni":
      case "multi_ref":
      case "first_last":
        return `${prefix}-r2v`;
      default:
        return family.defaultRouteKey;
    }
  }

  if (family.id === "wan2.6" || family.id === "wan2.7") {
    switch (dockInputMode) {
      case "t2v":
        return family.defaultRouteKey;
      case "omni":
      case "multi_ref":
      case "first_last":
      case "i2v":
        return omniRouteForFamily(k, family);
      default:
        return family.defaultRouteKey;
    }
  }

  return k;
}

/** Dock 分类变化时同步 engine.modelKey（家族内切 route） */
export function buildSbv1VideoFamilyRouteSyncPatch(
  data: Pick<
    Sbv1VideoEngineNodeData,
    "engine" | "dockInputMode" | "referenceMode"
  >,
): Partial<Sbv1VideoEngineNodeData> | null {
  const modelKey = data.engine?.modelKey?.trim() ?? "";
  const providerId = data.engine?.providerId?.trim() ?? "";
  if (!modelKey || !resolveSbv1VideoModelFamily(modelKey)) return null;

  const familyDef = resolveSbv1VideoModelFamily(modelKey)!;
  const dockMode =
    data.dockInputMode &&
    familyDef.dockInputModes.includes(data.dockInputMode)
      ? data.dockInputMode
      : familyDef.dockInputModes[0];
  const nextKey = resolveSbv1VideoFamilyRouteModelKey(modelKey, dockMode);
  if (nextKey === modelKey) return null;

  const engineParams = data.engine?.params ?? {};
  const engine = { providerId, modelKey: nextKey, params: engineParams };
  const variantId = resolveSbv1VariantIdFromEngine(engine);

  return {
    engine,
    volcengineVariantId: variantId,
    jimengModelId: variantId,
  };
}

function cloneModelWithFamilyDisplay(
  model: CanvasProviderModelDto,
  family: Sbv1VideoModelFamily,
  routeKey: string,
): CanvasProviderModelDto {
  return {
    ...model,
    modelKey: routeKey,
    displayName: family.displayName,
  };
}

function collapseVideoModelList<T extends { providerId: string; model: CanvasProviderModelDto }>(
  entries: T[],
): T[] {
  const seenFamily = new Set<string>();
  const out: T[] = [];

  for (const entry of entries) {
    const family = resolveSbv1VideoModelFamily(entry.model.modelKey);
    if (!family) {
      out.push(entry);
      continue;
    }
    const famSlot = `${entry.providerId}:${family.id}`;
    if (seenFamily.has(famSlot)) continue;
    seenFamily.add(famSlot);

    const routeKey = family.defaultRouteKey;
    const rep =
      entries.find(
        (e) =>
          e.providerId === entry.providerId &&
          e.model.modelKey.toLowerCase() === routeKey.toLowerCase(),
      ) ?? entry;

    out.push({
      ...rep,
      model: cloneModelWithFamilyDisplay(rep.model, family, routeKey),
    } as T);
  }
  return out;
}

export function collapseSbv1DockVideoModelEntries(
  entries: { providerId: string; model: CanvasProviderModelDto }[],
) {
  return collapseVideoModelList(entries);
}

export function collapseLibtvDockVideoModelEntries(
  entries: LibtvDockEngineModelEntry[],
): LibtvDockEngineModelEntry[] {
  return collapseVideoModelList(entries);
}

export function collapseEnginePickerVideoGroups<
  T extends { provider: CanvasProviderDto; models: CanvasProviderModelDto[] },
>(groups: T[]): T[] {
  return groups.map((g) => ({
    ...g,
    models: collapseVideoModelList(
      g.models.map((model) => ({
        providerId: g.provider.id,
        model,
      })),
    ).map((e) => e.model),
  }));
}

/** 家族内当前 route 对应的 Dock 分类（用于默认 chip，而非列表首项） */
export function inferSbv1VideoFamilyDockInputMode(
  modelKey: string,
): Sbv1DockInputMode | null {
  const family = resolveSbv1VideoModelFamily(modelKey);
  if (!family) return null;
  const k = modelKey.trim().toLowerCase();

  if (family.id === "minimax-h3") {
    if (k.endsWith("-context-ir") || k.endsWith("-t2v")) return "t2v";
    if (k.endsWith("-i2v")) return "i2v";
    if (k.endsWith("-fl2v")) return "first_last";
    if (k.endsWith("-s2v") || k.endsWith("-r2v")) return "omni";
    if (k.endsWith("-regeneration")) return "i2v";
    return "t2v";
  }

  if (family.id === "happyhorse-1.0" || family.id === "happyhorse-1.1") {
    if (k.endsWith("-t2v")) return "t2v";
    if (k.endsWith("-i2v")) return "i2v";
    if (k.endsWith("-r2v")) return "omni";
    return "t2v";
  }

  if (family.id === "wan2.6" || family.id === "wan2.7") {
    if (k.includes("-r2v")) return "omni";
    return "t2v";
  }

  return null;
}

/** 选家族代表项时带上与当前 Dock 分类一致的默认 route */
export function resolveSbv1VideoFamilyPickRouteKey(
  pickedRouteKey: string,
  dockInputMode?: Sbv1DockInputMode,
  referenceMode?: Sbv1ReferenceMode,
): string {
  const family = resolveSbv1VideoModelFamily(pickedRouteKey);
  if (!family) return pickedRouteKey;
  if (!dockInputMode || !family.dockInputModes.includes(dockInputMode)) {
    return family.defaultRouteKey;
  }
  return resolveSbv1VideoFamilyRouteModelKey(family.defaultRouteKey, dockInputMode);
}