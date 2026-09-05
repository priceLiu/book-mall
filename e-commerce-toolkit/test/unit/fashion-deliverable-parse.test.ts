import { describe, expect, it } from "vitest";

import {
  extractFashionDeliverableFromText,
  mergeFashionDeliverableState,
  pickFashionPhaseMergePatch,
} from "@/lib/fashion-deliverable-parse";
import type { FashionDeliverable } from "@/lib/fashion-types";

function panel(index: 1 | 2 | 3 | 4 | 5 | 6) {
  return {
    index,
    shotScale: "中景",
    durationSec: 4,
    cameraMove: "固定",
    sceneDesc: "都市通勤街头清晨展示服装垂坠与腰线",
    scenePrompt:
      "清晨都市通勤街角，柔和侧光，浅灰人行道与玻璃幕墙背景，写实自然光环境，与服装品类匹配",
    modelAction: "整理衣领转身",
    garmentFocus: "腰线与垂坠感",
    sellpointIds: ["S01"],
    imagePrompt:
      "竖版9:16，写实UGC摄影。场景：清晨都市通勤街角。模特整理衣领，展示腰线与垂坠感，以参考图1服装为准，禁止画面文字。",
    videoPrompt:
      "固定运镜，模特整理衣领后自然转身，展示腰线垂坠，清晨街角环境连贯",
  };
}

const BASE: FashionDeliverable = {
  schemaVersion: "fashion-v4",
  vertical: "fashion_apparel",
  productName: "测试连衣裙",
  dimensions: {},
  sellpoints: [{ id: "S01", text: "垂坠", layer: "core", source: "ai" }],
  sellpointsLocked: true,
  voiceovers: [{ id: "V02", type: "质感种草型", narrative: "口播", script: "脚本" }],
  selectedVoiceoverId: "V02",
  storyboardVersions: {},
  selectedVersion: null,
  storyboardLocked: false,
  coverageChecklist: [],
  outputMode: null,
};

describe("fashion deliverable parse · phase patch contract", () => {
  it("accepts storyboards phase patch without vertical (spec §7.1)", () => {
    const payload = {
      storyboardVersions: {
        A: {
          id: "A",
          title: "A版·痛点",
          panels: [1, 2, 3, 4, 5, 6].map((i) => panel(i as 1 | 2 | 3 | 4 | 5 | 6)),
        },
      },
    };
    const text = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
    const patch = extractFashionDeliverableFromText(text, "storyboards");
    expect(patch?.storyboardVersions?.A?.panels).toHaveLength(6);
    expect(patch?.vertical).toBeUndefined();
    expect(
      pickFashionPhaseMergePatch({ ...patch, sellpointsLocked: false }, "storyboards"),
    ).toEqual(patch);
  });

  it("rejects storyboards patch when any version has fewer than 6 panels", () => {
    const payload = {
      storyboardVersions: {
        A: { id: "A", title: "A版", panels: [panel(1)] },
      },
    };
    const text = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
    expect(extractFashionDeliverableFromText(text, "storyboards")).toBeNull();
  });

  it("merge keeps sellpointsLocked when applying storyboards patch", () => {
    const patch = extractFashionDeliverableFromText(
      `\`\`\`json\n${JSON.stringify({
        storyboardVersions: {
          A: {
            id: "A",
            title: "A版",
            panels: [1, 2, 3, 4, 5, 6].map((i) => panel(i as 1 | 2 | 3 | 4 | 5 | 6)),
          },
        },
      })}\n\`\`\``,
      "storyboards",
    );
    expect(patch).not.toBeNull();
    const merged = mergeFashionDeliverableState(BASE, patch!);
    expect(merged.sellpointsLocked).toBe(true);
    expect(merged.storyboardVersions?.A?.panels).toHaveLength(6);
  });
});
