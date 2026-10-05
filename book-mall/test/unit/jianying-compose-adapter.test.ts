import { describe, expect, it } from "vitest";

import {
  jianyingSnapshotToWorkbench,
  workbenchToJianyingExportFrames,
} from "@/lib/media/jianying-compose-adapter";

describe("jianying-compose-adapter", () => {
  it("builds separate video and audio tracks from snapshot", () => {
    const wb = jianyingSnapshotToWorkbench({
      videoClips: [
        {
          sourceNodeId: "node-a",
          videoUrl: "https://cdn.example/a.mp4",
          dialogue: "台词",
        },
      ],
      audioClips: [
        {
          sourceNodeId: "tts-a",
          videoUrl: "",
          audioUrl: "https://cdn.example/a.mp3",
        },
      ],
    });
    expect(wb.orderedClipIds).toEqual(["node-a"]);
    expect(wb.clips[0]?.audioUrl).toBeUndefined();
    expect(wb.clips[0]?.subtitle).toBe("台词");
    expect(wb.orderedAudioClipIds).toEqual(["tts-a"]);
    expect(wb.audioClips?.[0]?.audioUrl).toBe("https://cdn.example/a.mp3");
  });

  it("preserves user trim when snapshot URL refreshes", () => {
    const persisted = jianyingSnapshotToWorkbench(
      { videoClips: [{ sourceNodeId: "n1", videoUrl: "https://old.mp4" }], audioClips: [] },
      null,
    );
    persisted.clips[0]!.sourceStartSec = 2;
    persisted.clips[0]!.sourceEndSec = 8;

    const merged = jianyingSnapshotToWorkbench(
      { videoClips: [{ sourceNodeId: "n1", videoUrl: "https://new.mp4" }], audioClips: [] },
      persisted,
    );
    expect(merged.clips[0]?.videoUrl).toBe("https://new.mp4");
    expect(merged.clips[0]?.sourceStartSec).toBe(2);
    expect(merged.clips[0]?.sourceEndSec).toBe(8);
  });

  it("drops upstream clips removed from snapshot but keeps imports", () => {
    const persisted = jianyingSnapshotToWorkbench(
      {
        videoClips: [
          { sourceNodeId: "v1", videoUrl: "https://a.mp4" },
          { sourceNodeId: "v2", videoUrl: "https://b.mp4" },
        ],
        audioClips: [{ sourceNodeId: "t2", videoUrl: "", audioUrl: "https://b.mp3" }],
      },
      null,
    );
    persisted.clips.push({
      id: "local-import",
      videoUrl: "https://import.mp4",
      source: "import",
    });
    persisted.orderedClipIds.push("local-import");

    const merged = jianyingSnapshotToWorkbench(
      { videoClips: [{ sourceNodeId: "v1", videoUrl: "https://a.mp4" }], audioClips: [] },
      persisted,
    );
    expect(merged.orderedClipIds).toEqual(["v1", "local-import"]);
    expect(merged.clips.map((c) => c.id)).toEqual(["v1", "local-import"]);
    expect(merged.orderedAudioClipIds).toEqual([]);
  });

  it("drops upstream audio when TTS disconnected", () => {
    const persisted = jianyingSnapshotToWorkbench(
      {
        videoClips: [{ sourceNodeId: "v1", videoUrl: "https://a.mp4" }],
        audioClips: [
          { sourceNodeId: "t1", videoUrl: "", audioUrl: "https://old-tts.mp3" },
        ],
      },
      null,
    );
    const merged = jianyingSnapshotToWorkbench(
      { videoClips: [{ sourceNodeId: "v1", videoUrl: "https://a.mp4" }], audioClips: [] },
      persisted,
    );
    expect(merged.orderedAudioClipIds).toEqual([]);
  });

  it("refreshes audio clip when upstream TTS URL changes", () => {
    const persisted = jianyingSnapshotToWorkbench(
      {
        videoClips: [{ sourceNodeId: "v1", videoUrl: "https://a.mp4" }],
        audioClips: [
          { sourceNodeId: "t1", videoUrl: "", audioUrl: "https://old-tts.mp3" },
        ],
      },
      null,
    );
    persisted.audioClips![0]!.durationSec = 1.2;
    persisted.audioClips![0]!.programStartSec = 0;

    const merged = jianyingSnapshotToWorkbench(
      {
        videoClips: [{ sourceNodeId: "v1", videoUrl: "https://a.mp4" }],
        audioClips: [
          { sourceNodeId: "t1", videoUrl: "", audioUrl: "https://new-tts.mp3" },
        ],
      },
      persisted,
    );
    expect(merged.audioClips?.[0]?.audioUrl).toBe("https://new-tts.mp3");
    expect(merged.audioClips?.[0]?.durationSec).toBeUndefined();
    expect(merged.audioClips?.[0]?.programStartSec).toBe(0);
  });

  it("refreshes audio clip when upstream media key changes with same URL", () => {
    const persisted = jianyingSnapshotToWorkbench(
      {
        videoClips: [{ sourceNodeId: "v1", videoUrl: "https://a.mp4" }],
        audioClips: [
          {
            sourceNodeId: "t1",
            videoUrl: "",
            audioUrl: "https://same-tts.mp3",
            audioMediaKey: "https://same-tts.mp3\0\0",
          },
        ],
      },
      null,
    );
    persisted.audioClips![0]!.durationSec = 1.2;

    const merged = jianyingSnapshotToWorkbench(
      {
        videoClips: [{ sourceNodeId: "v1", videoUrl: "https://a.mp4" }],
        audioClips: [
          {
            sourceNodeId: "t1",
            videoUrl: "",
            audioUrl: "https://same-tts.mp3",
            audioMediaKey: "https://same-tts.mp3\0blob:preview\0",
          },
        ],
      },
      persisted,
    );
    expect(merged.audioClips?.[0]?.audioUrl).toBe("https://same-tts.mp3");
    expect(merged.audioClips?.[0]?.durationSec).toBeUndefined();
  });

  it("exports frames with audio by parallel track index", () => {
    const frames = workbenchToJianyingExportFrames({
      orderedClipIds: ["n1"],
      clips: [
        {
          id: "n1",
          videoUrl: "https://cdn.example/v.mp4",
          subtitle: "hi",
          source: "external",
        },
      ],
      orderedAudioClipIds: ["t1"],
      audioClips: [
        {
          id: "t1",
          videoUrl: "",
          audioUrl: "https://cdn.example/a.mp3",
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
