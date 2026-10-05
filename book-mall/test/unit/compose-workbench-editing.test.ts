import { describe, expect, it } from "vitest";

import {
  moveComposeClip,
  splitComposeClipAtSourceSec,
  updateComposeClip,
} from "@/lib/media/compose-workbench-editing";
import type { PlatformComposeWorkbenchState } from "@/lib/media/platform-compose-workbench";

const baseState = (): PlatformComposeWorkbenchState => ({
  orderedClipIds: ["c1"],
  clips: [
    {
      id: "c1",
      videoUrl: "https://cdn.example/v.mp4",
      source: "look",
    },
  ],
});

describe("compose-workbench-editing", () => {
  it("reorders clips", () => {
    const s: PlatformComposeWorkbenchState = {
      orderedClipIds: ["a", "b"],
      clips: [
        { id: "a", videoUrl: "https://a.mp4", source: "look" },
        { id: "b", videoUrl: "https://b.mp4", source: "look" },
      ],
    };
    const next = moveComposeClip(s, 0, 1);
    expect(next.orderedClipIds).toEqual(["b", "a"]);
  });

  it("splits clip at source time", () => {
    const next = splitComposeClipAtSourceSec(baseState(), "c1", 3, 10);
    expect(next.orderedClipIds).toHaveLength(2);
    expect(next.clips).toHaveLength(2);
  });

  it("patches clip audioUrl", () => {
    const next = updateComposeClip(baseState(), "c1", {
      audioUrl: "https://cdn.example/tts.mp3",
    });
    expect(next.clips[0]?.audioUrl).toBe("https://cdn.example/tts.mp3");
  });
});
