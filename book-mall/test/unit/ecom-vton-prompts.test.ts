import { describe, expect, it } from "vitest";

import {
  VTon_DEFAULT_MODEL_GENERATE_PROMPT,
  VTon_FULL_BODY_EXPAND_PROMPT_ZH,
  VTon_FULL_BODY_EXPAND_NEGATIVE_ZH,
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
});
