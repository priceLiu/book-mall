import { describe, expect, it } from "vitest";

import { prepareDetailPageSuitePatch } from "@/lib/ecom/detail-page-suite/suite-persist";
import type { DetailPageSuiteProject } from "@/lib/ecom/detail-page-suite/types";

const baseProject = (): DetailPageSuiteProject => ({
  id: "p1",
  title: "t",
  module: "detail-page-suite",
  status: "draft",
  brief: null,
  settings: {},
  references: [],
  chatHistory: [],
  suite: {
    modules: [
      {
        module_id: "mod3_model_show",
        module_name: "模特上身",
        enable: true,
        generate_count: 2,
        max_num: 6,
        select_mode: "manual",
        candidate_pool: ["A", "B"],
        selected_item_list: ["子维度A", "子维度B"],
        slots: [
          {
            item_key: "item_a",
            item_label: "子维度A",
            source: "template",
            positive_prompt: "已有提示词 A",
          },
          {
            item_key: "item_b",
            item_label: "子维度B",
            source: "template",
            positive_prompt: "",
          },
        ],
      },
    ],
  },
  meta: { phase: "prompts" },
  createdAt: "",
  updatedAt: "",
});

describe("prepareDetailPageSuitePatch", () => {
  it("merges incoming patch without wiping prompts from concurrent stale writes", () => {
    const existing = baseProject();
    const staleIncoming = {
      ...existing.suite,
      modules: [
        {
          ...existing.suite.modules[0]!,
          slots: [
            {
              item_key: "item_a",
              item_label: "子维度A",
              source: "template" as const,
              positive_prompt: "",
            },
            {
              item_key: "item_b",
              item_label: "子维度B",
              source: "template" as const,
              positive_prompt: "新写入 B",
            },
          ],
        },
      ],
    };
    const { suite } = prepareDetailPageSuitePatch(existing, { suite: staleIncoming });
    const mod = suite!.modules[0]!;
    const slotA = mod.slots.find((s) => s.item_label === "子维度A");
    const slotB = mod.slots.find((s) => s.item_label === "子维度B");
    expect(slotA?.positive_prompt).toContain("已有提示词 A");
    expect(slotB?.positive_prompt).toContain("新写入 B");
  });
});
