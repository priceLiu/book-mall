import { describe, expect, it } from "vitest";

import {
  buildAuthShowcaseHeroPool,
  pickAuthShowcaseHero,
} from "@/lib/auth/shuffle-portal-showcase";
import type { PortalFilmShowcaseMedia } from "@/lib/canvas/sbv1-film-showcase";

function item(
  partial: Partial<PortalFilmShowcaseMedia> &
    Pick<PortalFilmShowcaseMedia, "id" | "url" | "kind">,
): PortalFilmShowcaseMedia {
  return {
    sourceKind: partial.sourceKind ?? "project",
    sourceId: partial.sourceId ?? "p1",
    projectName: "案例",
    description: "",
    ...partial,
  };
}

describe("pickAuthShowcaseHero", () => {
  it("picks one candidate per project and prefers latest video", () => {
    const pool = buildAuthShowcaseHeroPool([
      item({ id: "1", url: "https://x/v1.mp4", kind: "video", sourceId: "a" }),
      item({ id: "2", url: "https://x/v2.mp4", kind: "video", sourceId: "a" }),
      item({ id: "3", url: "https://x/img.png", kind: "image", sourceId: "a" }),
      item({ id: "4", url: "https://x/other.mp4", kind: "video", sourceId: "b" }),
    ]);
    expect(pool).toHaveLength(2);
    expect(pool.map((p) => p.url)).toEqual(["https://x/v2.mp4", "https://x/other.mp4"]);
  });

  it("picks from story pool when only story videos exist", () => {
    const raw = [
      item({
        id: "story:1",
        url: "https://x/s.mp4",
        kind: "video",
        sourceId: "discover:showcase-9x16-1",
        sourceKind: "story",
      }),
    ];
    const picked = pickAuthShowcaseHero(raw);
    expect(picked?.sourceKind).toBe("story");
  });

  it("excludes previous url when multiple heroes exist", () => {
    const raw = [
      item({ id: "1", url: "https://x/a.mp4", kind: "video", sourceId: "a" }),
      item({ id: "2", url: "https://x/b.mp4", kind: "video", sourceId: "b" }),
    ];
    const picked = pickAuthShowcaseHero(raw, { excludeUrl: "https://x/a.mp4" });
    expect(picked?.url).toBe("https://x/b.mp4");
  });
});