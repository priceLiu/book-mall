import { describe, expect, it } from "vitest";
import {
  buildDashscopeVideoModelRefSyncPatch,
  getSbv1VideoDockModeChips,
  getSbv1VideoModelRefCaps,
  resolveDashscopeVideoModelForRefLinks,
  resolveSbv1VideoModelRefLinkBlock,
  resolveSbv1VideoModelRefRunWarning,
  sbv1DockRefCornerLabel,
  clampSbv1ReferenceMode,
} from "@/lib/canvas/sbv1-video-model-reference";

describe("sbv1-video-model-reference", () => {
  it("Seedance 2.0 dock exposes text-to-video chip", () => {
    const chips = getSbv1VideoDockModeChips("doubao-seedance-2.0");
    expect(chips.map((c) => c.id)).toEqual([
      "i2v",
      "t2v",
      "first_last",
      "omni",
      "multi_ref",
    ]);
    expect(chips.find((c) => c.id === "t2v")?.label).toBe("文生视频");
  });

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

  it("HappyHorse T2V with @ refs upgrades via bailian_r2v_media caps", () => {
    const caps = getSbv1VideoModelRefCaps("happyhorse-1.1-t2v");
    expect(caps.refApi).toBe("bailian_r2v_media");
    expect(caps.maxRefsOmni).toBe(9);
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

  it("resolveSbv1VideoModelRefRunWarning for T2V with refs", () => {
    const w = resolveSbv1VideoModelRefRunWarning({
      modelKey: "happyhorse-1.1-t2v",
      refCount: 2,
    });
    expect(w?.title).toBe("请切换为参考生视频模型");
    expect(w?.message).toContain("happyhorse-1.1-r2v");
    expect(w?.message).not.toContain("自动");
  });

  it("resolveSbv1VideoModelRefRunWarning null without refs", () => {
    expect(
      resolveSbv1VideoModelRefRunWarning({
        modelKey: "happyhorse-1.1-t2v",
        refCount: 0,
      }),
    ).toBeNull();
  });

  it("resolveSbv1VideoModelRefRunWarning for single i2v over limit", () => {
    const w = resolveSbv1VideoModelRefRunWarning({
      modelKey: "happyhorse-1.1-i2v",
      refCount: 3,
    });
    expect(w?.title).toBe("参考图超出模型上限");
  });

  it("resolveDashscopeVideoModelForRefLinks T2V→R2V with refs", () => {
    expect(
      resolveDashscopeVideoModelForRefLinks("happyhorse-1.1-t2v", 2),
    ).toBe("happyhorse-1.1-r2v");
  });

  it("resolveDashscopeVideoModelForRefLinks R2V→T2V without refs", () => {
    expect(
      resolveDashscopeVideoModelForRefLinks("happyhorse-1.1-r2v", 0),
    ).toBe("happyhorse-1.1-t2v");
  });

  it("buildDashscopeVideoModelRefSyncPatch switches model + dock mode", () => {
    const patch = buildDashscopeVideoModelRefSyncPatch(
      {
        engine: {
          providerId: "gateway:bailian-dashscope-t2v",
          modelKey: "happyhorse-1.1-t2v",
          params: { resolution: "720P" },
        },
        dockInputMode: "t2v",
      },
      1,
    );
    expect(patch?.engine?.modelKey).toBe("happyhorse-1.1-r2v");
    expect(patch?.dockInputMode).toBe("omni");
  });

  it("resolveSbv1VideoModelRefLinkBlock disables T2V when refs connected", () => {
    expect(
      resolveSbv1VideoModelRefLinkBlock({
        modelKey: "happyhorse-1.1-t2v",
        refLinkCount: 2,
      }).blocked,
    ).toBe(true);
    expect(
      resolveSbv1VideoModelRefLinkBlock({
        modelKey: "happyhorse-1.1-r2v",
        refLinkCount: 2,
      }).blocked,
    ).toBe(false);
    expect(
      resolveSbv1VideoModelRefLinkBlock({
        modelKey: "wan3.0-video",
        refLinkCount: 2,
      }).blocked,
    ).toBe(false);
  });

  it("Wan 3.0 is All-in-One: t2v/i2v/first_last/omni, 10 refs", () => {
    const caps = getSbv1VideoModelRefCaps("wan3.0-video");
    expect(caps.supportedModes).toEqual(["omni", "first_last"]);
    expect(caps.maxRefsOmni).toBe(10);
    expect(getSbv1VideoDockModeChips("wan3.0-video").map((c) => c.id)).toEqual([
      "t2v",
      "i2v",
      "first_last",
      "omni",
    ]);
  });
});
