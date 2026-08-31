import { describe, expect, it } from "vitest";

import {
  PRO_SCHEMA_VERSION,
  extractProDeliverable,
  mergeProDeliverablePatch,
  normalizeToProDeliverable,
  proVersionToSheet,
  resolveProDeliverableForProject,
} from "@/lib/ecom/ecom-pro-deliverable";
import { FASHION_SCHEMA_VERSION } from "@/lib/ecom/ecom-fashion-deliverable";

const BAG_PANEL = (index: number) => ({
  index: index as 1 | 2 | 3 | 4 | 5 | 6,
  shotScale: "中景",
  durationSec: 4,
  cameraMove: "固定",
  sceneDesc: "都市通勤街角",
  scenePrompt: "清晨都市通勤街角，柔和侧光，浅灰人行道与玻璃幕墙背景，写实自然光环境",
  modelAction: "单肩背携转身",
  productFocus: "包型轮廓与五金",
  dialogue: "通勤一只搞定",
  toneTexture: "冷调高级质感",
  sellpointIds: ["S01"],
  imagePrompt:
    "竖版9:16，写实UGC。场景：清晨都市通勤街角。女生单肩背携，以参考图1包包为准。禁止画面文字。",
  videoPrompt: "固定运镜，模特单肩背携后自然转身，展示包型轮廓，清晨街角环境连贯",
});

const BAGS_FIXTURE = {
  schemaVersion: PRO_SCHEMA_VERSION,
  vertical: "bags" as const,
  productName: "经典托特包",
  dimensions: {
    genderCategory: "女包",
    styleCategory: "托特包",
    styleAttribute: "职场办公",
    tier: "中端质感",
    customScene: "都市通勤",
    platform: "抖音",
    outputLanguage: "中文",
  },
  sellpoints: [
    { id: "S01", text: "大容量通勤", layer: "core" as const, source: "ai" as const },
  ],
  sellpointsLocked: true,
  voiceovers: [
    {
      id: "V01",
      type: "痛点救场型",
      narrative: "通勤救场",
      script: "早上来不及搭配？这只托特包一件出门。",
    },
  ],
  selectedVoiceoverId: "V01",
  storyboardVersions: {
    A: {
      id: "A" as const,
      title: "A版：痛点救场",
      panels: [1, 2, 3, 4, 5, 6].map(BAG_PANEL),
      totalDurationSec: 24,
    },
  },
  selectedVersion: "A" as const,
  coverageChecklist: [],
  outputMode: "direct_video" as const,
};

describe("ecom-pro-deliverable · bags", () => {
  it("extracts sellpoints phase patch from pro-deliverable fence", () => {
    const payload = {
      sellpoints: BAGS_FIXTURE.sellpoints,
    };
    const text = `已生成卖点。\n\`\`\`pro-deliverable\n${JSON.stringify(payload)}\n\`\`\``;
    const parsed = extractProDeliverable(text, "bags", "sellpoints");
    expect(parsed?.sellpoints).toHaveLength(1);
    expect(parsed?.vertical).toBeUndefined();
  });

  it("merges sellpoints patch without dropping dimensions", () => {
    const base = { ...BAGS_FIXTURE, sellpoints: [], sellpointsLocked: false };
    const patch = {
      sellpoints: [{ id: "S01", text: "大容量", layer: "core" as const, source: "ai" as const }],
      sellpointsLocked: true,
    };
    const merged = mergeProDeliverablePatch(base, patch);
    expect(merged.sellpoints).toHaveLength(1);
    expect(merged.dimensions.styleCategory).toBe("托特包");
  });

  it("normalizes legacy fashion-v4 to pro-v1 with productFocus", () => {
    const legacy = {
      schemaVersion: FASHION_SCHEMA_VERSION,
      vertical: "fashion_apparel",
      productName: "针织裙",
      dimensions: { genderCategory: "女装", styleCategory: "连衣裙" },
      sellpoints: [],
      storyboardVersions: {
        A: {
          id: "A",
          title: "A版",
          panels: [
            {
              ...BAG_PANEL(1),
              garmentFocus: "垂坠感",
              productFocus: undefined,
            },
          ],
        },
      },
    };
    const normalized = normalizeToProDeliverable(legacy);
    expect(normalized?.schemaVersion).toBe(PRO_SCHEMA_VERSION);
    expect(normalized?.vertical).toBe("fashion_apparel");
    const panel = normalized?.storyboardVersions?.A?.panels[0];
    expect(panel?.productFocus).toBeTruthy();
  });

  it("proVersionToSheet maps productFocus to sheet panels", () => {
    const sheet = proVersionToSheet(BAGS_FIXTURE, "A");
    expect(sheet?.panels).toHaveLength(6);
    expect(sheet?.panels[0]?.productBeat).toBe("包型轮廓与五金");
    expect(sheet?.overview.logline).toBe("通勤救场");
  });

  it("resolveProDeliverableForProject merges meta version panels for sheet sync", () => {
    const deliverable = {
      ...BAGS_FIXTURE,
      outputMode: "script_compose" as const,
      storyboardLocked: true,
    };
    const resolved = resolveProDeliverableForProject({
      meta: {
        workflow: { vertical: "bags", proPhase: "produce" },
        deliverable,
      },
      chatHistory: [
        { role: "user", content: "选择分镜 A版：A版·痛点救场" },
        { role: "user", content: "确认分镜，生成运营包" },
        { role: "user", content: "分镜脚本交付" },
      ],
    });
    expect(resolved?.selectedVersion).toBe("A");
    expect(resolved?.storyboardVersions?.A?.panels).toHaveLength(6);
    expect(proVersionToSheet(resolved!)).not.toBeNull();
  });
});

describe("ecom-pro-deliverable · digital_3c", () => {
  it("extracts sellpoints phase patch for digital_3c", () => {
    const payload = {
      sellpoints: [{ id: "S01", text: "快充", layer: "core" as const, source: "ai" as const }],
    };
    const text = `已生成卖点。\n\`\`\`pro-deliverable\n${JSON.stringify(payload)}\n\`\`\``;
    const parsed = extractProDeliverable(text, "digital_3c", "sellpoints");
    expect(parsed?.sellpoints?.[0]?.text).toBe("快充");
  });

  it("parses storyboards phase patch without vertical when fallback is digital_3c", () => {
    const panels = [1, 2, 3, 4, 5, 6].map((index) => ({
      index,
      shotScale: "中景",
      durationSec: 4,
      cameraMove: "慢推",
      sceneDesc: "桌面展示手机核心功能界面与操作手势细节",
      scenePrompt:
        "桌面展示手机核心功能界面与操作手势细节，写实自然光，与数码产品品类匹配的环境与道具",
      modelAction: "单手滑动屏幕演示功能",
      productFocus: "产品功能展示",
      sellpointIds: ["S01"],
      imagePrompt:
        "竖版9:16，写实UGC摄影。场景：桌面展示手机核心功能界面与操作手势细节，写实自然光，与数码产品品类匹配的环境与道具。模特单手滑动屏幕演示功能，展示产品功能展示，以参考图1产品为准，禁止画面文字。",
      videoPrompt:
        "慢推运镜，单手滑动屏幕演示功能，场景桌面展示手机核心功能界面与操作手势细节，产品功能展示，UGC质感连贯动作",
    }));
    const payload = {
      storyboardVersions: {
        A: {
          id: "A",
          title: "A版·功能演示",
          panels,
        },
      },
    };
    const text = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
    const parsed = extractProDeliverable(text, "digital_3c", "storyboards");
    expect(parsed?.storyboardVersions?.A?.panels).toHaveLength(6);
    expect(parsed?.vertical).toBeUndefined();
  });
});
