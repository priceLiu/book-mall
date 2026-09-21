import { describe, expect, it } from "vitest";

import {
  collectDecomposeTruncateWarnings,
  DETAIL_PAGE_VISION_MODULE_IDS,
  sliceDecomposeModuleForSlotBudget,
} from "@/lib/ecom/detail-page-vision-decompose";

describe("detail-page-vision-decompose slot budget", () => {
  it("sliceDecomposeModuleForSlotBudget keeps full module when under max_num", () => {
    const mod = {
      module_id: "mod1_banner",
      detected: true,
      items: [{ item_key: "a", item_label: "A" }],
    };
    const { module, truncated } = sliceDecomposeModuleForSlotBudget(mod);
    expect(truncated).toBe(0);
    expect(module.items).toHaveLength(1);
  });

  it("collectDecomposeTruncateWarnings lists modules over max_num", () => {
    const overCount = 20;
    const phaseA = {
      modules: DETAIL_PAGE_VISION_MODULE_IDS.map((module_id) => ({
        module_id,
        detected: module_id === "mod1_banner",
        items:
          module_id === "mod1_banner"
            ? Array.from({ length: overCount }, (_, i) => ({
                item_key: `k${i}`,
                item_label: `L${i}`,
              }))
            : [],
      })),
    };
    const warnings = collectDecomposeTruncateWarnings(phaseA);
    expect(warnings.some((w) => w.includes("mod1_banner") && w.includes(String(overCount)))).toBe(
      true,
    );
  });
});
