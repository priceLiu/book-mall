import { describe, expect, it } from "vitest";
import { heldMediaPreviewSrc } from "@/lib/canvas/media-preview-hold";

describe("heldMediaPreviewSrc", () => {
  const ephemeral = "https://temp.example/a.png";
  const oss = "https://cdn.example/node-image/a.png";

  it("keeps the previous image while the OSS url is still loading", () => {
    expect(heldMediaPreviewSrc(oss, ephemeral, false, false)).toBe(ephemeral);
  });

  it("drops the hold once the new url is ready", () => {
    expect(heldMediaPreviewSrc(oss, ephemeral, true, false)).toBe("");
  });

  it("does not hold when there is no previous image", () => {
    expect(heldMediaPreviewSrc(oss, "", false, false)).toBe("");
  });

  it("does not hold a failed url that will show the empty state", () => {
    expect(heldMediaPreviewSrc(oss, ephemeral, false, true)).toBe("");
  });
});
