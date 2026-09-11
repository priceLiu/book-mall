import { describe, expect, it } from "vitest";

import {
  isOutfitVideoDirtySinceDeliverableSave,
  outfitVideoDeliverableFingerprint,
  outfitVideoHasSaveableWork,
} from "@/lib/ecom/ecom-outfit-video-deliverable-dirty";

const baseProject = {
  templateId: "outfit-v1",
  phase: "generate_shots",
  references: {
    model: { ossUrl: "https://example.com/model.jpg", label: "模特" },
  },
  sceneList: [
    {
      sceneId: "s1",
      index: 1,
      startTimeSec: 0,
      endTimeSec: 4,
      durationSec: 4,
      videoUrl: "https://example.com/s1.mp4",
    },
  ],
  structured: null,
  composeResult: null,
  meta: {
    deliverableSnapshot: {
      savedAt: "2026-01-01T00:00:00.000Z",
      title: "穿搭视频_20260101",
      templateId: "outfit-v1",
      phase: "generate_shots",
      references: {
        model: { ossUrl: "https://example.com/model.jpg", label: "模特" },
      },
      sceneList: [
        {
          sceneId: "s1",
          index: 1,
          startTimeSec: 0,
          endTimeSec: 4,
          durationSec: 4,
          videoUrl: "https://example.com/s1.mp4",
        },
      ],
      structured: null,
      composeResult: null,
    },
  },
};

describe("ecom-outfit-video-deliverable-dirty", () => {
  it("detects no dirty state after matching save snapshot", () => {
    expect(isOutfitVideoDirtySinceDeliverableSave(baseProject)).toBe(false);
  });

  it("detects dirty when scene video changes after save", () => {
    const dirty = {
      ...baseProject,
      sceneList: [
        {
          ...baseProject.sceneList[0]!,
          videoUrl: "https://example.com/s1-new.mp4",
        },
      ],
    };
    expect(isOutfitVideoDirtySinceDeliverableSave(dirty)).toBe(true);
  });

  it("treats missing snapshot as dirty", () => {
    expect(isOutfitVideoDirtySinceDeliverableSave({ ...baseProject, meta: {} })).toBe(true);
  });

  it("fingerprint is stable", () => {
    const a = outfitVideoDeliverableFingerprint(baseProject);
    const b = outfitVideoDeliverableFingerprint(baseProject);
    expect(a).toBe(b);
  });

  it("has saveable work when model or videos exist", () => {
    expect(outfitVideoHasSaveableWork(baseProject)).toBe(true);
    expect(
      outfitVideoHasSaveableWork({
        references: {},
        sceneList: [],
        composeResult: null,
      }),
    ).toBe(false);
  });
});
