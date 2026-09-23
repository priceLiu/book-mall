import { ecomRatioToImageSize, getEcomPlatformSpec, type EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";

import type { DetailPageSuiteExportTarget, DetailPageSuiteSettings } from "./types";

export const DETAIL_PAGE_EXPORT_TARGET_PRESETS: Omit<
  DetailPageSuiteExportTarget,
  "id"
>[] = [
  { platformCode: "taobao-tmall", label: "淘宝/天猫", ratio: "3:4", widthPx: 750 },
  { platformCode: "jd", label: "京东", ratio: "3:4", widthPx: 790 },
  { platformCode: "pdd", label: "拼多多", ratio: "3:4", widthPx: 750 },
  { platformCode: "amazon", label: "亚马逊", ratio: "16:9", widthPx: 1464 },
];

export function createExportTargetId(platformCode: string): string {
  return platformCode === "custom" ? `custom-${Date.now()}` : platformCode;
}

export function defaultExportTargetsForPlatform(
  platformCode?: string | null,
): DetailPageSuiteExportTarget[] {
  const code = platformCode?.trim() || "taobao-tmall";
  const preset = DETAIL_PAGE_EXPORT_TARGET_PRESETS.find((p) => p.platformCode === code);
  const base = preset ?? DETAIL_PAGE_EXPORT_TARGET_PRESETS[0]!;
  return [
    {
      id: base.platformCode,
      ...base,
    },
  ];
}

export function ensureDetailPageExportTargets(
  settings: DetailPageSuiteSettings,
  briefPlatformCode?: string | null,
): DetailPageSuiteExportTarget[] {
  const list = settings.exportTargets?.filter((t) => t.id && t.label) ?? [];
  if (list.length > 0) return list;
  return defaultExportTargetsForPlatform(briefPlatformCode);
}

export function resolveActiveExportTargetIds(
  settings: DetailPageSuiteSettings,
  briefPlatformCode?: string | null,
): string[] {
  const targets = ensureDetailPageExportTargets(settings, briefPlatformCode);
  const active = settings.activeExportTargetIds?.filter(Boolean) ?? [];
  const valid = active.filter((id) => targets.some((t) => t.id === id));
  if (valid.length > 0) return valid;
  return [targets[0]!.id];
}

export function resolveActiveExportTargets(
  settings: DetailPageSuiteSettings,
  briefPlatformCode?: string | null,
): DetailPageSuiteExportTarget[] {
  const targets = ensureDetailPageExportTargets(settings, briefPlatformCode);
  const ids = new Set(resolveActiveExportTargetIds(settings, briefPlatformCode));
  return targets.filter((t) => ids.has(t.id));
}

export function imageSizeForExportTarget(target: DetailPageSuiteExportTarget): string {
  if (target.customHeightPx && target.widthPx) {
    const h = Math.max(1, Math.round(target.customHeightPx));
    const w = Math.max(1, Math.round(target.widthPx));
    return `${w}*${h}`;
  }
  const spec = getEcomPlatformSpec(target.platformCode);
  const ratio = (target.ratio || spec.detailPage.ratio || "3:4") as EcomImageRatio;
  return ecomRatioToImageSize(ratio);
}

export function ratioForExportTarget(target: DetailPageSuiteExportTarget): EcomImageRatio {
  if (
    target.ratio === "1:1" ||
    target.ratio === "3:4" ||
    target.ratio === "4:5" ||
    target.ratio === "16:9"
  ) {
    return target.ratio;
  }
  return getEcomPlatformSpec(target.platformCode).detailPage.ratio;
}
