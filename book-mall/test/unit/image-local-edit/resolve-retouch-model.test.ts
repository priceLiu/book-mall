import { describe, expect, it } from "vitest";

import { resolveRetouchModelForSelection } from "@/lib/image-local-edit/resolve-retouch-model";

describe("resolveRetouchModelForSelection", () => {
  it("routes qwen + mask to wanx-x-painting", () => {
    expect(
      resolveRetouchModelForSelection({
        model: "qwen-image-edit-max",
        selection: { kind: "mask", maskDataUrl: "data:image/png;base64,abc" },
      }),
    ).toBe("wanx-x-painting");
  });

  it("routes canvas wan2.7 + brush mask to wanx-x-painting", () => {
    expect(
      resolveRetouchModelForSelection({
        model: "wan2.7-image-pro",
        selection: { kind: "mask", maskDataUrl: "data:image/png;base64,abc" },
      }),
    ).toBe("wanx-x-painting");
  });

  it("keeps qwen when no selection (full-image edit)", () => {
    expect(
      resolveRetouchModelForSelection({
        model: "qwen-image-edit-max",
      }),
    ).toBe("qwen-image-edit-max");
  });

  it("keeps wanx when mask present", () => {
    expect(
      resolveRetouchModelForSelection({
        model: "wanx-x-painting",
        selection: { kind: "mask", maskDataUrl: "data:image/png;base64,abc" },
      }),
    ).toBe("wanx-x-painting");
  });

  it("keeps wan2.7 for bbox", () => {
    expect(
      resolveRetouchModelForSelection({
        model: "wan2.7-image-pro",
        selection: { kind: "bbox", bbox: [10, 20, 100, 200] },
      }),
    ).toBe("wan2.7-image-pro");
  });

  it("keeps wan2.7 for multi-bbox", () => {
    expect(
      resolveRetouchModelForSelection({
        model: "wan2.7-image-pro",
        selection: { kind: "multi-bbox", bboxList: [[[0, 0, 50, 50]]] },
      }),
    ).toBe("wan2.7-image-pro");
  });
});
