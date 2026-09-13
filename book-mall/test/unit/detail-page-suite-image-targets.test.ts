import { describe, expect, it } from "vitest";

import { collectDetailPageSuiteImageTargets } from "@/lib/ecom/detail-page-suite/image-gen";
import type { DetailPageSuiteModuleState } from "@/lib/ecom/detail-page-suite/types";

const baseMod = (): DetailPageSuiteModuleState => ({
  module_id: "mod1",
  module_name: "首屏",
  enable: true,
  generate_count: 2,
  max_num: 6,
  select_mode: "manual",
  candidate_pool: ["正面全身", "侧面"],
  selected_item_list: ["正面全身", "侧面"],
  slots: [],
});

describe("collectDetailPageSuiteImageTargets", () => {
  it("finds prompt via display slots when slots array is empty", () => {
    const mod = {
      ...baseMod(),
      slots: [],
    };
    const targets = collectDetailPageSuiteImageTargets([mod], {});
    expect(targets).toHaveLength(0);
  });

  it("finds prompt by label merge when only partial slots persisted", () => {
    const mod = {
      ...baseMod(),
      slots: [
        {
          item_key: "item_a",
          item_label: "正面全身",
          source: "template" as const,
          positive_prompt: "完整正向提示词内容足够长",
        },
      ],
    };
    const targets = collectDetailPageSuiteImageTargets([mod], {
      slotKeys: ["mod1::item_a"],
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.prompt).toContain("完整正向");
  });

  it("matches composite key from display slot item_key", () => {
    const mod = {
      ...baseMod(),
      generate_count: 1,
      selected_item_list: ["自定义点位"],
      slots: [
        {
          item_key: "item_custom",
          item_label: "自定义点位",
          source: "user" as const,
          positive_prompt: "用户手填的出图提示词内容",
        },
      ],
    };
    const targets = collectDetailPageSuiteImageTargets([mod], {
      slotKeys: ["mod1::item_custom"],
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]?.slotKey).toBe("item_custom");
  });
});
