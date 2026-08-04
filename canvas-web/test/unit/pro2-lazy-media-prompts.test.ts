import { describe, expect, it } from "vitest";
import { applyPro2CharacterMediaPromptsForKeys } from "@/lib/canvas/pro2-lazy-media-prompts";
import type { StoryProCharacterRow } from "@/lib/canvas/story-pro-workspace-types";

describe("pro2 lazy media prompts", () => {
  it("applyPro2CharacterMediaPromptsForKeys only builds selected rows", () => {
    const rows: StoryProCharacterRow[] = [
      {
        key: "a",
        name: "甲",
        role: "主角",
        appearance: "红袍",
        prompt: "",
      },
      {
        key: "b",
        name: "乙",
        role: "配角",
        appearance: "蓝衣",
        prompt: "",
      },
    ];
    const out = applyPro2CharacterMediaPromptsForKeys(rows, ["b"]);
    expect(out[0]?.prompt?.trim() || "").toBe("");
    expect(out[1]?.prompt).toContain("乙");
    expect(out[1]?.prompt).toContain("【三视图 · 系统约束】");
  });
});
