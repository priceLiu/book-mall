import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  applyLibtvTtsVoicePreferenceToParams,
  resolveLibtvDockVoiceFullLabel,
  truncateLibtvDockVoiceLabel,
  writeLibtvTtsVoicePreference,
  readLibtvTtsVoicePreference,
} from "@/lib/canvas/libtv-tts-voice-preference";

describe("libtv-tts-voice-preference", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    vi.stubGlobal("localStorage", {
      getItem(key: string) {
        return store[key] ?? null;
      },
      setItem(key: string, value: string) {
        store[key] = value;
      },
      removeItem(key: string) {
        delete store[key];
      },
    });
  });

  it("truncateLibtvDockVoiceLabel caps long clone names", () => {
    const long = "欢迎回到《创意前沿》播客节目，在这里我们一同探寻";
    expect(truncateLibtvDockVoiceLabel(long, 12)).toBe("欢迎回到《创意前沿》播…");
  });

  it("resolveLibtvDockVoiceFullLabel prefers saved label", () => {
    expect(
      resolveLibtvDockVoiceFullLabel({
        voiceId: "clone-1",
        savedLabel: "我的旁白",
        catalogLabel: "ignored",
      }),
    ).toBe("我的旁白");
  });

  it("persists and applies minimax voice preference", () => {
    writeLibtvTtsVoicePreference("minimax", {
      voiceId: "male-qn-jingying",
      label: "精英青年音色",
    });
    expect(readLibtvTtsVoicePreference("minimax")).toMatchObject({
      voiceId: "male-qn-jingying",
    });
    const params = applyLibtvTtsVoicePreferenceToParams("MiniMax/speech-02-hd", {});
    expect(params).toMatchObject({
      voice_id: "male-qn-jingying",
      voice_label: "精英青年音色",
    });
  });
});
