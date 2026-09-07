import { describe, expect, it } from "vitest";

import {
  buildCanvasHomeSnapshotFallback,
} from "@/lib/static-snapshots/build-canvas-home-snapshot";
import {
  isCanvasHomeSnapshotPayload,
  mergeCanvasHomeSnapshotPayload,
  summarizeCanvasHomePayload,
  isCanvasHomeDiscoveryEmpty,
  isCanvasHomeFilmShowcaseEmpty,
  canvasHomeNeedsCompletePayload,
} from "@/lib/static-snapshots/canvas-home-payload";
import { isStaticSnapshotPageKey } from "@/lib/static-snapshots/static-snapshot-run";

describe("mergeCanvasHomeSnapshotPayload", () => {
  it("fills discovery from live while keeping existing film showcase", () => {
    const seed = {
      ...buildCanvasHomeSnapshotFallback(),
      filmShowcase: [{ id: "film-1" } as never],
    };
    const live = {
      ...buildCanvasHomeSnapshotFallback(),
      featured: [{ id: "feat-1" } as never],
      templates: [{ id: "tpl-1" } as never],
    };
    const merged = mergeCanvasHomeSnapshotPayload(seed, live);
    expect(isCanvasHomeDiscoveryEmpty(merged)).toBe(false);
    expect(merged.filmShowcase).toHaveLength(1);
    expect(merged.featured).toHaveLength(1);
  });

  it("fills film from live while keeping existing discovery", () => {
    const seed = {
      ...buildCanvasHomeSnapshotFallback(),
      featured: [{ id: "feat-1" } as never],
    };
    const live = {
      ...buildCanvasHomeSnapshotFallback(),
      filmShowcase: [{ id: "film-1" } as never],
    };
    const merged = mergeCanvasHomeSnapshotPayload(seed, live);
    expect(isCanvasHomeFilmShowcaseEmpty(merged)).toBe(false);
    expect(merged.featured).toHaveLength(1);
  });
});

describe("canvasHomeNeedsCompletePayload", () => {
  it("detects partial snapshots", () => {
    const filmOnly = {
      ...buildCanvasHomeSnapshotFallback(),
      filmShowcase: [{ id: "f1" } as never],
    };
    expect(canvasHomeNeedsCompletePayload(filmOnly)).toBe(true);
    const full = mergeCanvasHomeSnapshotPayload(filmOnly, {
      ...buildCanvasHomeSnapshotFallback(),
      featured: [{ id: "a" } as never],
      filmShowcase: [{ id: "f1" } as never],
    });
    expect(canvasHomeNeedsCompletePayload(full)).toBe(false);
  });
});

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
