import { describe, expect, it } from "vitest";

import {
  imageCountFromInputSummary,
  resolveBillableImageCountFromLog,
  resolveBillableVideoSecondsFromLog,
} from "@/lib/gateway/log-billing-metrics";

describe("log-billing-metrics", () => {
  it("reads explicit imageCount from inputSummary", () => {
    expect(
      imageCountFromInputSummary({
        model: "aitryon-parsing-v1",
        input: { imageUrl: "https://x/a.jpg", imageCount: 1 },
      }),
    ).toBe(1);
  });

  it("TRYON parsing defaults to 1 input image", () => {
    expect(
      resolveBillableImageCountFromLog({
        requestKind: "TRYON",
        inputSummary: {
          model: "aitryon-parsing-v1",
          input: { imageUrl: "https://x/a.jpg", clothesType: ["upper", "lower"] },
        },
      }),
    ).toBe(1);
  });

  it("IMAGE counts referenceImageUrls", () => {
    expect(
      resolveBillableImageCountFromLog({
        requestKind: "IMAGE",
        inputSummary: {
          model: "wan2.7-image",
          input: { referenceImageUrls: ["https://a", "https://b"] },
        },
      }),
    ).toBe(2);
  });

  it("VIDEO counts reference duration as seconds", () => {
    expect(
      resolveBillableVideoSecondsFromLog({
        requestKind: "VIDEO",
        inputSummary: { input: { duration: 10 } },
      }),
    ).toBe(10);
    expect(
      resolveBillableVideoSecondsFromLog({
        requestKind: "VIDEO",
        inputSummary: { input: { durationSec: 5 } },
      }),
    ).toBe(5);
  });
});
