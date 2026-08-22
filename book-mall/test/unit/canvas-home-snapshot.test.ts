import { describe, expect, it } from "vitest";

import {
  buildCanvasHomeSnapshotFallback,
} from "@/lib/static-snapshots/build-canvas-home-snapshot";
import {
  isCanvasHomeSnapshotPayload,
  summarizeCanvasHomePayload,
} from "@/lib/static-snapshots/canvas-home-payload";
import { isStaticSnapshotPageKey } from "@/lib/static-snapshots/static-snapshot-run";

describe("isStaticSnapshotPageKey", () => {
  it("accepts site-home and canvas-home", () => {
    expect(isStaticSnapshotPageKey("site-home")).toBe(true);
    expect(isStaticSnapshotPageKey("canvas-home")).toBe(true);
    expect(isStaticSnapshotPageKey("unknown")).toBe(false);
  });
});

describe("buildCanvasHomeSnapshotFallback", () => {
  it("produces valid empty payload", () => {
    const payload = buildCanvasHomeSnapshotFallback();
    expect(isCanvasHomeSnapshotPayload(payload)).toBe(true);
    expect(summarizeCanvasHomePayload(payload)).toEqual({
      featuredCount: 0,
      templateCount: 0,
      caseCount: 0,
      filmShowcaseCount: 0,
    });
  });
});
