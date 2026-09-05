import { describe, expect, it } from "vitest";

import {
  dedupeLibtvVoiceCatalogItems,
  libtvMinimaxVoiceSelectOptions,
} from "@/lib/canvas/libtv-minimax-voice-catalog-options";
import type { LibtvVoiceCatalogItem } from "@/lib/canvas/libtv-audio-voice-catalog-client";

const clone = (
  voiceId: string,
  catalogId: string,
  label: string,
): LibtvVoiceCatalogItem => ({
  catalogId,
  voiceId,
  label,
  subtitle: "克隆于 2026/7/3 18:32:15",
  tags: ["cloned"],
  avatarLetter: "欢",
});

describe("libtv minimax voice catalog", () => {
  it("dedupeLibtvVoiceCatalogItems keeps first voiceId (newest clone)", () => {
    expect(
      dedupeLibtvVoiceCatalogItems([
        clone("vid-a", "tpl-1", "欢迎回到《创意前沿》播客节目"),
        clone("vid-a", "tpl-2", "欢迎回到《创意前沿》播客节目"),
        clone("vid-b", "tpl-3", "另一条"),
      ]).map((v) => v.catalogId),
    ).toEqual(["tpl-1", "tpl-3"]);
  });

  it("libtvMinimaxVoiceSelectOptions does not append extra 克隆 tag", () => {
    expect(
      libtvMinimaxVoiceSelectOptions([
        clone("vid-a", "tpl-1", "欢迎回到《创意前沿》播客节目"),
      ])[0]?.subtitle,
    ).toBe("克隆于 2026/7/3 18:32:15");
  });
});
