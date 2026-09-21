import { describe, expect, it } from "vitest";

import {
  hitDecomposeStatusCopy,
  isHitDecomposeInFlight,
} from "@/lib/detail-page-suite-hit-progress";
import { readHitTemplate } from "@/lib/detail-page-suite-hit-types";

describe("detail-page-suite-hit-progress", () => {
  it("reads persisted progress title", () => {
    const copy = hitDecomposeStatusCopy({
      hitStatus: "polishing",
      hitProgress: {
        step: "polish",
        title: "原创重写文案与出图提示词",
        detail: "按 6 个卡位分配…",
      },
    });
    expect(copy?.title).toContain("原创重写");
    expect(copy?.detail).toContain("6");
  });

  it("detects in-flight statuses", () => {
    expect(isHitDecomposeInFlight({ hitStatus: "decomposing" })).toBe(true);
    expect(isHitDecomposeInFlight({ hitStatus: "ready" })).toBe(false);
  });

  it("reads hit template from meta", () => {
    const t = readHitTemplate({
      template_name: "测试",
      component_list: [{ id: "a", type: "full_banner", layout: "full_image", repeat_count: 1 }],
    });
    expect(t?.template_name).toBe("测试");
    expect(readHitTemplate(null)).toBeNull();
  });
});
