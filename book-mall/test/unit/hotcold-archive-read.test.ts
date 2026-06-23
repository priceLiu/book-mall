import { describe, expect, it } from "vitest";

import { needsArchive } from "@/lib/maintenance/hotcold-archive-read";

const NOW = new Date("2026-06-23T00:00:00.000Z");
const DAY = 86_400_000;

describe("needsArchive 报表读路由判定", () => {
  it("无下界 → 需要并读归档", () => {
    expect(needsArchive(null, 90, NOW)).toBe(true);
    expect(needsArchive(undefined, 90, NOW)).toBe(true);
  });

  it("范围完全在保留期内 → 只读主表", () => {
    const from = new Date(NOW.getTime() - 30 * DAY);
    expect(needsArchive(from, 90, NOW)).toBe(false);
  });

  it("范围跨越保留边界 → 并读归档", () => {
    const from = new Date(NOW.getTime() - 120 * DAY);
    expect(needsArchive(from, 90, NOW)).toBe(true);
  });

  it("恰好等于保留边界 → 不需归档（边界含在主表）", () => {
    const from = new Date(NOW.getTime() - 90 * DAY);
    expect(needsArchive(from, 90, NOW)).toBe(false);
  });
});
