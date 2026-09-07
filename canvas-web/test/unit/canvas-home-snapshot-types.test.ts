import {
  canvasHomeNeedsClientHydrate,
  emptyCanvasHomeSnapshotPayload,
  isCanvasHomeDiscoveryEmpty,
  isCanvasHomeFilmShowcaseEmpty,
  isCanvasHomeSnapshotEmpty,
} from "@/lib/canvas-home-snapshot-types";
import { describe, expect, it } from "vitest";

describe("canvas home snapshot emptiness", () => {
  it("treats film-only snapshot as needing film hydrate only", () => {
    const payload = {
      ...emptyCanvasHomeSnapshotPayload(),
      filmShowcase: [{ id: "film-1" } as never],
    };
    expect(isCanvasHomeSnapshotEmpty(payload)).toBe(false);
    expect(isCanvasHomeDiscoveryEmpty(payload)).toBe(true);
    expect(isCanvasHomeFilmShowcaseEmpty(payload)).toBe(false);
    expect(canvasHomeNeedsClientHydrate(payload)).toBe(true);
  });

  it("treats discovery-only snapshot as needing film hydrate", () => {
    const payload = {
      ...emptyCanvasHomeSnapshotPayload(),
      featured: [{ id: "feat-1" } as never],
    };
    expect(isCanvasHomeDiscoveryEmpty(payload)).toBe(false);
    expect(isCanvasHomeFilmShowcaseEmpty(payload)).toBe(true);
    expect(canvasHomeNeedsClientHydrate(payload)).toBe(true);
  });

  it("treats fully empty snapshot as both empty", () => {
    const payload = emptyCanvasHomeSnapshotPayload();
    expect(isCanvasHomeSnapshotEmpty(payload)).toBe(true);
    expect(isCanvasHomeDiscoveryEmpty(payload)).toBe(true);
    expect(isCanvasHomeFilmShowcaseEmpty(payload)).toBe(true);
    expect(canvasHomeNeedsClientHydrate(payload)).toBe(true);
  });

  it("SSR-complete snapshot does not need client hydrate", () => {
    const payload = {
      ...emptyCanvasHomeSnapshotPayload(),
      featured: [{ id: "feat-1" } as never],
      filmShowcase: [{ id: "film-1" } as never],
    };
    expect(canvasHomeNeedsClientHydrate(payload)).toBe(false);
  });
});
