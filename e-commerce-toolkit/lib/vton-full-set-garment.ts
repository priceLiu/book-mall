import type { VtonFullSetInputMode, VtonGarmentItem } from "@/lib/vton-types";

export type VtonFullSetUploadSlot = "composite" | "top" | "bottom";

export function isFullSetGarmentReady(g: VtonGarmentItem): boolean {
  return Boolean(g.parsedTopUrl?.trim() && g.parsedBottomUrl?.trim());
}

/** 搭配编排 / 预览缩略图：套装优先展示分割后的上下装 */
export function garmentPreviewThumbUrls(g: VtonGarmentItem): string[] {
  if (g.kind === "full_set") {
    const top = g.parsedTopUrl?.trim();
    const bottom = g.parsedBottomUrl?.trim();
    if (top && bottom) return [top, bottom];
    if (top) return [top];
    if (bottom) return [bottom];
    const composite = g.ossUrl?.trim();
    return composite ? [composite] : [];
  }
  const url = g.ossUrl?.trim();
  return url ? [url] : [];
}

/** 推断套装入库方式（兼容旧数据） */
export function resolveFullSetInputMode(g: VtonGarmentItem): VtonFullSetInputMode {
  if (g.fullSetInputMode === "composite" || g.fullSetInputMode === "manual") {
    return g.fullSetInputMode;
  }
  const composite = g.ossUrl?.trim();
  const top = g.parsedTopUrl?.trim();
  const bottom = g.parsedBottomUrl?.trim();
  if (top && bottom && composite && composite !== top && composite !== bottom) {
    return "composite";
  }
  if (top && composite === top) return "manual";
  if (top && !bottom) return "manual";
  return "composite";
}

export function filterFullSetGarmentsByMode(
  pool: VtonGarmentItem[],
  mode: VtonFullSetInputMode,
): VtonGarmentItem[] {
  return pool.filter((g) => g.kind === "full_set" && resolveFullSetInputMode(g) === mode);
}

export function fullSetGarmentDisplayLabel(g: VtonGarmentItem, index: number): string {
  return g.label?.trim() || `套装 ${index + 1}`;
}

export type FullSetGarmentPatchBody = {
  add?: Array<Omit<VtonGarmentItem, "id"> & { id?: string }>;
  update?: Array<{ id: string; patch: Partial<VtonGarmentItem> }>;
};

/** 从资产库添加套装槽位（composite / top / bottom） */
export function buildFullSetAssetPatch(
  assets: Array<{ ossUrl: string; title: string }>,
  slot: VtonFullSetUploadSlot,
  garmentId?: string,
): FullSetGarmentPatchBody {
  if (slot === "composite") {
    return {
      add: assets.map((a) => ({
        kind: "full_set" as const,
        ossUrl: a.ossUrl,
        label: a.title,
        source: "asset",
        fullSetInputMode: "composite" as const,
      })),
    };
  }
  if (slot === "top") {
    if (garmentId) {
      const first = assets[0];
      if (!first) return {};
      return {
        update: [
          {
            id: garmentId,
            patch: { parsedTopUrl: first.ossUrl },
          },
        ],
      };
    }
    return {
      add: assets.map((a) => ({
        kind: "full_set" as const,
        ossUrl: a.ossUrl,
        parsedTopUrl: a.ossUrl,
        label: a.title,
        source: "asset",
        fullSetInputMode: "manual" as const,
      })),
    };
  }
  if (!garmentId) {
    return {
      add: assets.map((a) => ({
        kind: "full_set" as const,
        ossUrl: a.ossUrl,
        parsedBottomUrl: a.ossUrl,
        label: a.title,
        source: "asset",
        fullSetInputMode: "manual" as const,
      })),
    };
  }
  const first = assets[0];
  if (!first) return {};
  return {
    update: [
      {
        id: garmentId,
        patch: { parsedBottomUrl: first.ossUrl },
      },
    ],
  };
}
