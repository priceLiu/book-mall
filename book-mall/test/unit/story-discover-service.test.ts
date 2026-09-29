import { describe, expect, it } from "vitest";

import {
  getDiscoverShowcaseProjectDetail,
  storyDiscoverShowcaseFallback,
} from "@/lib/story/story-discover-service";

describe("story-discover-service", () => {
  it("builds showcase fallback with 16:9 and 9:16 groups", () => {
    const projects = storyDiscoverShowcaseFallback();
    expect(projects.length).toBeGreaterThanOrEqual(8);
    expect(projects.some((p) => p.aspectRatio === "16:9")).toBe(true);
    expect(projects.some((p) => p.aspectRatio === "9:16")).toBe(true);
    expect(projects.some((p) => p.name === "星尘旅人")).toBe(true);
    expect(projects.every((p) => p.coverImageUrl.startsWith("http"))).toBe(true);
  });

  it("resolves showcase detail by discover id", async () => {
    const detail = await getDiscoverShowcaseProjectDetail(
      "discover:showcase-16x9-1",
    );
    expect(detail).not.toBeNull();
    expect(detail?.name).toBe("星尘旅人");
    expect(detail?.characters).toEqual([]);
    expect(detail?.frames).toEqual([]);
  });
});
