import { describe, expect, it } from "vitest";

import { z } from "zod";

import {
  ipMasterImagePromptSchema,
  ipMasterTemplateSchema,
  isIpMasterTemplateLibraryReady,
  normalizeIpMasterLlmDraft,
  parseIpMasterTemplateJson,
} from "@/lib/ecom/ecom-ip-master-template-schema";

const llmDraftSchema = z.object({
  imagePrompt: ipMasterImagePromptSchema,
  structuredTemplate: ipMasterTemplateSchema,
});

const sample = {
  imagePrompt: { positive: "Q版正面立绘", negative: "畸形" },
  ipMeta: {
    ipId: "p1",
    ipName: "波波仔",
    version: "V1.0",
    createTime: "2026-10-03",
    baseImageUrl: "https://example.com/a.png",
    styleSummary: "Q版",
  },
  rigidFeatures: [
    { featureName: "脸", description: "圆脸", weight: 0.95 },
  ],
  flexibleFeatures: [
    { featureName: "色彩方案", description: "主色 #FFD670" },
    { featureName: "具体形象", description: "Q版圆滚躯体" },
    { featureName: "五官细节", description: "大圆眼" },
    { featureName: "配饰与服装", description: "基础卫衣" },
    { featureName: "2D 表情包适配", description: "2px 线稿" },
    { featureName: "品牌 VI 延展", description: "扁平矢量" },
  ],
  softConstraint: "保持气质",
};

describe("ip master template schema", () => {
  it("parses valid template", () => {
    expect(parseIpMasterTemplateJson(sample)?.ipMeta.ipName).toBe("波波仔");
  });

  it("normalizes flat LLM JSON and string weights", () => {
    const normalized = normalizeIpMasterLlmDraft(
      {
        imagePrompt: { positive: "正面立绘", negative: null },
        ipMeta: { ipId: "", ipName: "波波仔", version: "V0.1", createTime: "2026-10-03" },
        rigidFeatures: [{ featureName: "脸", description: "圆脸", weight: "0.95" }],
        flexibleFeatures: [
          { featureName: "色彩方案", description: "主色 #AABBCC" },
          { featureName: "具体形象", description: "小动物" },
          { featureName: "五官细节", description: "微笑" },
          { featureName: "配饰与服装", description: "卫衣" },
          { featureName: "2D 表情包适配", description: "240px" },
          { featureName: "品牌 VI 延展", description: "线稿版" },
        ],
        softConstraint: "保持可爱",
      },
      { projectId: "proj-1" },
    );
    const parsed = llmDraftSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.structuredTemplate.ipMeta.ipId).toBe("proj-1");
      expect(parsed.data.structuredTemplate.rigidFeatures[0]?.weight).toBe(0.95);
    }
  });

  it("library ready needs image + template", () => {
    expect(
      isIpMasterTemplateLibraryReady({
        template: parseIpMasterTemplateJson(sample),
        hasBenchmarkImage: true,
      }),
    ).toBe(true);
    expect(
      isIpMasterTemplateLibraryReady({
        template: parseIpMasterTemplateJson(sample),
        hasBenchmarkImage: false,
      }),
    ).toBe(false);
  });
});
