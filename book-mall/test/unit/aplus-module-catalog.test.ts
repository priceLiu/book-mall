import { describe, expect, it } from "vitest";

import {
  AI_DETAIL_PAGE_DEFAULT_ENABLED,
  AI_DETAIL_PAGE_MODULE_CATALOG,
} from "@/lib/ecom/detail-page-aplus/aplus-module-catalog";
import {
  buildInitialAplusSuite,
  ensureAplusSuiteMatchesCatalog,
} from "@/lib/ecom/detail-page-aplus/aplus-suite-init";

describe("aplus-module-catalog", () => {
  it("defines 16 modules", () => {
    expect(AI_DETAIL_PAGE_MODULE_CATALOG).toHaveLength(16);
  });

  it("merges legacy 8-module project to 16", () => {
    const legacy = {
      modules: [
        {
          module_id: "aplus_hero",
          module_name: "首屏主视觉",
          enable: true,
          generate_count: 1,
          max_num: 1,
          select_mode: "manual" as const,
          candidate_pool: ["x"],
          selected_item_list: ["x"],
          slots: [{ item_key: "aplus_hero::0", item_label: "x", positive_prompt: "p" }],
        },
      ],
    };
    const { suite, changed } = ensureAplusSuiteMatchesCatalog(legacy);
    expect(changed).toBe(true);
    expect(suite.modules).toHaveLength(16);
    const hero = suite.modules.find((m) => m.module_id === "aplus_hero");
    expect(hero?.enable).toBe(true);
    expect(hero?.module_name).toBe("首屏主视觉");
    expect(hero?.slots).toHaveLength(1);
  });

  it("buildInitialAplusSuite has 16 modules", () => {
    expect(buildInitialAplusSuite().modules).toHaveLength(16);
  });

  it("buildInitialAplusSuite enables first six catalog modules with count 1", () => {
    const suite = buildInitialAplusSuite();
    const enabled = suite.modules.filter((m) => m.enable && m.generate_count > 0);
    expect(enabled).toHaveLength(AI_DETAIL_PAGE_DEFAULT_ENABLED.size);
    for (const id of AI_DETAIL_PAGE_DEFAULT_ENABLED) {
      const mod = suite.modules.find((m) => m.module_id === id);
      expect(mod?.enable).toBe(true);
      expect(mod?.generate_count).toBe(1);
    }
  });

  it("applies default six when suite is pristine (all disabled, no slots)", () => {
    const pristine = {
      modules: AI_DETAIL_PAGE_MODULE_CATALOG.map((def) => ({
        module_id: def.module_id,
        module_name: def.module_name,
        enable: false,
        generate_count: 0,
        max_num: def.max_num,
        select_mode: "manual" as const,
        candidate_pool: [...def.candidate_pool],
        selected_item_list: [],
        slots: [],
      })),
    };
    const { suite, changed } = ensureAplusSuiteMatchesCatalog(pristine);
    expect(changed).toBe(true);
    expect(suite.modules.filter((m) => m.enable)).toHaveLength(6);
  });
});
