import { describe, expect, it } from "vitest";

import { resolveLibtvAudioDisplayTitle, isOpaqueGeneratedAudioFilename } from "@/lib/canvas/libtv-audio-display-title";
import { computeLibtvMediaAspectPresetSize } from "@/lib/canvas/libtv-media-aspect-preset";
import {
  reconcileLibtvMediaNodeBoxSizes,
  resolveLibtvMediaNodeBoxSize,
  libtvMediaNodesNeedViewportReflow,
} from "@/lib/canvas/libtv-media-node-size";
import {
  LIBTV_AUDIO_TRACK_LAYOUT_VERSION,
  LIBTV_AUDIO_TRACK_NODE_HEIGHT,
  LIBTV_AUDIO_TRACK_NODE_WIDTH,
} from "@/lib/canvas/libtv-node-chrome";
import type { CanvasFlowNode } from "@/lib/canvas/types";

const mixedGroupNodes = (): CanvasFlowNode[] => [
  {
    id: "g1",
    type: "group",
    position: { x: 0, y: 0 },
    data: { pro2Kind: "frame-board" },
  },
  {
    id: "v1",
    type: "sbv1-video-engine",
    parentId: "g1",
    position: { x: 0, y: 0 },
    data: { aspectRatio: "9:16", mediaFit: true },
    width: 1270,
    height: 2296,
  },
  {
    id: "img1",
    type: "story-pro2-image",
    parentId: "g1",
    position: { x: 0, y: 0 },
    data: {
      aspectRatio: "9:16",
      mediaAspectPreset: "9:16",
      mediaFit: false,
      mediaFitKey: "aspect-preset|9:16|pro2-image",
    },
    width: 700,
    height: 1288,
  },
  {
    id: "r1",
    type: "jianying-auto-render-pro2",
    parentId: "g1",
    position: { x: 0, y: 0 },
    data: { mediaFit: true },
    width: 635,
    height: 1167,
  },
];

describe("libtvMediaNodesNeedViewportReflow", () => {
  it("detects stale aspect preset size version before hydrate reconcile", () => {
    expect(libtvMediaNodesNeedViewportReflow(mixedGroupNodes())).toBe(true);
    expect(
      libtvMediaNodesNeedViewportReflow(
        reconcileLibtvMediaNodeBoxSizes(mixedGroupNodes()),
      ),
    ).toBe(false);
  });
});

describe("resolveLibtvMediaNodeBoxSize", () => {
  it("uses sbv1-video profile for story-pro2-image when group has videos", () => {
    const nodes = mixedGroupNodes();
    const image = nodes.find((n) => n.id === "img1")!;
    const expected = computeLibtvMediaAspectPresetSize("9:16", "sbv1-video");
    expect(resolveLibtvMediaNodeBoxSize(image, nodes)).toEqual(expected);
    expect(expected.width).toBe(
      Math.round(630 * (9 / 16)),
    );
  });
});

describe("reconcileLibtvMediaNodeBoxSizes", () => {
  it("fixes stale pro2-image box and auto-render in mixed video group", () => {
    const before = mixedGroupNodes();
    const after = reconcileLibtvMediaNodeBoxSizes(before);
    const expected = computeLibtvMediaAspectPresetSize("9:16", "sbv1-video");

    const image = after.find((n) => n.id === "img1")!;
    const render = after.find((n) => n.id === "r1")!;

    expect(image.width).toBe(expected.width);
    expect(image.height).toBe(expected.height);
    expect(
      (image.data as { mediaFitKey?: string }).mediaFitKey,
    ).toContain("|sbv1-video");

    expect(render.width).toBe(expected.width);
    expect(render.height).toBe(expected.height);
  });

  it("migrates legacy story-pro2-audio track to mini player layout size", () => {
    const before: CanvasFlowNode[] = [
      {
        id: "a1",
        type: "story-pro2-audio",
        position: { x: 0, y: 0 },
        data: { label: "音效设计", audioTrackLayoutVersion: 0 },
        width: 920,
        height: 104,
      },
    ];
    expect(libtvMediaNodesNeedViewportReflow(before)).toBe(true);
    const after = reconcileLibtvMediaNodeBoxSizes(before);
    const audio = after[0]!;
    expect(audio.width).toBe(LIBTV_AUDIO_TRACK_NODE_WIDTH);
    expect(audio.height).toBe(102);
    expect(
      (audio.data as { audioTrackLayoutVersion?: number }).audioTrackLayoutVersion,
    ).toBe(LIBTV_AUDIO_TRACK_LAYOUT_VERSION);
    expect(resolveLibtvMediaNodeBoxSize(audio)).toEqual({
      width: LIBTV_AUDIO_TRACK_NODE_WIDTH,
      height: LIBTV_AUDIO_TRACK_NODE_HEIGHT,
    });
  });
});

describe("resolveLibtvAudioDisplayTitle", () => {
  it("shows happy music before generation", () => {
    expect(
      resolveLibtvAudioDisplayTitle({ hasAudio: false, label: "音效设计" }),
    ).toBe("happy music");
  });

  it("prefers dock dialogue over opaque oss filename", () => {
    expect(
      resolveLibtvAudioDisplayTitle({
        hasAudio: true,
        dockInput: "数字化时代，数据驱动企业决策。",
        ossUrl:
          "https://cdn.example.com/uYxAADwAABpAAAACAAADSAAAAETEFNRTMu.mp3",
      }),
    ).toBe("数字化时代，数据驱动企业决策。");
  });

  it("uses oss filename when human readable", () => {
    expect(
      resolveLibtvAudioDisplayTitle({
        hasAudio: true,
        ossUrl: "https://cdn.example.com/Standalone_scifi_escape_bgm_audio%23e0fe7f.mp3",
      }),
    ).toBe("Standalone_scifi_escape_bgm_audio#e0fe7f");
  });

  it("skips opaque generated filenames without dialogue", () => {
    expect(
      resolveLibtvAudioDisplayTitle({
        hasAudio: true,
        ossUrl:
          "https://cdn.example.com/uYxAADwAABpAAAACAAADSAAAAETEFNRTMu.mp3",
      }),
    ).toBe("happy music");
  });
});

describe("isOpaqueGeneratedAudioFilename", () => {
  it("detects base64-like task filenames", () => {
    expect(isOpaqueGeneratedAudioFilename("uYxAADwAABpAAAACAAADSAAAAETEFNRTMu")).toBe(
      true,
    );
    expect(isOpaqueGeneratedAudioFilename("Standalone_scifi_bgm")).toBe(false);
  });
});
