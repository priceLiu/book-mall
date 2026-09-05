import { describe, expect, it } from "vitest";

import {
  pro2FixedBlock,
  pro2HubVisualStyleBlock,
  pro2VariableBlock,
  resolvePro2ScriptPromptFromBlocks,
} from "@/lib/canvas/pro2-prompt-template-types";
import {
  STORY_PRO2_CHARACTER_PROMPT,
  STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
} from "@/lib/canvas/story-pro2-theme-outline-prompt";
import {
  PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
  PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC,
  PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC,
} from "@/lib/canvas/data/pro2-production-pack-standard";

describe("seed-pro2-prompt-templates block shapes", () => {
  it("script templates use prompt_body block", () => {
    const outlineBlocks = [
      pro2FixedBlock("prompt_body", "Prompt 正文", STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT),
    ];
    expect(resolvePro2ScriptPromptFromBlocks(outlineBlocks)).toContain("JSON-only");
    const charBlocks = [
      pro2FixedBlock("prompt_body", "Prompt 正文", STORY_PRO2_CHARACTER_PROMPT),
    ];
    expect(resolvePro2ScriptPromptFromBlocks(charBlocks)).toContain("step=character");
  });

  it("asset templates include composition_spec and visual style slot", () => {
    for (const spec of [
      PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
      PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC,
      PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC,
    ]) {
      const blocks = [
        pro2VariableBlock("name", "名称"),
        pro2FixedBlock("composition_spec", "构图规范", spec),
        pro2HubVisualStyleBlock(),
      ];
      expect(blocks.some((b) => b.id === "composition_spec" && b.locked)).toBe(true);
      expect(blocks.some((b) => b.source === "hub_visual_style")).toBe(true);
    }
  });
});
