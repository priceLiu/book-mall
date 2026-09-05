import { describe, expect, it } from "vitest";

import {
  mergeOutfitVideoGatewayVideoModels,
  OUTFIT_VIDEO_KLING_MOTION_META,
  resolveOutfitVideoGenerateModelKey,
} from "@/lib/ecom/ecom-outfit-video-models";

describe("ecom-outfit-video-models", () => {
  it("resolveOutfitVideoGenerateModelKey accepts Kling motion-control (not storyboard whitelist)", () => {
    expect(resolveOutfitVideoGenerateModelKey("kling-3.0/motion-control")).toBe(
      "kling-3.0/motion-control",
    );
    expect(resolveOutfitVideoGenerateModelKey("wan2.7-r2v")).toBe("wan2.7-r2v");
  });

  it("resolveOutfitVideoGenerateModelKey rejects unknown models", () => {
    expect(() => resolveOutfitVideoGenerateModelKey("doubao-seedance-2.0")).toThrow(
      /不支持穿搭逐镜生成/,
    );
  });

  it("always lists Kling motion models (bound when KIE credential present)", () => {
    const withoutKie = mergeOutfitVideoGatewayVideoModels(
      [{ modelKey: "wan2.7-r2v", displayName: "Wan 2.7", description: "", role: "VIDEO", credentialBound: true }],
      ["BAILIAN"],
    );
    expect(withoutKie.some((m) => m.modelKey === "kling-3.0/motion-control")).toBe(true);
    const kling = withoutKie.find((m) => m.modelKey === "kling-3.0/motion-control");
    expect(kling?.credentialBound).toBe(false);

    const withKie = mergeOutfitVideoGatewayVideoModels(withoutKie, ["BAILIAN", "KIE"]);
    expect(withKie.find((m) => m.modelKey === "kling-3.0/motion-control")?.credentialBound).toBe(
      true,
    );
  });

  it("sorts Kling before R2V models", () => {
    const merged = mergeOutfitVideoGatewayVideoModels([], ["BAILIAN", "KIE"]);
    expect(merged[0]?.modelKey).toBe("kling-3.0/motion-control");
    expect(merged.some((m) => m.modelKey === "wan2.7-r2v")).toBe(true);
    const klingIdx = merged.findIndex((m) => m.modelKey === "kling-3.0/motion-control");
    const wanIdx = merged.findIndex((m) => m.modelKey === "wan2.7-r2v");
    expect(klingIdx).toBeLessThan(wanIdx);
  });

  it("preserves registry display meta for motion models", () => {
    const merged = mergeOutfitVideoGatewayVideoModels(
      [
        {
          modelKey: "kling-3.0/motion-control",
          displayName: "Registry Title",
          description: "from registry",
          role: "VIDEO",
          credentialBound: true,
          platformOffering: true,
        },
      ],
      ["KIE"],
    );
    const kling = merged.find((m) => m.modelKey === "kling-3.0/motion-control");
    expect(kling?.displayName).toBe(OUTFIT_VIDEO_KLING_MOTION_META[0]!.displayName);
    expect(kling?.credentialBound).toBe(true);
  });
});
