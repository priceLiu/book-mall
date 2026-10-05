import { describe, expect, it } from "vitest";

import {
  composeWorkbenchProfileToRenderProfile,
  composeWorkbenchToRenderPayload,
  parsePlatformComposeWorkbenchFromMeta,
  platformWorkbenchToMediaTimeline,
} from "@/lib/media/platform-compose-workbench";

describe("platform-compose-workbench", () => {
  it("maps clip subtitle and trim to MediaTimelineV1", () => {
    const tl = platformWorkbenchToMediaTimeline({
      orderedClipIds: ["a"],
      clips: [
        {
          id: "a",
          videoUrl: "https://cdn.example/v.mp4",
          source: "look",
          sourceStartSec: 1,
          sourceEndSec: 4,
          subtitle: "hello",
        },
      ],
    });
    expect(tl.clips[0]?.subtitle).toBe("hello");
    expect(tl.clips[0]?.sourceStartSec).toBe(1);
    expect(tl.clips[0]?.sourceEndSec).toBe(4);
  });

  it("merges bgm preset into render profile", () => {
    const profile = composeWorkbenchProfileToRenderProfile(
      {
        transition: { type: "none" },
        subtitle: { mode: "script", burnIn: true },
        video: { scaleMode: "fit1080p" },
        audio: { bgmPresetId: "beat-1", mixTts: false },
      },
      {
        resolveBgmPresetUrl: (id) =>
          id === "beat-1" ? "https://cdn.example/bgm.mp3" : undefined,
      },
    );
    expect(profile.audio?.bgmUrl).toBe("https://cdn.example/bgm.mp3");
    expect(profile.subtitle.burnIn).toBe(true);
    expect(profile.subtitle.mode).toBe("script");
    expect(
      (profile.audio as { bgmPresetId?: string } | undefined)?.bgmPresetId,
    ).toBeUndefined();
  });

  it("parse meta round-trips bgmPresetId on profile", () => {
    const parsed = parsePlatformComposeWorkbenchFromMeta({
      orderedClipIds: ["x"],
      clips: [{ id: "x", videoUrl: "https://a/b.mp4", source: "import" }],
      profile: {
        subtitle: { mode: "asr", burnIn: true },
        audio: { bgmPresetId: "beat-2", mixTts: true, bgmVolume: 0.2 },
      },
    });
    expect(parsed?.profile?.audio?.bgmPresetId).toBe("beat-2");
    expect(parsed?.profile?.subtitle.mode).toBe("asr");
  });

  it("pairs dual-track audio by user order index", () => {
    const tl = platformWorkbenchToMediaTimeline({
      orderedClipIds: ["v1", "v2"],
      clips: [
        { id: "v1", videoUrl: "https://cdn.example/v1.mp4", source: "look" },
        { id: "v2", videoUrl: "https://cdn.example/v2.mp4", source: "look" },
      ],
      orderedAudioClipIds: ["a2", "a1"],
      audioClips: [
        { id: "a1", audioUrl: "https://cdn.example/a1.mp3", source: "external" },
        { id: "a2", audioUrl: "https://cdn.example/a2.mp3", source: "external" },
      ],
    });
    expect(tl.clips[0]?.audioUrl).toBe("https://cdn.example/a2.mp3");
    expect(tl.clips[1]?.audioUrl).toBe("https://cdn.example/a1.mp3");
  });

  it("composeWorkbenchToRenderPayload uses fallback preset", () => {
    const { profile } = composeWorkbenchToRenderPayload(
      { orderedClipIds: ["x"], clips: [{ id: "x", videoUrl: "https://a/b.mp4", source: "look" }] },
      {
        fallbackBgmPresetId: "beat-1",
        resolveBgmPresetUrl: () => "https://cdn.example/fallback.mp3",
      },
    );
    expect(profile.audio?.bgmUrl).toBe("https://cdn.example/fallback.mp3");
  });
});
