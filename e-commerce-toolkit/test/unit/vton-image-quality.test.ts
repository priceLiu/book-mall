import { describe, expect, it } from "vitest";

import {
  VTON_DEFAULT_MODEL_IMAGE_SIZE,
  coerceVtonModelImageSize,
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
