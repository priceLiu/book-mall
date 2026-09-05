import { describe, expect, it } from "vitest";

import {
  LIBTV_TTS_AUDITION_HISTORY_MAX,
  upsertLibtvTtsAuditionHistory,
  type LibtvTtsAuditionHistoryItem,
} from "@/lib/canvas/libtv-tts-audition-history";

function item(
  voiceId: string,
  extra?: Partial<LibtvTtsAuditionHistoryItem>,
): LibtvTtsAuditionHistoryItem {
  return {
    voiceId,
    label: voiceId,
    dataUrl: `data:audio/mpeg;base64,${voiceId}`,
    ...extra,
  };
}

describe("upsertLibtvTtsAuditionHistory", () => {
  it("puts a new audition at the top", () => {
    const next = upsertLibtvTtsAuditionHistory([item("a")], item("b"));
    expect(next.map((row) => row.voiceId)).toEqual(["b", "a"]);
  });

  it("moves the same voiceId to the top and replaces the clip", () => {
    const next = upsertLibtvTtsAuditionHistory(
      [item("a"), item("b")],
      item("b", { dataUrl: "data:audio/mpeg;base64,newer" }),
    );
    expect(next).toHaveLength(2);
    expect(next[0]?.voiceId).toBe("b");
    expect(next[0]?.dataUrl).toBe("data:audio/mpeg;base64,newer");
  });

  it("caps the list", () => {
    const prev = Array.from({ length: LIBTV_TTS_AUDITION_HISTORY_MAX }, (_, i) =>
      item(`v${i}`),
    );
    const next = upsertLibtvTtsAuditionHistory(prev, item("fresh"));
    expect(next).toHaveLength(LIBTV_TTS_AUDITION_HISTORY_MAX);
    expect(next[0]?.voiceId).toBe("fresh");
    expect(next.some((row) => row.voiceId === "v7")).toBe(false);
  });
});
