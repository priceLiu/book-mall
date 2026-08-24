import { describe, expect, it } from "vitest";
import {
  buildPro2StructuredRetryUserMessage,
  ensurePro2ProductionScriptFence,
  isPro2StructuredLlmScope,
  mergePro2StructuredLlmParams,
  PRO2_STRUCTURED_LLM_MAX_ATTEMPTS,
  validatePro2ProductionScriptLlmOutput,
} from "@/lib/canvas/pro2-production-script-llm";

const VIS = "[视觉风格：电影级写实]";
const COMP = "构图规范：四视图设定图";

const FULL_PACK_FIXTURE = {
  schemaVersion: 2,
  tier: "pro",
  step: "full_pack",
  patch: {
    meta: { title: "测试", synopsis: "测试" },
    visualStyle: {
      worldBackground: "测试背景",
      era: "现代",
      globalColorTone: "暖色",
      pictureStyle: "写实",
      cinematography: "35mm",
      dayPalette: { primary: "#fff" },
      nightPalette: { primary: "#000" },
      lighting: "自然光",
      styleAnchor: "写实",
    },
    coreConflict: [{ dimension: "冲突", content: "内容" }],
    scenes: [
      {
        id: "s1",
        name: "场景A",
        environmentTimeMood: "日内",
        imagePrompt: `名称：场景A\n描述：空镜\n${COMP}\n${VIS}`,
        negativePrompt: "动画风",
      },
    ],
    characters: [
      {
        id: "c1",
        name: "小明",
        role: "主角",
        appearance: "① 外貌：女，28岁\n② 服装：白T恤\n③ 特征：①杏眼 ②短发 ③偏瘦",
        traits: "①杏眼 ②短发 ③偏瘦",
        imagePrompt: `名称：小明\n描述：女，28岁\n服装：白T恤\n特征：①杏眼 ②短发 ③偏瘦\n${COMP}\n${VIS}`,
      },
    ],
    props: [{ id: "p1", name: "道具A", description: "测试道具" }],
    shots: [
      {
        index: 1,
        shotSize: "中景",
        sceneDescription: "【起始】开场【结束】结束",
        dialogue: "—",
        durationSec: 10,
        lighting: "场景A，自然光，日内氛围与画面描述一致",
        cameraMove: "固定机位，镜头平稳推进，画面稳定",
        sfxNote: "—",
        audioNote: "—",
        sceneId: "s1",
      },
    ],
    handoff: [
      { index: 1, item: "三视图", owner: "美术", note: "—" },
      { index: 2, item: "场景", owner: "美术", note: "—" },
      { index: 3, item: "分镜", owner: "导演", note: "—" },
      { index: 4, item: "配音", owner: "声音", note: "—" },
      { index: 5, item: "BGM", owner: "声音", note: "—" },
      { index: 6, item: "剪辑", owner: "剪辑", note: "—" },
    ],
  },
};

const FIXTURE = FULL_PACK_FIXTURE;

describe("pro2-production-script-llm", () => {
  it("isPro2StructuredLlmScope for hub sections", () => {
    expect(isPro2StructuredLlmScope({ llmSection: "outline" })).toBe(true);
    expect(isPro2StructuredLlmScope({ llmSection: "themeOutline" })).toBe(
      false,
    );
  });

  it("mergePro2StructuredLlmParams strips json_object (JSON-only v13 uses fence)", () => {
    const merged = mergePro2StructuredLlmParams({
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    expect(merged.response_format).toBeUndefined();
    expect(merged.temperature).toBe(0.7);
  });

  it("validatePro2ProductionScriptLlmOutput accepts fenced JSON", () => {
    const text = `\`\`\`pro2-production-script\n${JSON.stringify(FIXTURE)}\n\`\`\``;
    const v = validatePro2ProductionScriptLlmOutput(text, {
      llmSection: "outline",
    });
    expect(v.ok).toBe(true);
    expect(v.patch?.step).toBe("full_pack");
  });

  it("validate rejects step mismatch", () => {
    const characterOnly = {
      ...FULL_PACK_FIXTURE,
      step: "character",
    };
    const text = `\`\`\`pro2-production-script\n${JSON.stringify(characterOnly)}\n\`\`\``;
    const v = validatePro2ProductionScriptLlmOutput(text, {
      llmSection: "outline",
    });
    expect(v.ok).toBe(false);
  });

  it("ensurePro2ProductionScriptFence wraps bare JSON", () => {
    const raw = JSON.stringify(FIXTURE);
    const out = ensurePro2ProductionScriptFence(raw);
    expect(out).toContain("```pro2-production-script");
  });

  it("validate rejects English negativePrompt", () => {
    const bad = {
      ...FIXTURE,
      patch: {
        ...FIXTURE.patch,
        scenes: [
          {
            ...FIXTURE.patch.scenes[0],
            negativePrompt: "[Negative: blurry, anime]",
          },
        ],
      },
    };
    const text = `\`\`\`pro2-production-script\n${JSON.stringify(bad)}\n\`\`\``;
    const v = validatePro2ProductionScriptLlmOutput(text, {
      llmSection: "outline",
    });
    expect(v.ok).toBe(false);
    expect(v.error).toContain("negativePrompt");
  });

  it("validate accepts characters with traits after parse coerce", () => {
    const withCharacter = {
      schemaVersion: 2,
      tier: "pro",
      step: "character",
      patch: {
        characters: [
          {
            name: "小明",
            identity: "主角",
            description: "年轻男性",
            clothing: "白T恤",
            traits: "①左眉有疤 ②目光坚定 ③下颌线清晰",
            imagePrompt:
              "名称：小明\n描述：年轻男性\n服装：白T恤\n特征：①左眉有疤 ②目光坚定 ③下颌线清晰\n构图规范：四视图\n[视觉风格：测试]",
          },
        ],
      },
    };
    const text = `\`\`\`pro2-production-script\n${JSON.stringify(withCharacter)}\n\`\`\``;
    const v = validatePro2ProductionScriptLlmOutput(text, {
      llmSection: "character",
    });
    expect(v.ok, v.error).toBe(true);
    expect(v.patch?.patch.characters?.[0]?.traits).toContain("左眉有疤");
    expect(v.patch?.patch.characters?.[0]?.appearance).toContain("③ 特征");
    expect(v.patch?.patch.characters?.[0]?.imagePrompt).toContain("特征：");
    expect(v.patch?.patch.characters?.[0]?.imagePrompt).not.toContain("Naive");
  });

  it("validate rejects Hub outline when step is not full_pack", () => {
    const partial = {
      ...FIXTURE,
      step: "outline",
      patch: {
        ...FIXTURE.patch,
        shots: [],
      },
    };
    const text = `\`\`\`pro2-production-script\n${JSON.stringify(partial)}\n\`\`\``;
    const v = validatePro2ProductionScriptLlmOutput(text, {
      llmSection: "outline",
    });
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/full_pack|shots/);
  });

  it("buildPro2StructuredRetryUserMessage includes error", () => {
    const msg = buildPro2StructuredRetryUserMessage("缺少 shots");
    expect(msg).toContain("缺少 shots");
    expect(msg).toContain("重试");
  });

  it("buildPro2StructuredRetryUserMessage includes attempt budget", () => {
    const msg = buildPro2StructuredRetryUserMessage("缺少 frameImagePrompt", 2);
    expect(msg).toContain(`第 3 次`);
    expect(msg).toContain(String(PRO2_STRUCTURED_LLM_MAX_ATTEMPTS));
  });

  it("shot_prompts frame mode passes validation with polishMode", () => {
    const patch = {
      schemaVersion: 2,
      tier: "pro",
      step: "shot_prompts",
      patch: {
        shots: [{ index: 1, frameImagePrompt: "特写，雨夜街头，角色回眸" }],
      },
    };
    const text = `\`\`\`pro2-production-script\n${JSON.stringify(patch)}\n\`\`\``;
    const v = validatePro2ProductionScriptLlmOutput(text, {
      llmSection: "shot_prompts",
      polishMode: "frame",
      rowKey: "1",
    });
    expect(v.ok, v.error).toBe(true);
  });
});
