import { describe, expect, it } from "vitest";

import {
  resolveActiveStoryboardPanelImageBusyIndices,
  resolveActiveStoryboardPanelVideoBusyIndices,
} from "@/lib/storyboard-pending-panels";

describe("resolveActiveStoryboardPanelImageBusyIndices", () => {
  const panels = [
    { index: 1, imageUrl: "https://a/1.png" },
    { index: 2, imageUrl: "https://a/2.png" },
    { index: 3, imageUrl: null },
  ];

  it("drops stale pending when sheet already has imageUrl", () => {
    expect(
      resolveActiveStoryboardPanelImageBusyIndices({
        regeneratingPanels: [],
        pendingPanelIndices: [2],
        inFlightWatchIndices: [],
        imageGenInFlight: false,
        panels,
      }),
    ).toEqual([]);
  });

  it("keeps in-flight watch busy during regenerate even if old imageUrl exists", () => {
    expect(
      resolveActiveStoryboardPanelImageBusyIndices({
        regeneratingPanels: [2],
        pendingPanelIndices: [],
        inFlightWatchIndices: [2],
        imageGenInFlight: true,
        panels,
      }),
    ).toEqual([2]);
  });

  it("keeps pending when image not yet on sheet", () => {
    expect(
      resolveActiveStoryboardPanelImageBusyIndices({
        regeneratingPanels: [3],
        pendingPanelIndices: [3],
        inFlightWatchIndices: [],
        imageGenInFlight: false,
        panels,
      }),
    ).toEqual([3]);
  });
});

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
