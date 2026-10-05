import { describe, expect, it } from "vitest";

import {
  buildAudioTimelinePlacements,
  resolveAudioClipProgramStartSec,
  setComposeAudioProgramStart,
  toggleComposeAudioClipPlaybackMuted,
  toggleComposeClipSourceAudioMuted,
} from "../../platform-compose-ui/editing";
import type { ComposeWorkbenchState } from "../../platform-compose-ui/types";

function dualTrackState(): ComposeWorkbenchState {
  return {
    orderedClipIds: ["v1", "v2"],
    clips: [
      {
        id: "v1",
        videoUrl: "https://cdn.example/v1.mp4",
        source: "external",
        durationSec: 3,
      },
      {
        id: "v2",
        videoUrl: "https://cdn.example/v2.mp4",
        source: "external",
        durationSec: 4,
      },
    ],
    orderedAudioClipIds: ["a1", "a2"],
    audioClips: [
      {
        id: "a1",
        videoUrl: "",
        audioUrl: "https://cdn.example/a1.mp3",
        source: "external",
        durationSec: 2,
      },
      {
        id: "a2",
        videoUrl: "",
        audioUrl: "https://cdn.example/a2.mp3",
        source: "external",
        durationSec: 2,
      },
    ],
  };
}

describe("compose-audio-timeline", () => {
  it("defaults audio i to video segment i start", () => {
    const state = dualTrackState();
    expect(resolveAudioClipProgramStartSec(state, state.audioClips![0]!, 0)).toBe(
      0,
    );
    expect(resolveAudioClipProgramStartSec(state, state.audioClips![1]!, 1)).toBe(
      3,
    );
  });

  it("uses programStartSec when user moved clip", () => {
    let state = dualTrackState();
    state = setComposeAudioProgramStart(state, "a1", 1.5);
    expect(resolveAudioClipProgramStartSec(state, state.audioClips![0]!, 0)).toBe(
      1.5,
    );
  });

  it("buildAudioTimelinePlacements spans real duration", () => {
    const placements = buildAudioTimelinePlacements(dualTrackState());
    expect(placements[0]?.programStart).toBe(0);
    expect(placements[0]?.span).toBe(2);
    expect(placements[1]?.programStart).toBe(3);
  });

  it("toggles per-clip video source and TTS playback mute", () => {
    let state = dualTrackState();
    state = toggleComposeClipSourceAudioMuted(state, "v1");
    expect(state.clips.find((c) => c.id === "v1")?.sourceAudioMuted).toBe(true);
    state = toggleComposeAudioClipPlaybackMuted(state, "a2");
    expect(
      state.audioClips?.find((c) => c.id === "a2")?.audioPlaybackMuted,
    ).toBe(true);
  });
});
