import { describe, expect, it } from "vitest";

import { extractBailianR2vVideoUrlFromGatewaySummary } from "@/lib/canvas/canvas-video-bailian-r2v";

describe("extractBailianR2vVideoUrlFromGatewaySummary", () => {
  it("reads nested output.video_url (DashScope raw)", () => {
    expect(
      extractBailianR2vVideoUrlFromGatewaySummary({
        output: {
          task_status: "SUCCEEDED",
          video_url: "https://cdn.example/bailian.mp4",
        },
      }),
    ).toBe("https://cdn.example/bailian.mp4");
  });

  it("reads flat video_url on slim summary", () => {
    expect(
      extractBailianR2vVideoUrlFromGatewaySummary({
        task_status: "SUCCEEDED",
        video_url: "https://cdn.example/flat.mp4",
      }),
    ).toBe("https://cdn.example/flat.mp4");
  });
});
