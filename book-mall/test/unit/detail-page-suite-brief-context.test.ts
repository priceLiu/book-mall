import { describe, expect, it } from "vitest";

import {
  applyDetailPageSuiteImageGlobalPrefix,
  buildDetailPageSuiteBlankPlateBody,
  buildDetailPageSuiteBriefContextBlock,
  buildDetailPageSuiteGenderModelRule,
  buildDetailPageSuiteImageGlobalPrefix,
  buildDetailPageSuiteShootingRequirement,
  composeDetailPageSuiteVisiblePrompt,
  detailPageSuiteModuleInvolvesModel,
  stripDetailPageSuitePromptEnvelope,
} from "@/lib/ecom/detail-page-suite/brief-context";
import type { DetailPageSuiteBrief } from "@/lib/ecom/detail-page-suite/types";

const fullBrief: DetailPageSuiteBrief = {
  productDesc: "深棕色户外夹克",
  sellPoints: [{ id: "S1", text: "防风防水", source: "user" }],
  genderCategory: "女装",
  styleCategory: "夹克",
  styleAttribute: "户外机能",
  tier: "中端质感",
  customScene: "都市通勤",
  platform: "淘宝",
  outputLanguage: "中文",
};

describe("buildDetailPageSuiteBriefContextBlock", () => {
  it("includes all seven dimensions plus product and sellpoints", () => {
    const block = buildDetailPageSuiteBriefContextBlock(fullBrief);
    expect(block).toContain("性别品类：女装");
    expect(block).toContain("款式品类：夹克");
    expect(block).toContain("风格属性：户外机能");
    expect(block).toContain("档次定位：中端质感");
    expect(block).toContain("自定义场景：都市通勤");
    expect(block).toContain("发布平台：淘宝");
    expect(block).toContain("输出语言：中文");
    expect(block).toContain("商品描述：深棕色户外夹克");
    expect(block).toContain("商品卖点：防风防水");
  });
});

describe("buildDetailPageSuiteGenderModelRule", () => {
  it("requires female model for 女装 model modules", () => {
    const rule = buildDetailPageSuiteGenderModelRule("女装", true);
    expect(rule).toContain("女性模特");
    expect(rule).toContain("严禁男性");
  });

  it("skips gender rule for detail macro modules", () => {
    expect(buildDetailPageSuiteGenderModelRule("女装", false)).toBe("");
  });
});

describe("detailPageSuiteModuleInvolvesModel", () => {
  it("detects mod3_model_show", () => {
    expect(
      detailPageSuiteModuleInvolvesModel({
        moduleId: "mod3_model_show",
        moduleName: "模特上身整体穿搭展示",
      }),
    ).toBe(true);
  });

  it("detects 模特 in selected label", () => {
    expect(
      detailPageSuiteModuleInvolvesModel({
        moduleId: "mod_custom",
        moduleName: "自定义",
        selectedLabels: ["多色模特上身对比"],
      }),
    ).toBe(true);
  });
});

describe("composeDetailPageSuiteVisiblePrompt", () => {
  it("stores global prefix and shooting requirement in visible prompt", () => {
    const label = "侧面全身站姿，展示衣身厚度与侧面剪裁轮廓";
    const out = composeDetailPageSuiteVisiblePrompt("电商商业摄影，8K超清", fullBrief, label);
    expect(out).toContain("【全片一致】");
    expect(out).toContain("性别品类女装");
    expect(out).toContain("同一位成年女性模特");
    expect(out).toContain("防风防水");
    expect(out).toContain("【本张拍摄要求】");
    expect(out).toContain(label);
    expect(out).toContain("电商商业摄影，8K超清");
  });

  it("adds shooting requirement even when English body describes the pose", () => {
    const label = "模特半身胸肩特写，展示领口与肩线";
    const out = composeDetailPageSuiteVisiblePrompt(
      "adult female model half-body chest and shoulder close-up, studio soft light",
      fullBrief,
      label,
    );
    expect(out).toContain("【本张拍摄要求】");
    expect(out).toContain(label);
  });

  it("skips duplicate shooting requirement when block already present", () => {
    const label = "正面全身站姿，完整展示外套整体版型";
    const out = composeDetailPageSuiteVisiblePrompt(
      `【本张拍摄要求】${label}。电商商业摄影`,
      fullBrief,
      label,
    );
    expect(out.match(/【本张拍摄要求】/g)).toHaveLength(1);
  });

  it("stripDetailPageSuitePromptEnvelope removes stored envelopes for rewrite", () => {
    const label = "防风拉链特写，展示拉链质感与防风结构";
    const stored = composeDetailPageSuiteVisiblePrompt("微距商业摄影，8K", fullBrief, label);
    expect(stripDetailPageSuitePromptEnvelope(stored)).toBe("微距商业摄影，8K");
  });

  it("buildDetailPageSuiteShootingRequirement formats label", () => {
    expect(buildDetailPageSuiteShootingRequirement("防风拉链特写")).toBe(
      "【本张拍摄要求】防风拉链特写",
    );
  });

  it("applyDetailPageSuiteImageGlobalPrefix remains backward compatible", () => {
    const out = applyDetailPageSuiteImageGlobalPrefix("正面全身站姿", fullBrief);
    expect(out).toContain("【全片一致】");
    expect(out).toContain("正面全身站姿");
  });

  it("builds male prefix for 男装", () => {
    const prefix = buildDetailPageSuiteImageGlobalPrefix({
      ...fullBrief,
      genderCategory: "男装",
    });
    expect(prefix).toContain("同一位成年男性模特");
  });

  it("mod2 highlight uses product global prefix", () => {
    const label = "卖点汇总主视觉，模特穿着本产品，一侧大面积留白供叠加卖点文案";
    const body = "电商商业摄影，模特半身，产品清晰，一侧留白";
    const out = composeDetailPageSuiteVisiblePrompt(body, fullBrief, label, "mod2_highlight");
    expect(out).toContain("【全片一致】");
    expect(out).toContain("服装款式颜色与产品参考图完全一致");
    expect(out).not.toContain("留白底板");
  });

  it("mod12 aftersale blank plate skips clothing prefix", () => {
    const label = "售后保障底图，大面积留白";
    const body = buildDetailPageSuiteBlankPlateBody(label);
    const out = composeDetailPageSuiteVisiblePrompt(body, fullBrief, label, "mod12_aftersale");
    expect(out).toContain("留白底板");
    expect(out).not.toContain("服装款式颜色与产品参考图完全一致");
  });
});
