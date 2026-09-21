import { describe, expect, it } from "vitest";

import {
  detailPageSuiteLabelMatches,
  materializeModuleSlots,
  resolveModuleDisplaySlots,
} from "@/lib/ecom/detail-page-suite/module-slots";
import type { DetailPageSuiteModuleState } from "@/lib/ecom/detail-page-suite/types";

describe("detailPageSuiteLabelMatches", () => {
  it("does not treat highlight layout 1 and 2 as the same sub-dimension", () => {
    const a = "卖点汇总版式底图1，大面积留白，适合叠加文字";
    const b = "卖点汇总版式底图2，分区卡片式留白，适合多卖点排版";
    expect(detailPageSuiteLabelMatches(a, b)).toBe(false);
  });

  it("still matches shortened prefix labels", () => {
    expect(detailPageSuiteLabelMatches("首屏", "首屏模特全身氛围感穿搭")).toBe(true);
  });
});

describe("resolveModuleDisplaySlots", () => {
  it("keeps two highlight slots distinct when only the first has a saved prompt", () => {
    const mod: DetailPageSuiteModuleState = {
      module_id: "mod2_highlight",
      module_name: "产品核心亮点汇总",
      enable: true,
      generate_count: 2,
      max_num: 2,
      select_mode: "manual",
      candidate_pool: [
        "卖点汇总版式底图1，大面积留白，适合叠加文字",
        "卖点汇总版式底图2，分区卡片式留白，适合多卖点排版",
      ],
      selected_item_list: [
        "卖点汇总版式底图1，大面积留白，适合叠加文字",
        "卖点汇总版式底图2，分区卡片式留白，适合多卖点排版",
      ],
      slots: [
        {
          item_key: "item_卖点汇总版式底图1大面积留白适合叠加",
          item_label: "卖点汇总版式底图1，大面积留白，适合叠加文字",
          source: "template",
          positive_prompt: "提示词 A",
          imageUrl: "https://example.com/a.png",
        },
      ],
    };
    const display = resolveModuleDisplaySlots(mod);
    expect(display).toHaveLength(2);
    expect(display[0]?.positive_prompt).toBe("提示词 A");
    expect(display[1]?.item_label).toContain("底图2");
    expect(display[1]?.positive_prompt).not.toBe("提示词 A");
    expect(display[0]?.item_key).not.toBe(display[1]?.item_key);
  });
});

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

  it("restores prompt from snapshot matched by itemLabel when item_key differs", () => {
    const mod: DetailPageSuiteModuleState = {
      module_id: "mod3_model_show",
      module_name: "模特上身",
      enable: true,
      generate_count: 1,
      max_num: 6,
      select_mode: "manual",
      candidate_pool: ["模特微微抬手动作，展示手臂活动空间与袖口"],
      selected_item_list: ["模特微微抬手动作，展示手臂活动空间与袖口"],
      slots: [],
    };
    const displayKey = resolveModuleDisplaySlots(mod)[0]?.item_key ?? "item_x";
    const slots = materializeModuleSlots(mod, {
      "mod3_model_show::item_3": {
        prompt: "快照备份的抬手动作提示词",
        itemLabel: "模特微微抬手动作，展示手臂活动空间与袖口",
        updatedAt: "2026-09-18T10:00:00.000Z",
      },
    });
    expect(displayKey).not.toBe("item_3");
    expect(slots.some((s) => s.positive_prompt.includes("抬手动作"))).toBe(true);
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
