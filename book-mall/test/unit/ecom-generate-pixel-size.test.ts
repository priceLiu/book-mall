import { describe, expect, it } from "vitest";

import {
  ecomRatioFromPixelSize,
  resolveEcomGeneratePixelSize,
  resolveStoryboardWan27JobSize,
} from "@/lib/ecom/ecom-storyboard-gen-params";

describe("ecomRatioFromPixelSize", () => {
  it("maps common pixel sizes to ratios including 9:16", () => {
    expect(ecomRatioFromPixelSize("1024*1024")).toBe("1:1");
    expect(ecomRatioFromPixelSize("720*960")).toBe("3:4");
    expect(ecomRatioFromPixelSize("960*1200")).toBe("4:5");
    expect(ecomRatioFromPixelSize("1920*1080")).toBe("16:9");
    expect(ecomRatioFromPixelSize("1080*1920")).toBe("9:16");
    expect(ecomRatioFromPixelSize("960*1696")).toBe("9:16");
  });
});

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

  it("maps 9:16 wan2.7 pixel size to vendor portrait size", () => {
    expect(
      resolveEcomGeneratePixelSize({
        modelKey: "wan2.7-image-pro",
        ratio: "9:16",
        imageSize: "1080*1920",
      }),
    ).toBe("960*1696");
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
