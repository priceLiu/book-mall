import { describe, expect, it } from "vitest";

import { resolveModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
import {
  mergeDetailPageSuiteProjectPreservingLocalPrompts,
  mergeDetailPageSuiteSlotPromptFromProject,
} from "@/lib/detail-page-suite-project-merge";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

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
        module_id: "m1",
        module_name: "A",
        enable: true,
        generate_count: 2,
        max_num: 2,
        select_mode: "manual",
        candidate_pool: ["子维度A", "子维度B"],
        selected_item_list: ["子维度A", "子维度B"],
        slots: [],
      },
    ],
  },
  meta: { phase: "subdims" },
  createdAt: "",
  updatedAt: "",
});

describe("mergeDetailPageSuiteSlotPromptFromProject", () => {
  it("merges one slot without dropping sibling prompts", () => {
    const base = baseProject();
    const mod = base.suite.modules[0]!;
    const slots = resolveModuleDisplaySlots(mod);
    const slotA = slots[0]!;
    const slotB = slots[1]!;
    const withA = {
      ...base,
      suite: {
        ...base.suite,
        modules: [
          {
            ...mod,
            slots: [
              { ...slotA, positive_prompt: "prompt A" },
              { ...slotB, positive_prompt: "" },
            ],
          },
        ],
      },
    };
    const incoming = {
      ...withA,
      suite: {
        ...withA.suite,
        modules: [
          {
            ...mod,
            slots: [
              { ...slotA, positive_prompt: "stale" },
              { ...slotB, positive_prompt: "prompt B" },
            ],
          },
        ],
      },
    };

    const merged = mergeDetailPageSuiteSlotPromptFromProject(
      withA,
      incoming,
      "m1",
      slotB.item_key,
    );
    expect(merged).not.toBeNull();
    const mergedSlots = resolveModuleDisplaySlots(merged!.suite.modules[0]!);
    expect(mergedSlots.find((s) => s.item_key === slotA.item_key)?.positive_prompt).toBe(
      "prompt A",
    );
    expect(mergedSlots.find((s) => s.item_key === slotB.item_key)?.positive_prompt).toBe(
      "prompt B",
    );
  });
});

describe("mergeDetailPageSuiteProjectPreservingLocalPrompts", () => {
  it("keeps local prompts when loaded project is stale", () => {
    const local = baseProject();
    const mod = local.suite.modules[0]!;
    const slots = resolveModuleDisplaySlots(mod);
    const slotA = slots[0]!;
    const withPrompt = {
      ...local,
      suite: {
        ...local.suite,
        modules: [
          {
            ...mod,
            slots: [{ ...slotA, positive_prompt: "fresh local prompt" }],
          },
        ],
      },
    };
    const loaded = baseProject();
    const merged = mergeDetailPageSuiteProjectPreservingLocalPrompts(withPrompt, loaded);
    const mergedSlots = resolveModuleDisplaySlots(merged.suite.modules[0]!);
    expect(mergedSlots.find((s) => s.item_key === slotA.item_key)?.positive_prompt).toBe(
      "fresh local prompt",
    );
  });
});
