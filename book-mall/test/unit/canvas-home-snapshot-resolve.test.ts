import { describe, expect, it, vi, beforeEach } from "vitest";

import { buildCanvasHomeSnapshotFallback } from "@/lib/static-snapshots/build-canvas-home-snapshot";
import { resolveCanvasHomeSnapshotComplete } from "@/lib/static-snapshots/canvas-home-snapshot-service";

const buildMock = vi.fn();

vi.mock("@/lib/static-snapshots/build-canvas-home-snapshot", () => ({
  buildCanvasHomeSnapshot: (...args: unknown[]) => buildMock(...args),
  buildCanvasHomeSnapshotFallback: () => ({
    version: 1,
    featured: [],
    templates: [],
    cases: [],
    filmShowcase: [],
  }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe("resolveCanvasHomeSnapshotComplete", () => {
  beforeEach(() => {
    buildMock.mockReset();
  });

  it("merges discovery when snapshot is film-only", async () => {
    buildMock.mockResolvedValue({
      version: 1,
      featured: [{ id: "live-feat" }],
      templates: [{ id: "live-tpl" }],
      cases: [],
      filmShowcase: [],
    });

    const partial = {
      ...buildCanvasHomeSnapshotFallback(),
      filmShowcase: [{ id: "film-1" }],
    };

    const result = await resolveCanvasHomeSnapshotComplete(partial);
    expect(buildMock).toHaveBeenCalledOnce();
    expect(result.featured).toHaveLength(1);
    expect(result.filmShowcase).toHaveLength(1);
  });

  it("returns payload unchanged when complete", async () => {
    const complete = {
      version: 1 as const,
      featured: [{ id: "f" }],
      templates: [],
      cases: [],
      filmShowcase: [{ id: "film" }],
    };
    const result = await resolveCanvasHomeSnapshotComplete(complete);
    expect(buildMock).not.toHaveBeenCalled();
    expect(result).toEqual(complete);
  });
});
