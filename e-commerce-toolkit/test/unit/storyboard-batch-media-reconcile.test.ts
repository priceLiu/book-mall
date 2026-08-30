import { describe, expect, it } from "vitest";

import {
  filterStoryboardBatchFailuresByPanelMedia,
  isStoryboardUpstreamTransportError,
  storyboardPanelHasMedia,
} from "@/lib/storyboard-batch-media-reconcile";

describe("isStoryboardUpstreamTransportError", () => {
  it("detects BFF proxy failures", () => {
    expect(isStoryboardUpstreamTransportError("upstream_fetch_failed: fetch failed")).toBe(
      true,
    );
    expect(isStoryboardUpstreamTransportError("生成失败")).toBe(false);
  });
});

describe("filterStoryboardBatchFailuresByPanelMedia", () => {
  const panels = [
    { index: 1, imageUrl: "https://a/1.png", videoUrl: null },
    { index: 2, imageUrl: null, videoUrl: "https://a/2.mp4" },
    { index: 3, imageUrl: null, videoUrl: null },
  ];

  it("drops video failures when panel already has videoUrl", () => {
    const out = filterStoryboardBatchFailuresByPanelMedia(
      [
        { index: 2, message: "upstream_fetch_failed: fetch failed" },
        { index: 3, message: "厂商超时" },
      ],
      panels,
      "video",
    );
    expect(out).toEqual([{ index: 3, message: "厂商超时" }]);
  });

  it("drops image failures when panel already has imageUrl", () => {
    const out = filterStoryboardBatchFailuresByPanelMedia(
      [{ index: 1, message: "upstream_fetch_failed" }],
      panels,
      "image",
    );
    expect(out).toEqual([]);
  });
});

describe("storyboardPanelHasMedia", () => {
  it("checks panel media by kind", () => {
    const panels = [{ index: 2, videoUrl: "https://v.mp4" }];
    expect(storyboardPanelHasMedia(panels, 2, "video")).toBe(true);
    expect(storyboardPanelHasMedia(panels, 2, "image")).toBe(false);
  });
});
