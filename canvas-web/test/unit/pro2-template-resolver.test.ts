import { describe, expect, it, beforeEach } from "vitest";

import {
  PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import {
  pro2FixedBlock,
  pro2HubVisualStyleBlock,
  pro2VariableBlock,
  renderPro2AssetDockPromptFromBlocks,
  resolvePro2AssetCompositionFromBlocks,
  resolvePro2ScriptPromptFromBlocks,
} from "@/lib/canvas/pro2-prompt-template-types";
import {
  clearPro2TemplateResolverCache,
  getActiveAssetCompositionSpecSync,
  getPro2HubPromptPackFromSyncCache,
  resolvePro2AssetCompositionSpecSync,
} from "@/lib/canvas/pro2-template-resolver";

describe("pro2-prompt-template-types", () => {
  it("resolves script prompt from prompt_body block", () => {
    const blocks = [pro2FixedBlock("prompt_body", "正文", "hello world")];
    expect(resolvePro2ScriptPromptFromBlocks(blocks)).toBe("hello world");
  });

  it("extracts composition_spec from asset blocks", () => {
    const spec = "四视图规范";
    const blocks = [
      pro2VariableBlock("name", "名称"),
      pro2FixedBlock("composition_spec", "构图规范", spec),
      pro2HubVisualStyleBlock(),
    ];
    expect(resolvePro2AssetCompositionFromBlocks(blocks)).toBe(spec);
  });

  it("renders asset dock prompt with slots and visual style", () => {
    const blocks = [
      pro2VariableBlock("name", "名称"),
      pro2FixedBlock("composition_spec", "构图规范", "SPEC"),
      pro2HubVisualStyleBlock(),
    ];
    const out = renderPro2AssetDockPromptFromBlocks(
      blocks,
      { name: "测试角色" },
      "[视觉风格：测试]",
    );
    expect(out).toContain("名称：测试角色");
    expect(out).toContain("构图规范：SPEC");
    expect(out).toContain("[视觉风格：测试]");
  });
});

describe("pro2-template-resolver sync cache", () => {
  beforeEach(() => {
    clearPro2TemplateResolverCache();
  });

  it("falls back to TS golden composition spec", () => {
    expect(getActiveAssetCompositionSpecSync("CHARACTER_FOUR_VIEW")).toBe(
      PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
    );
    expect(resolvePro2AssetCompositionSpecSync("CHARACTER_FOUR_VIEW")).toBe(
      PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
    );
  });

  it("returns undefined hub pack before cache warm", () => {
    expect(getPro2HubPromptPackFromSyncCache({ scriptCategoryId: "default-master" })).toBe(
      undefined,
    );
  });
});
