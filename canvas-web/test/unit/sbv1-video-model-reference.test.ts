import { describe, expect, it } from "vitest";
import {
  getSbv1VideoModelRefCaps,
  sbv1DockRefCornerLabel,
  clampSbv1ReferenceMode,
} from "@/lib/canvas/sbv1-video-model-reference";

describe("sbv1-video-model-reference", () => {
  it("Kling 3.0 Turbo supports omni + first_last", () => {
    const caps = getSbv1VideoModelRefCaps("kling/v3-turbo-image-to-video");
    expect(caps.supportedModes).toEqual(["omni", "first_last"]);
    expect(caps.refApi).toBe("kling_image_urls");
  });

  it("Wan 2.7 i2v uses first/last frame URLs", () => {
    const caps = getSbv1VideoModelRefCaps("wan/2-7-image-to-video");
    expect(caps.supportedModes).toContain("first_last");
    expect(caps.refApi).toBe("wan_first_last_url");
  });

  it("Wan 2.7 R2V supports omni + first_last (2 refs)", () => {
    const caps = getSbv1VideoModelRefCaps("wan2.7-r2v");
    expect(caps.supportedModes).toEqual(["omni", "first_last"]);
  });

  it("HappyHorse i2v is single-frame only", () => {
    const caps = getSbv1VideoModelRefCaps("happyhorse/image-to-video");
    expect(caps.supportedModes).toEqual(["omni"]);
    expect(caps.maxRefsOmni).toBe(1);
  });

  it("HappyHorse R2V supports omni + first_last", () => {
    const caps = getSbv1VideoModelRefCaps("happyhorse-1.0-r2v");
    expect(caps.supportedModes).toContain("first_last");
  });

  it("Kling 3.0 multi_shots disables first_last", () => {
    const caps = getSbv1VideoModelRefCaps("kling-3.0/video", {
      multiShots: true,
    });
    expect(caps.supportedModes).toEqual(["omni"]);
  });

  it("dock corner labels for first_last", () => {
    expect(sbv1DockRefCornerLabel("first_last", 0)).toBe("首帧");
    expect(sbv1DockRefCornerLabel("first_last", 1)).toBe("尾帧");
    expect(sbv1DockRefCornerLabel("omni", 0)).toBeUndefined();
  });

  it("clampSbv1ReferenceMode falls back to omni", () => {
    const caps = getSbv1VideoModelRefCaps("happyhorse/image-to-video");
    expect(clampSbv1ReferenceMode("first_last", caps)).toBe("omni");
  });
});
