import { describe, expect, it } from "vitest";

import {
  nudgeShortcutPresetGroupClearOfPeers,
  reflowOverlappingCanvasGroups,
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

  it("detects preset groups by label when pro2ShortcutPreset flag is missing", () => {
    const fp = shortcutPresetGroupFootprint(400, 300);
    const existing: CanvasFlowNode = {
      id: "g2",
      type: "group",
      position: { x: 0, y: 0 },
      width: fp.w,
      height: fp.h,
      data: { label: "预设 - 文生视频" },
    };
    const base = { x: 100, y: 150 };
    const next = resolveShortcutPresetSpawnCenter([existing], base, fp.w, fp.h, 64);
    expect(next.x - fp.w / 2).toBeGreaterThanOrEqual(fp.w + 64 - 1);
  });
});

describe("reflowOverlappingCanvasGroups", () => {
  it("pushes a group clear of a peer whose child overflows the group box", () => {
    const g1: CanvasFlowNode = {
      id: "g1",
      type: "group",
      position: { x: 0, y: 0 },
      width: 400,
      height: 300,
      data: { pro2ShortcutPreset: true, pro2Styled: true },
    };
    const video: CanvasFlowNode = {
      id: "v1",
      type: "sbv1-video-engine",
      parentId: "g1",
      position: { x: 40, y: 40 },
      width: 900,
      height: 500,
      data: {},
    };
    const g2: CanvasFlowNode = {
      id: "g2",
      type: "group",
      position: { x: 480, y: 0 },
      width: 400,
      height: 300,
      data: { pro2ShortcutPreset: true, pro2Styled: true },
    };
    const text: CanvasFlowNode = {
      id: "t2",
      type: "story-pro2-starter",
      parentId: "g2",
      position: { x: 28, y: 40 },
      width: 440,
      height: 360,
      data: {},
    };
    const next = reflowOverlappingCanvasGroups([g1, video, g2, text], 64);
    const moved = next.find((n) => n.id === "g2")!;
    const grown = next.find((n) => n.id === "g1")!;
    expect(grown.width).toBeGreaterThanOrEqual(40 + 900 + 28);
    expect(moved.position.x).toBeGreaterThan(g2.position.x);
    const g1Right = (grown.position.x as number) + (grown.width as number);
    expect(moved.position.x).toBeGreaterThanOrEqual(g1Right + 64 - 1);
  });
});

describe("nudgeShortcutPresetGroupClearOfPeers", () => {
  it("moves overlapping group to the right", () => {
    const fp = shortcutPresetGroupFootprint(800, 400);
    const g1 = shortcutGroup("g1", 100, 200, fp.w, fp.h);
    const g2 = shortcutGroup("g2", 120, 200, fp.w, fp.h);
    const nudged = nudgeShortcutPresetGroupClearOfPeers([g1, g2], "g2", 64);
    const moved = nudged.find((n) => n.id === "g2")!;
    expect(moved.position.x).toBeGreaterThan(g2.position.x);
  });
});
