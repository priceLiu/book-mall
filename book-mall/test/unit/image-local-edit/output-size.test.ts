import { describe, expect, it } from "vitest";

import {
  formatLocalEditOutputSize,
  mergeLocalEditOutputSize,
} from "@/lib/image-local-edit/output-size";

describe("formatLocalEditOutputSize", () => {
  it("snaps to 16px grid within 512–2048", () => {
    expect(formatLocalEditOutputSize(1033, 1032)).toBe("1040*1040");
    expect(formatLocalEditOutputSize(800, 1200)).toBe("800*1200");
  });

  it("clamps extreme values", () => {
    expect(formatLocalEditOutputSize(100, 5000)).toBe("512*2048");
  });
});

describe("mergeLocalEditOutputSize", () => {
  it("fills size when missing", () => {
    expect(
      mergeLocalEditOutputSize(undefined, { width: 1024, height: 768 }),
    ).toEqual({ size: "1024*768" });
  });

  it("preserves explicit size", () => {
    expect(
      mergeLocalEditOutputSize({ size: "1536*1536" }, { width: 800, height: 600 }),
    ).toEqual({ size: "1536*1536" });
  });
});
