import { describe, expect, it } from "vitest";

import {
  jianyingSnapshotToWorkbench,
  workbenchToJianyingExportFrames,
} from "@/lib/media/jianying-compose-adapter";

describe("jianying-compose-adapter", () => {
  it("builds workbench from snapshot clips", () => {
    const wb = jianyingSnapshotToWorkbench([
      {
        sourceNodeId: "node-a",
        videoUrl: "https://cdn.example/a.mp4",
        dialogue: "台词",
        audioUrl: "https://cdn.example/a.mp3",
      },
    ]);
    expect(wb.orderedClipIds).toEqual(["node-a"]);
    expect(wb.clips[0]?.audioUrl).toBe("https://cdn.example/a.mp3");
    expect(wb.clips[0]?.subtitle).toBe("台词");
  });

  it("preserves user trim when snapshot URL refreshes", () => {
    const persisted = jianyingSnapshotToWorkbench(
      [{ sourceNodeId: "n1", videoUrl: "https://old.mp4" }],
      null,
    );
    persisted.clips[0]!.sourceStartSec = 2;
    persisted.clips[0]!.sourceEndSec = 8;

    const merged = jianyingSnapshotToWorkbench(
      [{ sourceNodeId: "n1", videoUrl: "https://new.mp4" }],
      persisted,
    );
    expect(merged.clips[0]?.videoUrl).toBe("https://new.mp4");
    expect(merged.clips[0]?.sourceStartSec).toBe(2);
    expect(merged.clips[0]?.sourceEndSec).toBe(8);
  });

  it("exports frames for media render", () => {
    const frames = workbenchToJianyingExportFrames({
      orderedClipIds: ["n1"],
      clips: [
        {
          id: "n1",
          videoUrl: "https://cdn.example/v.mp4",
          audioUrl: "https://cdn.example/a.mp3",
          subtitle: "hi",
          source: "external",
        },
      ],
    });
    expect(frames).toHaveLength(1);
    expect(frames[0]?.videoUrl).toBe("https://cdn.example/v.mp4");
    expect(frames[0]?.audioUrl).toBe("https://cdn.example/a.mp3");
    expect(frames[0]?.dialogue).toBe("hi");
  });
});
