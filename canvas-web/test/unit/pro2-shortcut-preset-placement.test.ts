import { describe, expect, it } from "vitest";

import {
  resolveShortcutPresetSpawnCenter,
  shortcutPresetGroupFootprint,
} from "@/lib/canvas/pro2-shortcut-preset-placement";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function shortcutGroup(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): CanvasFlowNode {
  return {
    id,
    type: "group",
    position: { x, y },
    width: w,
    height: h,
    data: { pro2ShortcutPreset: true },
  };
}

describe("resolveShortcutPresetSpawnCenter", () => {
  it("shifts new preset to the right when viewport center overlaps an existing group", () => {
    const fp = shortcutPresetGroupFootprint(800, 400);
    const existing = shortcutGroup("g1", 100, 200, fp.w, fp.h);
    const base = { x: 200, y: 400 };
    const next = resolveShortcutPresetSpawnCenter([existing], base, fp.w, fp.h, 64);
    expect(next.x).toBeGreaterThan(base.x);
    const left = next.x - fp.w / 2;
    expect(left).toBeGreaterThanOrEqual(existing.position.x + fp.w + 64 - 1);
  });
});
