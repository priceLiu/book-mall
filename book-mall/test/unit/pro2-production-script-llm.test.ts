import { describe, expect, it } from "vitest";
import {
  buildPro2StructuredRetryUserMessage,
  ensurePro2ProductionScriptFence,
  isPro2StructuredLlmScope,
  mergePro2StructuredLlmParams,
  validatePro2ProductionScriptLlmOutput,
} from "@/lib/canvas/pro2-production-script-llm";

const FIXTURE = {
  schemaVersion: 1,
  tier: "pro",
  step: "outline",
  patch: {
    visualStyle: {
      worldBackground: "测试背景",
      era: "现代",
    },
    coreConflict: [{ dimension: "冲突", content: "内容" }],
    scenes: [
      {
        id: "s1",
        name: "场景A",
        environmentTimeMood: "日内",
        imagePrompt: "空镜",
        negativePrompt: "anime",
      },
    ],
    handoff: [{ index: 1, item: "三视图", owner: "美术", note: "—" }],
  },
};

describe("pro2-production-script-llm", () => {
  it("isPro2StructuredLlmScope for hub sections", () => {
    expect(isPro2StructuredLlmScope({ llmSection: "outline" })).toBe(true);
    expect(isPro2StructuredLlmScope({ llmSection: "themeOutline" })).toBe(
      false,
    );
  });

  it("mergePro2StructuredLlmParams adds json_object response_format", () => {
    const merged = mergePro2StructuredLlmParams({ temperature: 0.7 });
    expect(merged.response_format).toEqual({ type: "json_object" });
    expect(merged.temperature).toBe(0.7);
  });

  it("validatePro2ProductionScriptLlmOutput accepts fenced JSON", () => {
    const text = `\`\`\`pro2-production-script\n${JSON.stringify(FIXTURE)}\n\`\`\``;
    const v = validatePro2ProductionScriptLlmOutput(text, {
      llmSection: "outline",
    });
    expect(v.ok).toBe(true);
    expect(v.patch?.step).toBe("outline");
  });

  it("validate rejects step mismatch", () => {
    const text = `\`\`\`pro2-production-script\n${JSON.stringify(FIXTURE)}\n\`\`\``;
    const v = validatePro2ProductionScriptLlmOutput(text, {
      llmSection: "storyboard",
    });
    expect(v.ok).toBe(false);
  });

  it("ensurePro2ProductionScriptFence wraps bare JSON", () => {
    const raw = JSON.stringify(FIXTURE);
    const out = ensurePro2ProductionScriptFence(raw);
    expect(out).toContain("```pro2-production-script");
  });

  it("buildPro2StructuredRetryUserMessage includes error", () => {
    const msg = buildPro2StructuredRetryUserMessage("缺少 shots");
    expect(msg).toContain("缺少 shots");
    expect(msg).toContain("重试");
  });
});
