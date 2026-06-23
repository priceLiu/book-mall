import { describe, expect, it } from "vitest";

import { needsArchiveByHotHours } from "@/lib/maintenance/hotcold-archive-read";

const NOW = new Date("2026-06-23T12:00:00.000Z");
const HOUR_MS = 3_600_000;

describe("needsArchiveByHotHours", () => {
  it("无下界 → 需要并读归档", () => {
    expect(needsArchiveByHotHours(null, 1, NOW)).toBe(true);
  });

  it("范围完全在 1h 热区内 → 只读主表", () => {
    const from = new Date(NOW.getTime() - 30 * 60_000);
    expect(needsArchiveByHotHours(from, 1, NOW)).toBe(false);
  });

  it("范围跨越 1h 边界 → 并读归档", () => {
    const from = new Date(NOW.getTime() - 2 * HOUR_MS);
    expect(needsArchiveByHotHours(from, 1, NOW)).toBe(true);
  });
});
