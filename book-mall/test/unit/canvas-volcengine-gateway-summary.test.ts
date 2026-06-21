import { describe, expect, it } from "vitest";

import { extractVolcengineVideoUrlFromGatewaySummary } from "@/lib/canvas/canvas-volcengine-recover";

describe("extractVolcengineVideoUrlFromGatewaySummary", () => {
  it("reads slim videoUrl", () => {
    expect(
      extractVolcengineVideoUrlFromGatewaySummary({
        videoUrl: "https://cdn.example/v.mp4",
      }),
    ).toBe("https://cdn.example/v.mp4");
  });

  it("reads nested output.content.video_url", () => {
    expect(
      extractVolcengineVideoUrlFromGatewaySummary({
        output: { content: { video_url: "https://cdn.example/nested.mp4" } },
      }),
    ).toBe("https://cdn.example/nested.mp4");
  });
});
