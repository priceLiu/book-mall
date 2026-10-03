import { describe, expect, it } from "vitest";

import {
  createDefaultArtifact,
  parseEcomCopyImageArtifact,
} from "@private/ecom-copy-overlay";

describe("EcomCopyImageArtifact", () => {
  it("createDefaultArtifact sets schema and overlay", () => {
    const a = createDefaultArtifact({
      slotCopy: "新品上市",
      exportWidthPx: 750,
      sourceModule: "poster",
    });
    expect(a.schema).toBe("ecom-copy-image-artifact/v1");
    expect(a.copy.slotCopy).toBe("新品上市");
    expect(a.layout.exportWidthPx).toBe(750);
    expect(a.render.burnCopyInImage).toBe(false);
  });

  it("parse round-trips", () => {
    const raw = createDefaultArtifact({
      slotCopy: "测试",
      imagePrompt: "无字场景",
      baseImageUrl: "https://example.com/base.png",
    });
    const parsed = parseEcomCopyImageArtifact(raw);
    expect(parsed?.copy.slotCopy).toBe("测试");
    expect(parsed?.image.baseImageUrl).toBe("https://example.com/base.png");
  });
});
