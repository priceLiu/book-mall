import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mediaRenderJob: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

import { resolveStoryboardMergedVideoUrl } from "@/lib/ecom/ecom-storyboard-merged-video";

describe("resolveStoryboardMergedVideoUrl", () => {
  beforeEach(() => {
    findFirst.mockReset().mockResolvedValue(null);
    findMany.mockReset().mockResolvedValue([]);
  });

  it("returns snapshot videoUrl when present", async () => {
    const url = await resolveStoryboardMergedVideoUrl("user1", "proj1", {
      deliverableSnapshot: {
        videoUrl: "https://cdn.example.com/merged.mp4",
      },
    });
    expect(url).toBe("https://cdn.example.com/merged.mp4");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns null when no snapshot and no jobs", async () => {
    const url = await resolveStoryboardMergedVideoUrl("user-none", "proj-none", null);
    expect(url).toBeNull();
  });

  it("recovers from recent render job of the same project", async () => {
    findMany.mockResolvedValue([
      { sourceRef: { projectId: "other" }, resultOssUrl: "https://cdn.example.com/other.mp4" },
      { sourceRef: { projectId: "proj1" }, resultOssUrl: "https://cdn.example.com/proj1.mp4" },
    ]);
    const url = await resolveStoryboardMergedVideoUrl("user1", "proj1", null);
    expect(url).toBe("https://cdn.example.com/proj1.mp4");
  });
});
