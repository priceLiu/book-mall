import { describe, expect, it } from "vitest";

import {
  VTON_DEFAULT_MODEL_IMAGE_SIZE,
  coerceVtonModelImageSize,
  parseVtonModelImagePixelSize,
  vtonDynamicResultAspectStyle,
  vtonTryonResultAspectRatio,
  vtonTryonResultAspectStyle,
} from "@/lib/vton-image-quality";

describe("coerceVtonModelImageSize", () => {
  it("defaults to lowest 720P", () => {
    expect(coerceVtonModelImageSize(undefined)).toBe(VTON_DEFAULT_MODEL_IMAGE_SIZE);
    expect(coerceVtonModelImageSize("")).toBe("720*960");
    expect(coerceVtonModelImageSize("invalid")).toBe("720*960");
  });

  it("keeps allowed sizes", () => {
    expect(coerceVtonModelImageSize("1080*1440")).toBe("1080*1440");
    expect(coerceVtonModelImageSize("1536*2048")).toBe("1536*2048");
  });
});

describe("vton tryon result aspect", () => {
  it("matches model image pixel ratio (3:4)", () => {
    expect(parseVtonModelImagePixelSize("720*960")).toEqual({ width: 720, height: 960 });
    expect(vtonTryonResultAspectRatio("1080*1440")).toBeCloseTo(0.75, 4);
    expect(vtonTryonResultAspectStyle("720*960")).toEqual({ aspectRatio: "720 / 960" });
  });
});

describe("vton dynamic result aspect", () => {
  it("uses 9:16 when ratio is 9:16", () => {
    expect(vtonDynamicResultAspectStyle({ ratio: "9:16" })).toEqual({
      aspectRatio: "9 / 16",
    });
  });

  it("prefers pixel size over ratio", () => {
    expect(vtonDynamicResultAspectStyle({ width: 1080, height: 1920, ratio: "16:9" })).toEqual({
      aspectRatio: "1080 / 1920",
    });
  });
});
