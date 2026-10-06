import { describe, expect, it } from "vitest";

import { defaultLibtvCloneVoiceDisplayName } from "@/lib/canvas/libtv-audio-voice-clone-defaults";

describe("defaultLibtvCloneVoiceDisplayName", () => {
  it("prefixes clone label and uses source title", () => {
    const name = defaultLibtvCloneVoiceDisplayName("分离音频");
    expect(name.startsWith("克隆·参考音频·")).toBe(true);
  });

  it("falls back when label empty", () => {
    const name = defaultLibtvCloneVoiceDisplayName("");
    expect(name.startsWith("克隆·参考音频·")).toBe(true);
  });
});
