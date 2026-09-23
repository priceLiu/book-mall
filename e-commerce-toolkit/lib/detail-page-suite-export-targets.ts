import type {
  DetailPageSuiteExportTarget,
  DetailPageSuiteSettings,
} from "@/lib/detail-page-suite-types";

export const DETAIL_PAGE_EXPORT_PRESETS: Omit<DetailPageSuiteExportTarget, "id">[] = [
  { platformCode: "taobao-tmall", label: "淘宝/天猫", ratio: "3:4", widthPx: 750 },
  { platformCode: "jd", label: "京东", ratio: "3:4", widthPx: 790 },
  { platformCode: "pdd", label: "拼多多", ratio: "3:4", widthPx: 750 },
  { platformCode: "amazon", label: "亚马逊", ratio: "16:9", widthPx: 1464 },
];

export function ensureExportTargets(
  settings: DetailPageSuiteSettings,
  briefPlatformCode?: string | null,
): DetailPageSuiteExportTarget[] {
  const list = settings.exportTargets?.filter((t) => t.id && t.label) ?? [];
  if (list.length > 0) return list;
  const code = briefPlatformCode?.trim() || "taobao-tmall";
  const preset = DETAIL_PAGE_EXPORT_PRESETS.find((p) => p.platformCode === code);
  const base = preset ?? DETAIL_PAGE_EXPORT_PRESETS[0]!;
  return [{ id: base.platformCode, ...base }];
}

export function resolveActiveExportTargetIds(
  settings: DetailPageSuiteSettings,
  briefPlatformCode?: string | null,
): string[] {
  const targets = ensureExportTargets(settings, briefPlatformCode);
  const active = settings.activeExportTargetIds?.filter(Boolean) ?? [];
  const valid = active.filter((id) => targets.some((t) => t.id === id));
  if (valid.length > 0) return valid;
  return [targets[0]!.id];
}

export function mergePresetIntoTargets(
  current: DetailPageSuiteExportTarget[],
  platformCode: string,
): DetailPageSuiteExportTarget[] {
  if (current.some((t) => t.platformCode === platformCode && platformCode !== "custom")) {
    return current;
  }
  const preset = DETAIL_PAGE_EXPORT_PRESETS.find((p) => p.platformCode === platformCode);
  if (!preset) return current;
  return [...current, { id: preset.platformCode, ...preset }];
}

export function heightPxForTarget(t: DetailPageSuiteExportTarget): number {
  if (t.customHeightPx && t.customHeightPx > 0) return Math.round(t.customHeightPx);
  const r = t.ratio;
  if (r === "1:1") return t.widthPx;
  if (r === "16:9") return Math.round((t.widthPx * 9) / 16);
  if (r === "4:5") return Math.round((t.widthPx * 5) / 4);
  return Math.round((t.widthPx * 4) / 3);
}
