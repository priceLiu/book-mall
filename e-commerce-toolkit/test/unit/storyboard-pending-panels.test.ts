import { describe, expect, it } from "vitest";

import { resolveActiveStoryboardPanelVideoBusyIndices } from "@/lib/storyboard-pending-panels";

describe("resolveActiveStoryboardPanelVideoBusyIndices", () => {
  const panels = [
    { index: 1, videoUrl: "https://a/1.mp4" },
    { index: 2, videoUrl: "https://a/2.mp4" },
    { index: 3, videoUrl: null },
  ];

  it("drops stale pending when sheet already has videoUrl", () => {
    expect(
      resolveActiveStoryboardPanelVideoBusyIndices({
        panelVidBusyPanels: [],
        pendingPanelVideoIndices: [2],
        panels,
      }),
    ).toEqual([]);
  });

  it("keeps local watch busy during regenerate even if old videoUrl exists", () => {
    expect(
      resolveActiveStoryboardPanelVideoBusyIndices({
        panelVidBusyPanels: [2],
        pendingPanelVideoIndices: [2],
        panels,
      }),
    ).toEqual([2]);
  });

  it("keeps pending when video not yet on sheet", () => {
    expect(
      resolveActiveStoryboardPanelVideoBusyIndices({
        panelVidBusyPanels: [3],
        pendingPanelVideoIndices: [3],
        panels,
      }),
    ).toEqual([3]);
  });
});
