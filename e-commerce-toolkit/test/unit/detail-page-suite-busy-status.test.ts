import { describe, expect, it } from "vitest";

import {
  suiteBusyStatusForAllImages,
  suiteBusyStatusForChoice,
  suiteBusyStatusForModuleImages,
} from "@/lib/detail-page-suite-busy-status";

describe("detail-page-suite-busy-status", () => {
  it("maps assistant choices to task titles", () => {
    expect(suiteBusyStatusForChoice("AI识图抽卖点").title).toBe("识图抽卖点中");
    expect(suiteBusyStatusForChoice("生成全部提示词").sweep).toBe(true);
    expect(suiteBusyStatusForChoice("生成全部图片").sweep).toBe(true);
  });

  it("includes slot count for batch image generation", () => {
    const status = suiteBusyStatusForAllImages(12);
    expect(status.detail).toContain("12");
    expect(status.sweep).toBe(true);
  });

  it("uses single-slot copy for one image", () => {
    expect(suiteBusyStatusForModuleImages({ moduleName: "主图", slotCount: 1 }).title).toBe(
      "单张出图中",
    );
  });
});
