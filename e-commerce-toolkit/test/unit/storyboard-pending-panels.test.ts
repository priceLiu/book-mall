import { describe, expect, it } from "vitest";

import {
  listOrphanStoryboardPendingPanelImageIndices,
  resolveActiveStoryboardPanelImageBusyIndices,
  resolveActiveStoryboardPanelVideoBusyIndices,
  resolveStoryboardMergeTargetIndexes,
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

  it("drops orphan meta pending when HTTP is not in flight and sheet has no image", () => {
    expect(
      resolveActiveStoryboardPanelImageBusyIndices({
        regeneratingPanels: [],
        pendingPanelIndices: [1, 2, 3],
        inFlightWatchIndices: [],
        imageGenInFlight: false,
        panels: [
          { index: 1, imageUrl: null },
          { index: 2, imageUrl: null },
          { index: 3, imageUrl: null },
        ],
      }),
    ).toEqual([]);
  });

  it("selective batch in flight ignores stale pending outside watch", () => {
    expect(
      resolveActiveStoryboardPanelImageBusyIndices({
        regeneratingPanels: [1, 2, 3],
        pendingPanelIndices: [1, 2, 3, 4, 5, 6],
        inFlightWatchIndices: [1, 2, 3],
        imageGenInFlight: true,
        panels: [
          { index: 1, imageUrl: null },
          { index: 2, imageUrl: null },
          { index: 3, imageUrl: null },
          { index: 4, imageUrl: null },
          { index: 5, imageUrl: null },
          { index: 6, imageUrl: null },
        ],
      }),
    ).toEqual([1, 2, 3]);
  });

  it("listOrphanStoryboardPendingPanelImageIndices finds stale meta pending", () => {
    const orphans = listOrphanStoryboardPendingPanelImageIndices(
      {
        workflow: {
          pendingPanelImages: {
            "1": { startedAt: "2020-01-01T00:00:00.000Z" },
            "2": { startedAt: new Date().toISOString() },
          },
        },
      },
      [{ index: 1, imageUrl: null }, { index: 2, imageUrl: null }],
      { imageGenInFlight: false, inFlightWatchIndices: [] },
    );
    expect(orphans).toEqual([1, 2]);
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
        inFlightWatchIndices: [2],
        videoGenInFlight: true,
        panels,
      }),
    ).toEqual([2]);
  });

  it("drops stale local busy when video exists and HTTP is not in flight", () => {
    expect(
      resolveActiveStoryboardPanelVideoBusyIndices({
        panelVidBusyPanels: [1, 2],
        pendingPanelVideoIndices: [],
        inFlightWatchIndices: [],
        videoGenInFlight: false,
        panels,
      }),
    ).toEqual([]);
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

describe("resolveStoryboardMergeTargetIndexes", () => {
  const panels = [
    { index: 1, videoUrl: "https://a/1.mp4" },
    { index: 2, videoUrl: "https://a/2.mp4" },
    { index: 3, videoUrl: "https://a/3.mp4" },
    { index: 4, videoUrl: null },
  ];

  it("returns empty when nothing selected (no implicit merge-all)", () => {
    expect(
      resolveStoryboardMergeTargetIndexes({
        selectedVideoPanels: [],
        panels,
      }),
    ).toEqual([]);
  });

  it("merges only selected panels that already have videoUrl", () => {
    expect(
      resolveStoryboardMergeTargetIndexes({
        selectedVideoPanels: [1, 3],
        panels,
      }),
    ).toEqual([1, 3]);
  });

  it("drops selected panels without videoUrl", () => {
    expect(
      resolveStoryboardMergeTargetIndexes({
        selectedVideoPanels: [2, 4],
        panels,
      }),
    ).toEqual([2]);
  });
});
