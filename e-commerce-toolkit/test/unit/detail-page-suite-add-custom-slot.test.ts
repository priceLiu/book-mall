import { describe, expect, it } from "vitest";

import {
  addCustomPromptSlotToModule,
  canAddCustomSuiteSlot,
  labelFromSuiteCustomPrompt,
  suiteEnabledSlotTotal,
} from "@/lib/detail-page-suite-add-custom-slot";
import type { DetailPageSuiteModuleState } from "@/lib/detail-page-suite-types";

function baseMod(overrides: Partial<DetailPageSuiteModuleState> = {}): DetailPageSuiteModuleState {
  return {
    module_id: "mod1",
    module_name: "测试模块",
    enable: true,
    generate_count: 1,
    max_num: 3,
    select_mode: "manual",
    candidate_pool: ["模板子维度"],
    selected_item_list: ["模板子维度"],
    slots: [
      {
        item_key: "item_1",
        item_label: "模板子维度",
        source: "template",
        positive_prompt: "已有模板提示词内容足够长",
        selectedForImage: true,
      },
    ],
    ...overrides,
  };
}

describe("labelFromSuiteCustomPrompt", () => {
  it("uses first non-empty line", () => {
    expect(labelFromSuiteCustomPrompt("首行\n第二行")).toBe("首行");
  });
});

describe("addCustomPromptSlotToModule", () => {
  it("appends slot with prompt and bumps generate_count", () => {
    const next = addCustomPromptSlotToModule(
      baseMod(),
      "自定义电商摄影，8K超清，模特穿藏青衬衫，简洁背景",
    );
    expect(next.generate_count).toBe(2);
    expect(next.selected_item_list).toHaveLength(2);
    expect(next.slots).toHaveLength(2);
    const added = next.slots[1]!;
    expect(added.source).toBe("user");
    expect(added.positive_prompt).toContain("藏青衬衫");
    expect(added.selectedForImage).toBe(true);
  });
});

describe("canAddCustomSuiteSlot", () => {
  it("blocks when module at max_num", () => {
    const mod = baseMod({ generate_count: 3, max_num: 3 });
    const result = canAddCustomSuiteSlot({ modules: [mod] }, "mod1");
    expect(result.ok).toBe(false);
  });

  it("allows when under limits", () => {
    const mod = baseMod();
    const result = canAddCustomSuiteSlot({ modules: [mod] }, "mod1");
    expect(result.ok).toBe(true);
  });
});

describe("suiteEnabledSlotTotal", () => {
  it("sums enabled module generate_count", () => {
    const total = suiteEnabledSlotTotal({
      modules: [
        baseMod({ generate_count: 2 }),
        baseMod({ module_id: "mod2", enable: false, generate_count: 5 }),
      ],
    });
    expect(total).toBe(2);
  });
});
