import { describe, expect, it } from "vitest";

import {
  extractStoryboardDeliverable,
  isStoryboardDeliverableV2,
  schemeToSheet,
  storyboardDeliverableSchema,
} from "@/lib/ecom/ecom-storyboard-deliverable";
import { renderDeliverableMarkdown } from "@/lib/ecom/ecom-storyboard-deliverable-render";

const V2_FIXTURE = {
  productName: "灰紫冲锋衣",
  productSellingPoints: [
    { id: "sp1", text: "暴雨袖口水珠滚落", source: "inferred" as const },
  ],
  creativeBrief: {
    audienceHook: "通勤族",
    viralStructure: "痛点→证明→促单",
    scenarioExpansion: "城市通勤遇雨",
  },
  cast: [{ name: "小雅", role: "主角", appearance: "26岁女生，齐肩黑发" }],
  analysis: {
    audience: [{ segment: "核心人群A", description: "25-35通勤族" }],
    painPoints: [{ level: "功能痛点", description: "普通外套不防雨" }],
    strategies: [
      {
        name: "救场型",
        hook3s: "突降暴雨",
        middle: "拉拉链展示防水",
        closing: "链接在下方",
      },
    ],
  },
  schemes: [
    {
      id: "scheme-1",
      title: "方案一：痛点救场型",
      summary: "暴雨救场",
      panels: [
        {
          index: 1,
          timeline: "0-3s",
          shotType: "中景",
          camera: "固定",
          scene: "户外街头突降小雨",
          action: "抱臂缩肩，表情焦急",
          emotion: "焦虑",
          dialogue: "完了要淋湿了",
          durationHintSec: 3,
          productInteraction: "none" as const,
          productVisibility: "off" as const,
          sellpointTags: [],
          imagePrompt:
            "竖版9:16，写实UGC。户外街头小雨，女生抱臂焦急，无产品露出。禁止画面文字。",
        },
        {
          index: 2,
          timeline: "3-8s",
          shotType: "中景",
          camera: "固定",
          scene: "街边",
          action: "穿上灰紫冲锋衣，拉拉链",
          emotion: "如释重负",
          dialogue: "这件真的防雨",
          durationHintSec: 5,
          productInteraction: "wear" as const,
          productVisibility: "hero" as const,
          sellpointTags: ["sp1"],
          imagePrompt:
            "竖版9:16，写实UGC。女生穿灰紫冲锋衣拉拉链，以参考图1为准。本镜卖点：袖口水珠滚落。禁止画面文字。",
        },
      ],
      totalDurationHintSec: 8,
    },
  ],
};

describe("storyboardDeliverable v2 schema", () => {
  it("parses v2 fixture", () => {
    const result = storyboardDeliverableSchema.safeParse(V2_FIXTURE);
    expect(result.success).toBe(true);
    expect(isStoryboardDeliverableV2(V2_FIXTURE)).toBe(true);
  });

  it("round-trips through extractStoryboardDeliverable fence", () => {
    const fenced = `\`\`\`storyboard-deliverable\n${JSON.stringify(V2_FIXTURE)}\n\`\`\``;
    const parsed = extractStoryboardDeliverable(fenced);
    expect(parsed?.productName).toBe("灰紫冲锋衣");
    expect(parsed?.schemes?.[0]?.panels[1]?.imagePrompt).toContain("参考图1");
  });

  it("schemeToSheet preserves imagePrompt and interaction", () => {
    const sheet = schemeToSheet(V2_FIXTURE.schemes[0]!, V2_FIXTURE);
    expect(sheet.panels[1]?.imagePrompt).toContain("参考图1");
    expect(sheet.panels[1]?.productInteraction).toBe("wear");
    expect(sheet.panels[1]?.sellpointTags).toEqual(["sp1"]);
  });

  it("renderDeliverableMarkdown includes structured tables", () => {
    const md = renderDeliverableMarkdown(V2_FIXTURE);
    expect(md).toContain("表1 · 目标人群精准画像");
    expect(md).toContain("产品交互");
    expect(md).toContain("暴雨袖口水珠滚落");
  });

  it("simulates chat route: extract + render cache matches deliverable", () => {
    const assistantReply = [
      "已为灰紫冲锋衣生成三套方案摘要…",
      "",
      "```storyboard-deliverable",
      JSON.stringify(V2_FIXTURE),
      "```",
    ].join("\n");
    const parsed = extractStoryboardDeliverable(assistantReply);
    expect(parsed?.schemes?.length).toBe(1);
    const cache = renderDeliverableMarkdown(parsed!, {
      schemeIndex: 0,
      includeAllSchemes: true,
    });
    expect(cache).toContain("方案一：痛点救场型");
    expect(cache).toContain("穿戴");
    const sheet = schemeToSheet(parsed!.schemes![0]!, parsed!);
    expect(sheet.panels[1]?.imagePrompt).toContain("参考图1");
  });
});

describe("bare JSON deliverable", () => {
  it("parses bare JSON without fence", () => {
    const bare = JSON.stringify(V2_FIXTURE);
    const parsed = extractStoryboardDeliverable(bare);
    expect(parsed?.productName).toBe("灰紫冲锋衣");
  });

  it("coerces numeric timeline to string", () => {
    const raw = {
      ...V2_FIXTURE,
      schemes: [
        {
          ...V2_FIXTURE.schemes[0],
          panels: [
            {
              ...V2_FIXTURE.schemes[0]!.panels[0],
              timeline: { start: 0, end: 2.5 },
            },
          ],
        },
      ],
    };
    const parsed = extractStoryboardDeliverable(JSON.stringify(raw));
    expect(parsed?.schemes?.[0]?.panels[0]?.timeline).toBe("0-2.5s");
    const md = renderDeliverableMarkdown(parsed!);
    expect(md).toContain("0-2.5s");
  });
});

describe("legacy deliverable", () => {
  it("still parses v0.1 analysis markdown", () => {
    const legacy = {
      productName: "测试产品",
      analysis: {
        audienceMarkdown: "| 人群 | 描述 |\n| A | B |",
        painPointsMarkdown: "| 层级 | 描述 |",
        strategiesMarkdown: "| 策略 | 钩子 | 中段 | 结尾 |",
      },
      schemes: [
        {
          id: "s1",
          title: "方案一",
          panels: [
            {
              index: 1,
              shotType: "中景",
              scene: "厨房",
              action: "擦台面",
            },
          ],
        },
      ],
    };
    const result = storyboardDeliverableSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    expect(isStoryboardDeliverableV2(legacy)).toBe(false);
  });
});
