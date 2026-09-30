import { describe, expect, it } from "vitest";

import {
  buildSellpointContextForLlm,
  formatEcomSellpointFivePartDocument,
  parseEcomSellpointFivePartDocument,
  parseEcomSellpointFivePartJson,
} from "@/lib/ecom/ecom-sellpoint-five-part";

describe("ecom-sellpoint-five-part", () => {
  const sampleDoc = `1、商品名称：活力橙头戴式带麦游戏耳机
2、核心卖点：
亲肤大耳罩包裹，久戴不闷耳
一体式可调节头梁，适配各种头型
可弯折拾音麦杆，收音清晰顺畅
3、适用人群：电竞游戏玩家、线上会议办公族、网课学习学生党
4、使用场景：深夜联机开黑、居家线上会议、日常沉浸式听歌
5、规格参数：
颜色：活力亮橙色
外观：头戴全包耳式，搭配可弯折麦克风杆
标识：耳机外侧带有白色L形方向标识`;

  it("parses user example document", () => {
    const part = parseEcomSellpointFivePartDocument(sampleDoc);
    expect(part).not.toBeNull();
    expect(part!.productName).toBe("活力橙头戴式带麦游戏耳机");
    expect(part!.coreSellingPoints).toHaveLength(3);
    expect(part!.targetAudience).toContain("电竞");
    expect(part!.usageScenarios.length).toBeGreaterThanOrEqual(3);
    expect(part!.specifications).toHaveLength(3);
  });

  it("round-trips document format", () => {
    const part = parseEcomSellpointFivePartDocument(sampleDoc)!;
    const out = formatEcomSellpointFivePartDocument(part);
    expect(out).toContain("1、商品名称：活力橙头戴式带麦游戏耳机");
    expect(out).toContain("亲肤大耳罩包裹");
    expect(out).toContain("5、规格参数：");
  });

  it("parses vision JSON", () => {
    const part = parseEcomSellpointFivePartJson({
      product_name: "测试耳机",
      core_selling_points: ["卖点A", "卖点B"],
      target_audience: "玩家",
      usage_scenarios: ["开黑", "听歌"],
      specifications: ["颜色：黑"],
    });
    expect(part?.coreSellingPoints).toEqual(["卖点A", "卖点B"]);
  });

  it("buildSellpointContextForLlm prefers five-part", () => {
    const ctx = buildSellpointContextForLlm({
      sellpointFivePart: parseEcomSellpointFivePartDocument(sampleDoc)!,
      sellPoints: [{ id: "1", text: "ignored", source: "user" }],
    });
    expect(ctx).toContain("商品名称");
    expect(ctx).toContain("活力橙");
  });
});
