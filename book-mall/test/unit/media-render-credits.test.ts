import { describe, expect, it } from "vitest";

import {
  MEDIA_RENDER_ASR_SURCHARGE_CREDITS,
  MEDIA_RENDER_BASE_CREDITS,
  computeMediaRenderCredits,
  usesMediaRenderAsr,
} from "@/lib/media/media-render-credits";
import { DEFAULT_RENDER_PROFILE } from "@/lib/media/timeline-types";

describe("media-render-credits", () => {
  it("base render = 20 credits", () => {
    expect(computeMediaRenderCredits(DEFAULT_RENDER_PROFILE)).toBe(
      MEDIA_RENDER_BASE_CREDITS,
    );
  });

  it("ASR burn-in adds 10 credits", () => {
    const profile = {
      ...DEFAULT_RENDER_PROFILE,
      subtitle: { mode: "asr" as const, burnIn: true },
    };
    expect(usesMediaRenderAsr(profile)).toBe(true);
    expect(computeMediaRenderCredits(profile)).toBe(
      MEDIA_RENDER_BASE_CREDITS + MEDIA_RENDER_ASR_SURCHARGE_CREDITS,
    );
  });
});
