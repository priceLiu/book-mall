import { describe, expect, it } from "vitest";

import { parseQrWorkspaceDraft } from "@/lib/quick-replica/parse-qr-workspace-draft";

describe("parseQrWorkspaceDraft", () => {
  it("保留 audio 音色与控制字段", () => {
    const draft = parseQrWorkspaceDraft({
      category: "audio",
      kind: "create-voiceover",
      prompt: "你好",
      modelKey: "MiniMax/speech-2.8-hd",
      voiceId: "qiaopi_mengmei",
      audioStyleTag: "ad-teaser",
      voiceSpeed: 1.1,
      voiceVolume: 0.9,
      voicePitch: 2,
    });
    expect(draft).toMatchObject({
      category: "audio",
      kind: "create-voiceover",
      voiceId: "qiaopi_mengmei",
      audioStyleTag: "ad-teaser",
      voiceSpeed: 1.1,
      voiceVolume: 0.9,
      voicePitch: 2,
    });
  });

  it("变声保留 sourceAudioUrl 与 voiceStability", () => {
    const draft = parseQrWorkspaceDraft({
      category: "audio",
      kind: "voice-changer",
      modelKey: "MiniMax/speech-2.8-hd",
      voiceId: "female-shaonv",
      sourceAudioUrl: "https://example.com/a.mp3",
      voiceStability: 0.6,
    });
    expect(draft).toMatchObject({
      kind: "voice-changer",
      voiceId: "female-shaonv",
      sourceAudioUrl: "https://example.com/a.mp3",
      voiceStability: 0.6,
    });
  });
});
