import { describe, expect, it } from "vitest";

import {
  materializeModuleSlots,
  resolveModuleDisplaySlots,
} from "@/lib/ecom/detail-page-suite/module-slots";
import type { DetailPageSuiteModuleState } from "@/lib/ecom/detail-page-suite/types";

describe("materializeModuleSlots", () => {
  it("recovers orphan prompt when selected label differs but index matches", () => {
    const mod: DetailPageSuiteModuleState = {
      module_id: "mod2_highlight",
      module_name: "亮点",
      enable: true,
      generate_count: 1,
      max_num: 2,
      select_mode: "manual",
      candidate_pool: ["卖点汇总版式底图1，大面积留白，适合叠加文字"],
      selected_item_list: ["卖点汇总版式底图1，大面积留白，适合叠加文字"],
      slots: [
        {
          item_key: "item_1",
          item_label: "旧 label",
          source: "template",
          positive_prompt: "这是不应丢失的长提示词内容",
        },
      ],
    };
    const slots = materializeModuleSlots(mod);
    expect(slots.some((s) => s.positive_prompt.includes("不应丢失"))).toBe(true);
  });

  it("restores prompt from meta snapshot when slots empty", () => {
    const mod: DetailPageSuiteModuleState = {
      module_id: "mod1_banner",
      module_name: "首屏",
      enable: true,
      generate_count: 1,
      max_num: 1,
      select_mode: "manual",
      candidate_pool: ["首屏"],
      selected_item_list: ["首屏模特全身氛围感穿搭，产品主体突出，宽幅详情长图"],
      slots: [],
    };
    const slotKey = resolveModuleDisplaySlots(mod)[0]?.item_key ?? "item_1";
    const slots = materializeModuleSlots(mod, {
      [`mod1_banner::${slotKey}`]: {
        prompt: "快照里的首屏提示词备份",
        itemLabel: "首屏",
        updatedAt: "2026-09-13T10:00:00.000Z",
      },
    });
    expect(slots.some((s) => s.positive_prompt.includes("快照"))).toBe(true);
  });
});
