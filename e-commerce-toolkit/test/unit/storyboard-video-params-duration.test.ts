import { describe, expect, it } from "vitest";

import {
  clampStoryboardFullSheetDurationSec,
  formatStoryboardVideoGenError,
  pickStoryboardVideoModelForFullSheetDuration,
  resolveSheetTotalDurationHintSec,
  storyboardFullSheetDurationMismatchMessage,
} from "@/lib/storyboard-video-params";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

const videoModels: StoryboardGatewayModel[] = [
  {
    modelKey: "doubao-seedance-2.0",
    displayName: "Seedance 2.0",
    description: "",
    role: "VIDEO",
    credentialBound: true,
  },
  {
    modelKey: "wan3.0-video",
    displayName: "Wan 3.0",
    description: "",
    role: "VIDEO",
    credentialBound: true,
  },
  {
    modelKey: "wan2.7-r2v",
    displayName: "Wan 2.7 R2V",
    description: "",
    role: "VIDEO",
    credentialBound: true,
  },
];

describe("resolveSheetTotalDurationHintSec", () => {
  it("uses totalDurationHintSec when set", () => {
    expect(resolveSheetTotalDurationHintSec({ totalDurationHintSec: 24 })).toBe(24);
  });

  it("sums panel durationHintSec", () => {
    expect(
      resolveSheetTotalDurationHintSec({
        panels: [
          { durationHintSec: 4 },
          { durationHintSec: 4 },
          { durationHintSec: 4 },
        ],
      }),
    ).toBe(12);
  });
});

describe("pickStoryboardVideoModelForFullSheetDuration", () => {
  it("keeps preferred when duration fits", () => {
    expect(
      pickStoryboardVideoModelForFullSheetDuration(videoModels, 10, "doubao-seedance-2.0"),
    ).toBe("doubao-seedance-2.0");
  });

  it("switches to wan3.0 when duration exceeds 15s", () => {
    expect(
      pickStoryboardVideoModelForFullSheetDuration(videoModels, 24, "doubao-seedance-2.0"),
    ).toBe("wan3.0-video");
  });
});

describe("storyboardFullSheetDurationMismatchMessage", () => {
  it("warns to pick wan 3.0 for long duration on seedance", () => {
    const msg = storyboardFullSheetDurationMismatchMessage("doubao-seedance-2.0", 24);
    expect(msg).toContain("万相 3.0");
  });

  it("returns null when duration fits wan 3.0", () => {
    expect(storyboardFullSheetDurationMismatchMessage("wan3.0-video", 24)).toBeNull();
  });
});

describe("clampStoryboardFullSheetDurationSec", () => {
  it("clamps to model max", () => {
    expect(clampStoryboardFullSheetDurationSec(24, "doubao-seedance-2.0")).toBe(10);
    expect(clampStoryboardFullSheetDurationSec(24, "wan3.0-video")).toBe(24);
  });
});

describe("formatStoryboardVideoGenError", () => {
  it("maps auth errors to credential hint", () => {
    const msg = formatStoryboardVideoGenError(
      "UPSTREAM_AUTH_FAILED: The API key doesn't exist (401)",
    );
    expect(msg).toContain("API Key");
    expect(msg).not.toContain("充值");
  });

  it("maps balance errors to recharge hint", () => {
    const msg = formatStoryboardVideoGenError("UPSTREAM_INSUFFICIENT_BALANCE");
    expect(msg).toContain("余额");
  });
});
