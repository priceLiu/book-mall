import { describe, expect, it } from "vitest";

import { composeDetailPageSuiteVisiblePrompt } from "@/lib/detail-page-suite-prompt-compose";
import type { DetailPageSuiteBrief } from "@/lib/detail-page-suite-types";

const brief: DetailPageSuiteBrief = {
  genderCategory: "女装",
  styleCategory: "衬衫",
  sellPoints: [{ id: "S1", text: "免烫", source: "user" }],
};

describe("composeDetailPageSuiteVisiblePrompt", () => {
  it("fills missing shooting requirement for legacy English-only prompts", () => {
    const label = "模特半身胸肩特写，展示领口与肩线";
    const out = composeDetailPageSuiteVisiblePrompt(
      "adult female model half-body chest and shoulder close-up",
      brief,
      label,
    );
    expect(out).toContain("【全片一致】");
    expect(out).toContain("【本张拍摄要求】");
    expect(out).toContain(label);
  });

  it("blank plate size chart prompt excludes clothing constraints", () => {
    const label = "尺码表空白底图，浅纯色干净背景，预留表格区域";
    const out = composeDetailPageSuiteVisiblePrompt(
      "电商商业摄影写实照片，浅纯色干净背景，无服装",
      brief,
      label,
      "mod7_size_table",
    );
    expect(out).toContain("留白底板");
    expect(out).not.toContain("服装款式颜色与产品参考图完全一致");
    expect(out).not.toContain("同一位成年女性模特");
  });
});
