import { describe, expect, it } from "vitest";

import {
  assertProductImageSetPlanPromptQuality,
  buildProductImageSetSlotIdAliasMap,
  isRuleTemplateProductImageSetPrompt,
  parseProductImageSetPlanItems,
  resolveProductImageSetSlotId,
} from "@/lib/ecom/product-image-set/plan-parse";

describe("product-image-set plan-parse", () => {
  const expected = new Set(["white_bg-1", "sellpoint-1", "scene-2"]);
  const aliasMap = buildProductImageSetSlotIdAliasMap(expected);

  it("resolves common id typos", () => {
    expect(resolveProductImageSetSlotId("whiteBg-1", aliasMap, expected)).toBe("white_bg-1");
    expect(resolveProductImageSetSlotId("white-bg-1", aliasMap, expected)).toBe("white_bg-1");
    expect(resolveProductImageSetSlotId("sellpoint_1", aliasMap, expected)).toBe("sellpoint-1");
    expect(resolveProductImageSetSlotId("scene-2", aliasMap, expected)).toBe("scene-2");
  });

  it("parses fenced json", () => {
    const text = `\`\`\`json
{"items":[
  {"id":"white_bg-1","prompt":"白底主图详细描述不少于二十字测试用例"},
  {"id":"sellpoint-1","prompt":"卖点海报详细描述不少于二十字测试用例"},
  {"id":"scene-2","prompt":"模特场景详细描述不少于二十字测试用例"}
]}
\`\`\``;
    const map = parseProductImageSetPlanItems(text, expected);
    expect(map.size).toBe(3);
    expect(map.get("scene-2")?.prompt).toContain("模特");
  });

  it("detects rule template prompts", () => {
    expect(
      isRuleTemplateProductImageSetPrompt(
        "电商场景图，比例1:1，真实使用场景，自然光，亚马逊高转化风格。生活化场景，产品为视觉焦点。",
      ),
    ).toBe(true);
    const map = new Map([
      [
        "scene-1",
        {
          prompt:
            "头戴式耳机置于木质书桌，窗外柔光，年轻男性佩戴专注游戏，1:1构图，产品金属耳罩细节清晰，背景虚化RGB灯带",
        },
      ],
    ]);
    expect(() => assertProductImageSetPlanPromptQuality(map)).not.toThrow();
  });
});
