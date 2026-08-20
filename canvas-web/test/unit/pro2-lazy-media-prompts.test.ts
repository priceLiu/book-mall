import { describe, expect, it } from "vitest";
import {
  applyPro2CharacterMediaPromptsForKeys,
  applyPro2FrameMediaPromptsForIndices,
  commitPro2ThreeViewRowPromptFromDock,
} from "@/lib/canvas/pro2-lazy-media-prompts";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
} from "@/lib/canvas/story-pro-workspace-types";

describe("pro2 lazy media prompts", () => {
  it("commitPro2ThreeViewRowPromptFromDock writes prompt to matching row", () => {
    const updates: Array<[string, Record<string, unknown>]> = [];
    const nodes = [
      {
        id: "col",
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: {
          rows: [
            {
              key: "hero",
              name: "主角",
              role: "主角",
              appearance: "红袍",
              prompt: "旧 prompt",
            },
          ],
        },
      },
    ];
    const ok = commitPro2ThreeViewRowPromptFromDock(
      "col",
      "hero",
      "用户改过的 prompt",
      nodes,
      (id, patch) => updates.push([id, patch]),
    );
    expect(ok).toBe(true);
    expect(updates[0]?.[1].rows).toEqual([
      expect.objectContaining({ key: "hero", prompt: "用户改过的 prompt" }),
    ]);
  });

  it("applyPro2FrameMediaPromptsForIndices does not append script hub dock text by default", () => {
    const rows: StoryProFrameRow[] = [
      {
        key: "f1",
        frameIndex: 1,
        shotSize: "近景",
        aiImagePrompt: "现代深夜办公室近景，2K",
      },
    ];
    const out = applyPro2FrameMediaPromptsForIndices(rows, [1]);
    expect(out[0]?.prompt).toBe("景别：近景\n现代深夜办公室近景，2K");
    expect(out[0]?.prompt).not.toContain("用户补充");
  });

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
    const out = applyPro2CharacterMediaPromptsForKeys(
      rows,
      ["b"],
      {
        era: "架空唐代",
        visualStyle: "国风二次元厚涂，2D动漫媒介",
      },
    );
    expect(out[0]?.prompt?.trim() || "").toBe("");
    expect(out[1]?.prompt).toContain("名称：乙，配角");
    expect(out[1]?.prompt).toContain("[视觉风格：");
  });
});
