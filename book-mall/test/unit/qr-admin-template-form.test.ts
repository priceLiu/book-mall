import { describe, expect, it } from "vitest";

import { buildAdminReference } from "@/lib/quick-replica/qr-admin-template-form";

describe("buildAdminReference sceneImages", () => {
  it("persists sceneImages for text-to-video templates", () => {
    const ref = buildAdminReference({
      category: "video",
      kind: "text-to-video",
      title: "demo",
      thumbnailUrl: "https://example.com/thumb.mp4",
      promptText: "sunset beach",
      mediaUrl: "https://example.com/thumb.mp4",
      sceneImageUrls: [
        "https://example.com/a.jpg",
        "https://example.com/b.jpg",
      ],
    });
    expect(ref.slots.sceneImages).toEqual([
      { url: "https://example.com/a.jpg" },
      { url: "https://example.com/b.jpg" },
    ]);
  });

  it("omits sceneImages when admin clears all reference images", () => {
    const ref = buildAdminReference({
      category: "video",
      kind: "text-to-video",
      title: "demo",
      thumbnailUrl: "https://example.com/thumb.mp4",
      promptText: "sunset beach",
      mediaUrl: "https://example.com/thumb.mp4",
      sceneImageUrls: [],
    });
    expect(ref.slots.sceneImages).toBeUndefined();
  });
});
