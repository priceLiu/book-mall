import { describe, expect, it } from "vitest";
import {
  pro2ProductionScriptPatchSchema,
} from "@/lib/canvas/data/pro2-production-script-schema";

const MINIMAL_OUTLINE_PATCH = {
  schemaVersion: 1,
  tier: "standard",
  step: "outline",
  patch: {
    visualStyle: {
      worldBackground: "测试背景",
      era: "现代都市",
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

describe("book-mall pro2-production-script-schema mirror", () => {
  it("parses outline patch at standard tier", () => {
    const result = pro2ProductionScriptPatchSchema.safeParse(MINIMAL_OUTLINE_PATCH);
    expect(result.success).toBe(true);
  });
});
