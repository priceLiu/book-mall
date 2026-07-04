import { describe, expect, it } from "vitest";

import {
  isMinimaxMusicModelKey,
  isMinimaxSpeechModelKey,
  resolveMinimaxUpstreamSpeechModel,
} from "@/lib/gateway/minimax-speech-models";
import {
  getMinimaxVoicePage,
  parseMinimaxMdVoiceTable,
} from "@/lib/quick-replica/minimax-voice-catalog";

describe("minimax-speech-models", () => {
  it("routes speech model keys", () => {
    expect(isMinimaxSpeechModelKey("MiniMax/speech-2.8-hd")).toBe(true);
    expect(isMinimaxSpeechModelKey("minimax_speech_02")).toBe(true);
    expect(isMinimaxMusicModelKey("MiniMax/music-1.5")).toBe(true);
  });

  it("resolves upstream speech model", () => {
    expect(resolveMinimaxUpstreamSpeechModel("MiniMax/speech-02-hd")).toBe("speech-02-hd");
    expect(resolveMinimaxUpstreamSpeechModel("MiniMax/speech-2.6-hd")).toBe("speech-2.6-hd");
    expect(resolveMinimaxUpstreamSpeechModel("minimax_speech_02")).toBe("speech-02-hd");
  });
});

describe("minimax-voice-catalog", () => {
  it("parses markdown voice table rows", () => {
    const md = `
| 1 | 中文 (普通话) | \`male-qn-qingse\` | 青涩青年音色 |
| 2 | English | \`English_narrator\` | Narrator |
`;
    const voices = parseMinimaxMdVoiceTable(md);
    expect(voices).toHaveLength(2);
    expect(voices[0]?.voiceId).toBe("male-qn-qingse");
    expect(voices[1]?.language).toContain("English");
  });

  it("paginates voice manifest", () => {
    const page = getMinimaxVoicePage({ page: 1, pageSize: 2 });
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(2);
    expect(page.items.length).toBeLessThanOrEqual(2);
    expect(page.total).toBeGreaterThan(0);
  });
});
