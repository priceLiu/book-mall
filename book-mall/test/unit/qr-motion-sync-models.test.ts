import { describe, expect, it } from "vitest";

import {
  formatHappyHorseImageRefToken,
  maxHappyHorsePromptImageIndex,
  parseHappyHorsePromptImageIndices,
  resolveMotionSyncReferenceImageUrls,
  validateHappyHorseMotionSyncDraft,
} from "@/lib/quick-replica/qr-motion-sync-models";

describe("qr-motion-sync-models HappyHorse refs", () => {
  it("parseHappyHorsePromptImageIndices allows duplicate [Image 1]", () => {
    const prompt =
      "[Image 1] and [Image 2] fight while [Image 1] jumps on a roof";
    expect(parseHappyHorsePromptImageIndices(prompt)).toEqual([1, 2, 1]);
    expect(maxHappyHorsePromptImageIndex(prompt)).toBe(2);
  });

  it("validateHappyHorseMotionSyncDraft passes when duplicate refs match uploaded count", () => {
    const err = validateHappyHorseMotionSyncDraft({
      prompt: "[Image 1] and [Image 2] with [Image 1] again",
      sceneImageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      targetImageUrl: "",
    });
    expect(err).toBeNull();
  });

  it("validateHappyHorseMotionSyncDraft fails when [Image N] exceeds uploads", () => {
    const err = validateHappyHorseMotionSyncDraft({
      prompt: "[Image 3] moves",
      sceneImageUrls: ["https://example.com/a.jpg"],
      targetImageUrl: "",
    });
    expect(err).toContain("[Image 3]");
  });

  it("resolveMotionSyncReferenceImageUrls preserves upload order without dedupe", () => {
    const urls = resolveMotionSyncReferenceImageUrls({
      sceneImageUrls: [
        "https://example.com/a.jpg",
        "https://example.com/b.jpg",
      ],
      targetImageUrl: "",
    });
    expect(urls).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
  });

  it("formatHappyHorseImageRefToken matches API token shape", () => {
    expect(formatHappyHorseImageRefToken(1)).toBe("[Image 1]");
  });
});
