import { describe, expect, it } from "vitest";

import {
  coerceSbv1ImageAspectForModel,
  sbv1ImageAspectOptionsForModel,
} from "@/lib/canvas/sbv1-image-models";

describe("sbv1 GPT image aspect options", () => {
  it("hides 4:5 / 5:4 for GPT Image models", () => {
    const gpt = sbv1ImageAspectOptionsForModel("gpt-image-2").map((r) => r.value);
    expect(gpt).not.toContain("4:5");
    expect(gpt).not.toContain("5:4");
    expect(gpt).toContain("3:4");
    expect(gpt).toContain("4:3");

    const wan = sbv1ImageAspectOptionsForModel("wan2.7-image").map((r) => r.value);
    expect(wan).toContain("4:5");
    expect(wan).toContain("5:4");
  });

  it("coerces unavailable GPT ratios to nearest supported", () => {
    expect(coerceSbv1ImageAspectForModel("gpt-image-2", "4:5")).toBe("3:4");
    expect(coerceSbv1ImageAspectForModel("4o-image", "5:4")).toBe("4:3");
    expect(coerceSbv1ImageAspectForModel("wan2.7-image", "4:5")).toBe("4:5");
  });
});
