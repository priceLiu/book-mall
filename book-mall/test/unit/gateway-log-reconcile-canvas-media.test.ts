import { describe, expect, it } from "vitest";

import {
  extractGatewayLogMediaUrl,
  isGatewayMediaResultUrl,
} from "@/lib/gateway/gateway-log-reconcile";
import {
  isCanvasImageResultUrl,
  isCanvasVideoResultUrl,
} from "@/lib/canvas/canvas-gateway-log-sync";

describe("canvas media gateway log reconcile", () => {
  it("detects canvas image and video result URLs", () => {
    expect(isCanvasVideoResultUrl("https://cdn.example/node-video/abc.mp4")).toBe(
      true,
    );
    expect(isCanvasImageResultUrl("https://cdn.example/node-image/abc.png")).toBe(
      true,
    );
    expect(isCanvasImageResultUrl("data:image/png;base64,abc")).toBe(true);
    expect(
      isCanvasImageResultUrl("https://cdn.example/node-video/abc.mp4"),
    ).toBe(false);
  });

  it("isGatewayMediaResultUrl covers image and video", () => {
    expect(
      isGatewayMediaResultUrl("https://cdn.example/out.jpg"),
    ).toBe(true);
    expect(
      isGatewayMediaResultUrl("https://cdn.example/out.mp4"),
    ).toBe(true);
    expect(isGatewayMediaResultUrl("https://cdn.example/page.html")).toBe(
      false,
    );
  });

  it("extractGatewayLogMediaUrl skips task_progress and reads imageUrls", () => {
    expect(
      extractGatewayLogMediaUrl({
        kind: "task_progress",
        status: "generating",
      }),
    ).toBeNull();
    expect(
      extractGatewayLogMediaUrl({
        imageUrls: ["https://cdn.example/a.png"],
        status: "succeeded",
      }),
    ).toBe("https://cdn.example/a.png");
    expect(
      extractGatewayLogMediaUrl({
        video_url: "https://cdn.example/v.mp4",
      }),
    ).toBe("https://cdn.example/v.mp4");
  });
});
