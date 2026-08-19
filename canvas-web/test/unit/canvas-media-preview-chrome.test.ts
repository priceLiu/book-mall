import { describe, expect, it } from "vitest";

import {
  readElementShortSide,
  resolveCanvasMediaPreviewChrome,
} from "@/lib/canvas/canvas-media-preview-chrome";

describe("resolveCanvasMediaPreviewChrome", () => {
  it("uses canvas baseline at 200px short side", () => {
    const c = resolveCanvasMediaPreviewChrome(200);
    expect(c.btnSizePx).toBe(64);
    expect(c.iconSizePx).toBe(32);
  });

  it("does not shrink below scale floor on small nodes", () => {
    const c = resolveCanvasMediaPreviewChrome(80);
    expect(c.btnSizePx).toBe(54);
    expect(c.iconSizePx).toBe(27);
  });

  it("scales up for large nodes up to cap", () => {
    const c = resolveCanvasMediaPreviewChrome(360);
    expect(c.btnSizePx).toBe(99);
    expect(c.iconSizePx).toBe(50);
  });

  it("readElementShortSide falls back when no element", () => {
    expect(readElementShortSide(null)).toBe(200);
  });
});
