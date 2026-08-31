import { describe, expect, it } from "vitest";

import {
  extractProDeliverableFromText,
  mergeProDeliverableState,
  pickProPhaseMergePatch,
} from "@/lib/pro-vertical/deliverable-parse";
import type { ProDeliverable } from "@/lib/pro-vertical/types";

function panel(index: 1 | 2 | 3 | 4 | 5 | 6) {
  return {
    index,
    shotScale: "中景",
    durationSec: 4,
    cameraMove: "固定",
    sceneDesc: "桌面展示产品核心功能与外观细节特写",
    scenePrompt: "桌面展示产品核心功能与外观细节特写，写实自然光，与数码产品品类匹配的环境与道具",
    modelAction: "单手操作演示",
    productFocus: "产品功能展示",
    sellpointIds: ["SP01"],
    imagePrompt:
      "竖版9:16，写实UGC摄影。场景：桌面展示产品核心功能与外观细节特写，写实自然光，与数码产品品类匹配的环境与道具。模特单手操作演示，展示产品功能展示，以参考图1产品为准，禁止画面文字。",
    videoPrompt: "固定运镜，单手操作演示，场景桌面展示产品核心功能与外观细节特写，产品功能展示，UGC质感连贯动作",
  };
}

const BASE: ProDeliverable = {
  schemaVersion: "pro-v1",
  vertical: "digital_3c",
  productName: "测试手机",
  dimensions: {},
  sellpoints: [{ id: "SP01", text: "快充", layer: "core", source: "ai" }],
  sellpointsLocked: true,
  voiceovers: [{ id: "V02", type: "质感种草型", narrative: "口播", script: "脚本" }],
  selectedVoiceoverId: "V02",
  storyboardVersions: {},
  selectedVersion: null,
  storyboardLocked: false,
  coverageChecklist: [],
  outputMode: null,
};

describe("pro deliverable parse · phase patch contract", () => {
  it("accepts storyboards phase patch without vertical (spec §7.1)", () => {
    const payload = {
      storyboardVersions: {
        A: {
          id: "A",
          title: "A版·开箱",
          panels: [1, 2, 3, 4, 5, 6].map((i) => panel(i as 1 | 2 | 3 | 4 | 5 | 6)),
        },
      },
    };
    const text = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
    const patch = extractProDeliverableFromText(text, "digital_3c", "storyboards");
    expect(patch?.storyboardVersions?.A?.panels).toHaveLength(6);
    expect(patch?.vertical).toBeUndefined();
    expect(pickProPhaseMergePatch({ ...patch, sellpointsLocked: false }, "storyboards")).toEqual(
      patch,
    );
  });

  it("rejects storyboards patch when any version has fewer than 6 panels", () => {
    const payload = {
      storyboardVersions: {
        A: {
          id: "A",
          title: "A版",
          panels: [panel(1)],
        },
      },
    };
    const text = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
    expect(extractProDeliverableFromText(text, "digital_3c", "storyboards")).toBeNull();
  });

  it("merge keeps sellpointsLocked when applying storyboards patch", () => {
    const patch = extractProDeliverableFromText(
      `\`\`\`json\n${JSON.stringify({
        storyboardVersions: {
          A: {
            id: "A",
            title: "A版",
            panels: [1, 2, 3, 4, 5, 6].map((i) => panel(i as 1 | 2 | 3 | 4 | 5 | 6)),
          },
        },
        sellpointsLocked: false,
      })}\n\`\`\``,
      "digital_3c",
      "storyboards",
    );
    expect(patch).not.toBeNull();
    const merged = mergeProDeliverableState(BASE, patch!);
    expect(merged.sellpointsLocked).toBe(true);
    expect(merged.selectedVoiceoverId).toBe("V02");
    expect(merged.storyboardVersions?.A?.panels).toHaveLength(6);
  });
});
