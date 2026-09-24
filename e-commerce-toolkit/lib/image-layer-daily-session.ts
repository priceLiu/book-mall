import {
  mergeSavedSessionImages,
  type ImageLayerSavedImage,
} from "@/lib/image-layer-types";

const SHANGHAI_TZ = "Asia/Shanghai";

export function shanghaiCalendarDate(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * 左图翻页：当天有保存只显示当天；当天没有则沿用最近一次有保存那天的最后一张。
 */
export function buildDailyLeftSessionImages(
  items: ImageLayerSavedImage[] | undefined,
  now: Date = new Date(),
): ImageLayerSavedImage[] {
  const unique = mergeSavedSessionImages(items);
  const todayKey = shanghaiCalendarDate(now);
  if (!todayKey) return unique.slice(-1);

  const dated = unique.map((row) => ({
    row,
    key: row.at ? shanghaiCalendarDate(row.at) : "",
  }));

  const today = dated
    .filter((item) => item.key === todayKey)
    .map((item) => item.row)
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  if (today.length > 0) return today;

  const past = dated
    .filter((item) => item.key && item.key < todayKey)
    .sort((a, b) => (b.row.at ?? "").localeCompare(a.row.at ?? ""));
  if (past[0]) return [past[0].row];

  return unique.slice(-1);
}
