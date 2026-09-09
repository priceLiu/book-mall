import { describe, expect, it } from "vitest";

import {
  VTon_DEFAULT_MODEL_GENERATE_PROMPT,
  VTon_FULL_BODY_EXPAND_PROMPT_ZH,
  VTon_FULL_BODY_EXPAND_NEGATIVE_ZH,
  buildVtonFullBodyExpandPrompt,
} from "@/lib/ecom/ecom-vton/prompts";

describe("ecom-vton prompts", () => {
  it("uses casual outfit instead of underwear base", () => {
    for (const prompt of [VTon_DEFAULT_MODEL_GENERATE_PROMPT, VTon_FULL_BODY_EXPAND_PROMPT_ZH]) {
      expect(prompt).toContain("T 恤");
      expect(prompt).toContain("牛仔裤");
      expect(prompt).toContain("鞋子");
      expect(prompt).not.toContain("打底内衣");
      expect(prompt).not.toContain("简约内衣");
    }
  });

  it("requires head-to-toe framing with visible shoes", () => {
    for (const prompt of [VTon_DEFAULT_MODEL_GENERATE_PROMPT, VTon_FULL_BODY_EXPAND_PROMPT_ZH]) {
      expect(prompt).toContain("双脚");
      expect(prompt).toContain("禁止裁切脚踝");
    }
  });

  it("negative prompt blocks vest and underwear", () => {
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("背心");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("内衣");
  });

  it("expand full body prompt preserves makeup and lighting from reference", () => {
    expect(VTon_FULL_BODY_EXPAND_PROMPT_ZH).toContain("妆照应完整保留参考图");
    expect(VTon_FULL_BODY_EXPAND_PROMPT_ZH).toContain("光线与曝光须继承参考图");
    expect(VTon_FULL_BODY_EXPAND_PROMPT_ZH).not.toContain("中性摄影棚平光");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("妆容改变");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("光线不一致");
  });

  it("requires realistic adult body proportions for full body outputs", () => {
    for (const prompt of [VTon_DEFAULT_MODEL_GENERATE_PROMPT, VTon_FULL_BODY_EXPAND_PROMPT_ZH]) {
      expect(prompt).toContain("7.5～8 头身");
      expect(prompt).toContain("1/7～1/8");
      expect(prompt).toContain("腿长");
      expect(prompt).toContain("五五分");
      expect(prompt).toContain("健康匀称");
    }
    expect(VTon_DEFAULT_MODEL_GENERATE_PROMPT).toContain("不遮大腿");
    expect(VTon_FULL_BODY_EXPAND_PROMPT_ZH).toContain("成年男性肩宽");
    expect(VTon_FULL_BODY_EXPAND_PROMPT_ZH).toContain("禁止把特写中的大头原尺寸贴到全身画布上");
    expect(VTon_FULL_BODY_EXPAND_PROMPT_ZH).not.toContain("像素级继承");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("头身比例失调");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("纵向拉伸");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("腿短");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("过于消瘦");
  });

  it("uses subtle catalog pose suitable for try-on", () => {
    for (const prompt of [VTon_DEFAULT_MODEL_GENERATE_PROMPT, VTon_FULL_BODY_EXPAND_PROMPT_ZH]) {
      expect(prompt).toContain("手肘微弯");
      expect(prompt).toContain("肩宽");
      expect(prompt).toContain("relaxed standing pose");
      expect(prompt).not.toContain("双臂自然下垂或微张");
    }
    expect(VTon_FULL_BODY_EXPAND_PROMPT_ZH).toContain("延续上述轻微自然站姿");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("叉腰");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("交叉腿");
    expect(VTon_FULL_BODY_EXPAND_NEGATIVE_ZH).toContain("僵硬 T-pose");
  });

  it("canvas layout expand adds anchor and elongated ref hints", () => {
    const prompt = buildVtonFullBodyExpandPrompt(undefined, {
      usesCanvasLayout: true,
      elongatedRef: true,
    });
    expect(prompt).toContain("身份锚点");
    expect(prompt).toContain("腿长但不骨感");
    expect(prompt).toContain("纵向比例偏长");
  });
});
