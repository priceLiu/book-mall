import { describe, expect, it } from "vitest";

import {
  MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH,
} from "@/lib/ecom/ecom-media-decompose-mock-fixtures";
import {
  extractMediaDecomposePatch,
  validateMediaDecomposeImageReplicationQuality,
} from "@/lib/ecom/ecom-media-decompose-structured";

describe("validateMediaDecomposeImageReplicationQuality", () => {
  it("accepts rich mock liveActionReplication", () => {
    expect(
      validateMediaDecomposeImageReplicationQuality(MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH),
    ).toBeNull();
  });

  it("rejects thin liveActionReplication", () => {
    const thin = {
      ...MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH,
      liveActionReplication: {
        sceneSetup: "短",
        talentBlocking: "短",
        compositionFraming: "短",
        cameraPlacement: "三脚架",
        lightingSetup: "自然光",
        props: "无",
        cameraParams: "50mm",
        postProcessing: "调色",
        shootingChecklist: "拍",
      },
    };
    const err = validateMediaDecomposeImageReplicationQuality(thin);
    expect(err).toMatch(/liveActionReplication/);
    expect(err).toMatch(/场景搭建/);
  });
});

describe("extractMediaDecomposePatch image replication", () => {
  it("parses expanded liveActionReplication from fence", () => {
    const patch = extractMediaDecomposePatch(
      `\`\`\`media-decompose\n${JSON.stringify(MOCK_MEDIA_DECOMPOSE_IMAGE_PATCH)}\n\`\`\``,
    );
    expect(patch?.mediaType).toBe("image");
    if (patch?.mediaType !== "image") return;
    expect(patch.liveActionReplication.sceneSetup.length).toBeGreaterThan(50);
    expect(patch.liveActionReplication.shootingChecklist).toMatch(/1\./);
  });
});
