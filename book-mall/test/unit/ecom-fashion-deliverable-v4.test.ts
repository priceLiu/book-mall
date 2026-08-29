import { describe, expect, it } from "vitest";

import {
  extractFashionDeliverable,
  fashionDeliverableSchema,
  fashionVersionToSheet,
  FASHION_SCHEMA_VERSION,
  inferFashionPhaseFromDeliverable,
  mergeFashionDeliverablePatch,
  resolveFashionDeliverableForProject,
} from "@/lib/ecom/ecom-fashion-deliverable";
import { renderFashionDeliverableMarkdown } from "@/lib/ecom/ecom-fashion-deliverable-render";

const PANEL_FIXTURE = (index: number) => ({
  index: index as 1 | 2 | 3 | 4 | 5 | 6,
  shotScale: "中景",
  durationSec: 4,
  cameraMove: "固定",
  sceneDesc: "都市通勤街头清晨",
  modelAction: "整理衣领转身",
  garmentFocus: "腰线与垂坠感",
  dialogue: "通勤一件搞定",
  toneTexture: "冷调高级质感",
  sellpointIds: ["S01"],
  imagePrompt:
    "竖版9:16，写实UGC。都市通勤，女生整理衣领，以参考图1为准。禁止画面文字。",
});

const V4_FIXTURE = {
  schemaVersion: FASHION_SCHEMA_VERSION,
  vertical: "fashion_apparel" as const,
  productName: "灰紫针织连衣裙",
  dimensions: {
    genderCategory: "女装" as const,
    styleCategory: "连衣裙",
    styleAttribute: "职场办公" as const,
    tier: "中端质感" as const,
    customScene: "都市通勤",
    platform: "抖音" as const,
    outputLanguage: "中文" as const,
  },
  sellpoints: [
    { id: "S01", text: "垂坠不皱", layer: "core" as const, source: "ai" as const },
    { id: "S02", text: "腰线修饰", layer: "visual" as const, source: "ai" as const },
  ],
  sellpointsLocked: true,
  voiceovers: [
    {
      id: "V01",
      type: "痛点救场型",
      narrative: "通勤救场",
      script: "早上来不及搭配？这条连衣裙一件出门。",
    },
  ],
  selectedVoiceoverId: "V01",
  storyboardVersions: {
    A: {
      id: "A" as const,
      title: "A版：痛点救场",
      panels: [1, 2, 3, 4, 5, 6].map(PANEL_FIXTURE),
      totalDurationSec: 24,
    },
  },
  selectedVersion: "A" as const,
  coverageChecklist: [
    {
      sellpointId: "S01",
      sellpointText: "垂坠不皱",
      layer: "core" as const,
      panelIndexes: [1, 2],
      covered: true,
    },
  ],
  outputMode: "script_compose" as const,
};

describe("fashionDeliverable v4 schema", () => {
  it("parses v4 fixture", () => {
    const result = fashionDeliverableSchema.safeParse(V4_FIXTURE);
    expect(result.success).toBe(true);
  });

  it("extracts from fashion-deliverable fence", () => {
    const fenced = `\`\`\`fashion-deliverable\n${JSON.stringify(V4_FIXTURE)}\n\`\`\``;
    const parsed = extractFashionDeliverable(fenced);
    expect(parsed?.productName).toBe("灰紫针织连衣裙");
    expect(parsed?.storyboardVersions?.A?.panels).toHaveLength(6);
  });

  it("mergeFashionDeliverablePatch preserves dimensions", () => {
    const merged = mergeFashionDeliverablePatch(null, {
      productName: "测试款",
      dimensions: { genderCategory: "男装" },
    });
    expect(merged.dimensions.genderCategory).toBe("男装");
    expect(merged.schemaVersion).toBe(FASHION_SCHEMA_VERSION);
  });

  it("fashionVersionToSheet maps 6 panels", () => {
    const sheet = fashionVersionToSheet(V4_FIXTURE);
    expect(sheet?.panels).toHaveLength(6);
    expect(sheet?.panels[0]?.scene).toContain("都市");
    expect(sheet?.panels[0]?.imagePrompt).toContain("参考图1");
  });

  it("renderFashionDeliverableMarkdown includes tables", () => {
    const md = renderFashionDeliverableMarkdown(V4_FIXTURE);
    expect(md).toContain("12.1 · 分镜脚本表");
    expect(md).toContain("12.3 · 卖点覆盖率验收清单");
    expect(md).toContain("垂坠不皱");
  });

  it("coerces opsPack titles with type and text objects", () => {
    const merged = mergeFashionDeliverablePatch(null, {
      productName: "测试款",
      storyboardLocked: true,
      opsPack: {
        titles: [
          { type: "痛点救场型", text: "痛点救场" },
          { type: "Solution type", text: "Solution" },
        ],
      },
    });
    expect(merged.opsPack?.titles).toEqual([
      "痛点救场型：痛点救场",
      "Solution type：Solution",
    ]);
  });

  it("ignores LLM preselectedVersion when storyboards arrive without opsPack", () => {
    const fenced = `\`\`\`fashion-deliverable
${JSON.stringify({
  ...V4_FIXTURE,
  selectedVersion: "A",
  opsPack: undefined,
  outputMode: null,
})}
\`\`\``;
    const parsed = extractFashionDeliverable(fenced);
    expect(parsed?.selectedVersion).toBeNull();
    expect(parsed?.storyboardVersions?.A?.panels).toHaveLength(6);
  });

  it("preserves selectedVersion when opsPack arrives after storyboard lock", () => {
    const base = mergeFashionDeliverablePatch(null, {
      productName: "测试款",
      sellpointsLocked: true,
      selectedVoiceoverId: "V01",
      selectedVersion: "A",
      storyboardLocked: true,
      storyboardVersions: {
        A: V4_FIXTURE.storyboardVersions!.A!,
      },
    });
    const merged = mergeFashionDeliverablePatch(base, {
      opsPack: {
        titles: ["标题一"],
        tags: ["穿搭"],
      },
      selectedVersion: null,
    });
    expect(merged.selectedVersion).toBe("A");
    expect(merged.opsPack?.titles).toEqual(["标题一"]);
  });

  it("keeps sellpointsLocked once true even if patch sets false", () => {
    const base = mergeFashionDeliverablePatch(null, {
      productName: "测试款",
      sellpointsLocked: true,
      sellpoints: V4_FIXTURE.sellpoints,
    });
    const merged = mergeFashionDeliverablePatch(base, {
      sellpointsLocked: false,
    });
    expect(merged.sellpointsLocked).toBe(true);
  });

  it("mergeFashionDeliverablePatch preserves selectedVoiceoverId when patch nulls it", () => {
    const base = mergeFashionDeliverablePatch(null, {
      productName: "测试款",
      selectedVoiceoverId: "V01",
      sellpointsLocked: true,
      storyboardVersions: {
        A: V4_FIXTURE.storyboardVersions!.A!,
      },
    });
    const merged = mergeFashionDeliverablePatch(base, {
      storyboardVersions: {
        A: V4_FIXTURE.storyboardVersions!.A!,
      },
      selectedVoiceoverId: null,
    });
    expect(merged.selectedVoiceoverId).toBe("V01");
    expect(merged.storyboardVersions?.A?.panels).toHaveLength(6);
  });

  it("strips voiceovers and downstream fields while sellpoints are not locked", () => {
    const merged = mergeFashionDeliverablePatch(null, {
      productName: "测试款",
      sellpoints: V4_FIXTURE.sellpoints,
      sellpointsLocked: false,
      voiceovers: V4_FIXTURE.voiceovers,
      selectedVoiceoverId: "V01",
      selectedVersion: "A",
      storyboardVersions: V4_FIXTURE.storyboardVersions,
    });
    expect(merged.sellpoints).toHaveLength(V4_FIXTURE.sellpoints.length);
    expect(merged.voiceovers).toEqual([]);
    expect(merged.selectedVoiceoverId).toBeNull();
    expect(merged.selectedVersion).toBeNull();
    expect(merged.storyboardVersions).toEqual({});
  });

  it("does not overwrite locked sellpoints when LLM patch carries new sellpoints", () => {
    const locked = mergeFashionDeliverablePatch(null, {
      productName: "测试款",
      sellpoints: [{ id: "S01", text: "用户定稿卖点", layer: "core", source: "user" }],
      sellpointsLocked: true,
    });
    const merged = mergeFashionDeliverablePatch(locked, {
      sellpoints: [{ id: "S01", text: "LLM旧卖点", layer: "core", source: "ai" }],
      voiceovers: V4_FIXTURE.voiceovers,
    });
    expect(merged.sellpoints[0]?.text).toBe("用户定稿卖点");
    expect(merged.voiceovers.length).toBeGreaterThan(0);
  });

  it("inferFashionPhaseFromDeliverable stays at sellpoints until locked", () => {
    expect(
      inferFashionPhaseFromDeliverable({
        ...V4_FIXTURE,
        sellpointsLocked: false,
      }),
    ).toBe("sellpoints");
    expect(
      inferFashionPhaseFromDeliverable({
        ...V4_FIXTURE,
        sellpointsLocked: true,
        selectedVoiceoverId: null,
        voiceovers: V4_FIXTURE.voiceovers,
      }),
    ).toBe("voiceover_pick");
  });

  it("ignores premature opsPack before storyboardLocked (no output_mode skip)", () => {
    const withPrematureOps = mergeFashionDeliverablePatch(V4_FIXTURE, {
      selectedVersion: "A",
      storyboardLocked: false,
      opsPack: {
        titles: ["标题1"],
        tags: ["#tag"],
      },
    });
    expect(withPrematureOps.opsPack).toBeUndefined();
    expect(withPrematureOps.outputMode).toBeNull();
    expect(inferFashionPhaseFromDeliverable(withPrematureOps)).toBe("storyboard_confirm");
  });

  it("output_mode only after storyboardLocked and ops pack", () => {
    const ready = mergeFashionDeliverablePatch(
      { ...V4_FIXTURE, outputMode: null, storyboardLocked: false },
      {
        storyboardLocked: true,
        opsPack: { titles: ["标题1"] },
      },
    );
    expect(inferFashionPhaseFromDeliverable(ready)).toBe("output_mode");
  });

  it("resolve does not restore outputMode without explicit path choice in chat", () => {
    const metaDeliverable = {
      ...V4_FIXTURE,
      selectedVersion: "A" as const,
      storyboardLocked: true,
      outputMode: "direct_video" as const,
      opsPack: { titles: ["标题1"] },
      storyboardVersions: {
        A: {
          id: "A" as const,
          title: "A版",
          panels: Array.from({ length: 6 }, (_, i) => PANEL_FIXTURE(i + 1)),
        },
      },
    };
    const resolved = resolveFashionDeliverableForProject({
      meta: { deliverable: metaDeliverable, workflow: { vertical: "fashion_apparel" } },
      chatHistory: [],
    });
    expect(resolved?.outputMode).toBeNull();
    expect(resolved?.opsPack).toBeUndefined();
    expect(resolved?.storyboardLocked).toBe(false);
  });

  it("resolve restores outputMode after user picks path in chat", () => {
    const metaDeliverable = {
      ...V4_FIXTURE,
      selectedVersion: "A" as const,
      storyboardLocked: true,
      outputMode: "direct_video" as const,
      opsPack: { titles: ["标题1"] },
      storyboardVersions: {
        A: {
          id: "A" as const,
          title: "A版",
          panels: Array.from({ length: 6 }, (_, i) => PANEL_FIXTURE(i + 1)),
        },
      },
    };
    const resolved = resolveFashionDeliverableForProject({
      meta: { deliverable: metaDeliverable, workflow: { vertical: "fashion_apparel" } },
      chatHistory: [
        {
          id: "u1",
          role: "user",
          content: "选择分镜 A版：A版",
          createdAt: new Date().toISOString(),
        },
        {
          id: "u2",
          role: "user",
          content: "确认分镜，生成运营包",
          createdAt: new Date().toISOString(),
        },
        {
          id: "u3",
          role: "user",
          content: "故事版一键成片",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(resolved?.outputMode).toBe("direct_video");
    expect(resolved?.opsPack?.titles).toEqual(["标题1"]);
    expect(resolved?.storyboardLocked).toBe(true);
  });

  it("resolveFashionDeliverableForProject merges chat pick and locked meta panels", () => {
    const metaDeliverable = {
      ...V4_FIXTURE,
      selectedVersion: "A" as const,
      storyboardLocked: true,
      storyboardVersions: {
        A: {
          id: "A" as const,
          title: "A版",
          panels: Array.from({ length: 6 }, (_, i) => ({
            ...PANEL_FIXTURE(i + 1),
            sceneDesc: "定稿场景",
          })),
        },
      },
      outputMode: "direct_video" as const,
    };
    const resolved = resolveFashionDeliverableForProject({
      meta: {
        deliverable: metaDeliverable,
        workflow: { vertical: "fashion_apparel" },
      },
      chatHistory: [
        {
          id: "u1",
          role: "user",
          content: "选择分镜 D版：闺蜜出游风",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(resolved?.selectedVersion).toBe("A");
    expect(resolved?.storyboardVersions?.A?.panels[0]?.sceneDesc).toBe("定稿场景");
    expect(fashionVersionToSheet(resolved!)?.panels).toHaveLength(6);
  });

  it("resolveFashionDeliverableForProject lenient meta + chat confirm builds sheet", () => {
    const partialPanels = Array.from({ length: 6 }, (_, i) => ({
      index: i + 1,
      shotScale: "中景",
      durationSec: 4,
    }));
    const resolved = resolveFashionDeliverableForProject({
      meta: {
        deliverable: {
          schemaVersion: FASHION_SCHEMA_VERSION,
          vertical: "fashion_apparel",
          productName: "测试款",
          dimensions: {},
          sellpoints: V4_FIXTURE.sellpoints,
          sellpointsLocked: true,
          voiceovers: V4_FIXTURE.voiceovers,
          selectedVoiceoverId: "V01",
          storyboardVersions: {
            C: {
              id: "C",
              title: "情绪氛围式",
              panels: partialPanels,
            },
          },
          selectedVersion: "C",
          storyboardLocked: false,
          coverageChecklist: [],
          outputMode: "direct_video",
        },
        workflow: { vertical: "fashion_apparel" },
      },
      chatHistory: [
        {
          id: "u1",
          role: "user",
          content: "选择分镜 C版：情绪氛围式",
          createdAt: new Date().toISOString(),
        },
        {
          id: "u2",
          role: "user",
          content: "确认分镜，生成运营包",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    expect(resolved?.selectedVersion).toBe("C");
    expect(resolved?.storyboardLocked).toBe(true);
    expect(fashionVersionToSheet(resolved!)?.panels.length).toBeGreaterThan(0);
  });
});
