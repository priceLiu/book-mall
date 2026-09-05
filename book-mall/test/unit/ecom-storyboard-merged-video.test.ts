import { describe, expect, it } from "vitest";

import { resolveStoryboardMergedVideoUrl } from "@/lib/ecom/ecom-storyboard-merged-video";

describe("resolveStoryboardMergedVideoUrl", () => {
  it("returns snapshot videoUrl when present", async () => {
    const url = await resolveStoryboardMergedVideoUrl("user1", "proj1", {
      deliverableSnapshot: {
        videoUrl: "https://cdn.example.com/merged.mp4",
      },
    });
    expect(url).toBe("https://cdn.example.com/merged.mp4");
  });

  it("returns null when no snapshot and no jobs", async () => {
    const url = await resolveStoryboardMergedVideoUrl("user-none", "proj-none", null);
    expect(url).toBeNull();
  });
});
