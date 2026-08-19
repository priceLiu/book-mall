import { describe, expect, it } from "vitest";

import {
  normalizePro2NegativePrompt,
  normalizePro2ProductionScriptPatchChinese,
  normalizePro2VideoPromptChinese,
  pro2TextHasUnwantedLatin,
  resolvePro2PropIdToName,
  stripPro2AnchorPlaceholders,
} from "@/lib/canvas/pro2-chinese-prompt-normalize";

describe("pro2-chinese-prompt-normalize", () => {
  it("converts [Negative: blurry, anime] to Chinese", () => {
    expect(normalizePro2NegativePrompt("[Negative: blurry, anime]")).toBe(
      "模糊、动漫风",
    );
  });

  it("detects English in negative prompt", () => {
    expect(pro2TextHasUnwantedLatin("[Negative: blurry, anime]")).toBe(true);
    expect(pro2TextHasUnwantedLatin("动画风、水印")).toBe(false);
  });

  it("normalizes video prompt trailing Negative tag", () => {
    const out = normalizePro2VideoPromptChinese(
      "镜头推近 <<<scene_A>>> [Negative: anime, watermark]",
    );
    expect(out).toContain("【反向】");
    expect(out).not.toContain("[Negative:");
    expect(out).toContain("动漫风");
  });

  it("normalizes scenes negativePrompt in patch", () => {
    const out = normalizePro2ProductionScriptPatchChinese({
      schemaVersion: 1,
      tier: "pro",
      step: "scene",
      patch: {
        scenes: [
          {
            id: "s1",
            name: "测试",
            environmentTimeMood: "日内",
            imagePrompt: "空镜",
            negativePrompt: "[Negative: blurry, anime]",
          },
        ],
      },
    });
    expect(out.patch?.scenes?.[0]?.negativePrompt).toBe("模糊、动漫风");
  });

  it("strips <<<char_*>>> / <<<prop_*>>> placeholders from patch fields", () => {
    const out = normalizePro2ProductionScriptPatchChinese({
      schemaVersion: 2,
      tier: "pro",
      step: "full_pack",
      patch: {
        characters: [
          {
            id: "c1",
            name: "`<<<char_shenzhaozhao>>>` 沈昭昭",
            role: "现代职场女性",
            appearance: "女",
            imagePrompt: "测试",
          },
        ],
        props: [{ id: "prop-computer", name: "电脑", description: "显示器" }],
        shots: [
          {
            index: 1,
            shotSize: "特写",
            lighting: "冷蓝",
            cameraMove: "固定机位，镜头平稳推进，画面稳定",
            sceneDescription: "打字",
            propIds: ["<<<prop_computer>>>"],
            dialogue: "—",
            durationSec: 5,
            sfxNote: "—",
            audioNote: "—",
          },
        ],
      },
    });
    expect(out.patch?.characters?.[0]?.name).toBe("沈昭昭");
    expect(out.patch?.shots?.[0]?.propIds).toEqual(["prop-computer"]);
    expect(
      resolvePro2PropIdToName("<<<prop_computer>>>", {
        schemaVersion: 2,
        props: out.patch?.props,
        shots: out.patch?.shots,
      }),
    ).toBe("电脑");
  });

  it("stripPro2AnchorPlaceholders removes tagged prefixes", () => {
    expect(stripPro2AnchorPlaceholders("<<<scene_A>>> 现代办公室")).toBe(
      "现代办公室",
    );
    expect(stripPro2AnchorPlaceholders("<<<prop_throne>>>")).toBe("");
  });
});
