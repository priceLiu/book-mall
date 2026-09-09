import { describe, expect, it } from "vitest";

import {
  resolveEcomGeneratePixelSize,
  resolveStoryboardWan27JobSize,
} from "@/lib/ecom/ecom-storyboard-gen-params";

describe("resolveEcomGeneratePixelSize", () => {
  it("maps 2K for wan2.7-image-pro to pixel size", () => {
    expect(
      resolveEcomGeneratePixelSize({
        modelKey: "wan2.7-image-pro",
        ratio: "16:9",
        imageSize: "2K",
      }),
    ).toBe("1696*960");
  });

  it("passes through 3:4 pixel size for wan2.7-image-pro", () => {
    expect(
      resolveEcomGeneratePixelSize({
        modelKey: "wan2.7-image-pro",
        ratio: "3:4",
        imageSize: "720*960",
      }),
    ).toBe("720*960");
    expect(
      resolveEcomGeneratePixelSize({
        modelKey: "wan2.7-image-pro",
        ratio: "3:4",
        imageSize: "1536*2048",
      }),
    ).toBe("1536*2048");
  });

  it("keeps portrait pixel size when refs present and forced", () => {
    expect(
      resolveStoryboardWan27JobSize({
        wan26: false,
        refCount: 1,
        wan27Size: "960*1696",
        keepPixelSizeWithRefs: true,
      }),
    ).toBe("960*1696");
    expect(
      resolveStoryboardWan27JobSize({
        wan26: false,
        refCount: 1,
        wan27Size: "960*1696",
      }),
    ).toBeUndefined();
  });
});
