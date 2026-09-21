import { describe, expect, it } from "vitest";

import {
  countDetailPageSuitePromptSelection,
  countModuleSlotSelection,
  detailPageSuitePromptSelectionState,
  listDetailPageSuitePromptGenTargets,
  listModuleSelectedSlotKeys,
  moduleHasGeneratedImage,
  modulePromptSelectionState,
  pruneDetailPageSuitePromptSelection,
  resolveDetailPageSuiteBusyPromptKeys,
  resolveDetailPageSuiteBusySlotKeys,
  resolveDetailPageSuiteImageGenSlotKeys,
} from "@/lib/detail-page-suite-prompt-selection";
import { resolveModuleDisplaySlots } from "@/lib/detail-page-suite-module-slots";
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
        generate_count: 1,
        max_num: 2,
        select_mode: "manual",
        candidate_pool: ["子维度A"],
        selected_item_list: ["子维度A"],
        slots: [],
      },
      {
        module_id: "m2",
        module_name: "B",
        enable: false,
        generate_count: 1,
        max_num: 2,
        select_mode: "manual",
        candidate_pool: ["子维度B"],
        selected_item_list: ["子维度B"],
        slots: [],
      },
    ],
  },
  meta: { phase: "subdims" },
  createdAt: "",
  updatedAt: "",
});

describe("detail-page-suite-prompt-selection", () => {
  it("counts only valid target keys", () => {
    const project = baseProject();
    const targets = listDetailPageSuitePromptGenTargets(project);
    expect(targets).toHaveLength(1);
    const validKey = targets[0]!.key;
    expect(
      countDetailPageSuitePromptSelection(
        targets,
        new Set([validKey, "m2::item_1", "stale"]),
      ),
    ).toBe(1);
    expect(
      detailPageSuitePromptSelectionState(
        targets,
        new Set([validKey, "m2::item_1", "stale"]),
      ),
    ).toBe("all");
  });

  it("excludes generating keys from actionable count", () => {
    const project = baseProject();
    const targets = listDetailPageSuitePromptGenTargets(project);
    const validKey = targets[0]!.key;
    const busy = resolveDetailPageSuiteBusyPromptKeys(project, new Set(["m1"]), new Set());
    expect(busy.has(validKey)).toBe(true);
    expect(
      countDetailPageSuitePromptSelection(targets, new Set([validKey]), {
        excludeKeys: busy,
      }),
    ).toBe(0);
  });

  it("prunes stale keys when modules disabled", () => {
    const project = baseProject();
    const validKey = listDetailPageSuitePromptGenTargets(project)[0]!.key;
    const pruned = pruneDetailPageSuitePromptSelection(
      project,
      new Set([validKey, "m2::item_1"]),
    );
    expect([...pruned]).toEqual([validKey]);
  });

  it("module helpers count selection and detect images", () => {
    const project = baseProject();
    const mod = project.suite.modules[0]!;
    const key = listDetailPageSuitePromptGenTargets(project)[0]!.key;
    expect(modulePromptSelectionState(mod, new Set([key]))).toBe("all");
    expect(countModuleSlotSelection(mod, new Set([key]))).toBe(1);
    expect(moduleHasGeneratedImage(mod)).toBe(false);
    expect(listModuleSelectedSlotKeys(mod, new Set([key]), { requirePrompt: true })).toEqual([]);
    const displaySlot = resolveModuleDisplaySlots(mod)[0]!;
    const withPrompt = {
      ...mod,
      slots: [{ ...displaySlot, positive_prompt: "hello" }],
    };
    expect(
      listModuleSelectedSlotKeys(withPrompt, new Set([key]), { requirePrompt: true }),
    ).toEqual([key]);
    expect(
      moduleHasGeneratedImage({
        ...withPrompt,
        slots: [
          {
            ...withPrompt.slots[0]!,
            imageUrl: "https://example.com/a.png",
          },
        ],
      }),
    ).toBe(true);
  });

  it("busy slot keys exclude generating images from selection count", () => {
    const project = baseProject();
    const mod = project.suite.modules[0]!;
    const key = listDetailPageSuitePromptGenTargets(project)[0]!.key;
    const busy = resolveDetailPageSuiteBusySlotKeys(
      project,
      new Set(),
      new Set(),
      new Set([key]),
      new Set(),
    );
    expect(busy.has(key)).toBe(true);
    expect(
      countModuleSlotSelection(mod, new Set([key]), { excludeKeys: busy, requireNoPrompt: true }),
    ).toBe(0);
  });

  it("requireNoPrompt only counts slots awaiting prompts", () => {
    const project = baseProject();
    const mod = project.suite.modules[0]!;
    const displaySlot = resolveModuleDisplaySlots(mod)[0]!;
    const key = listDetailPageSuitePromptGenTargets(project)[0]!.key;
    const withPrompt = {
      ...mod,
      slots: [{ ...displaySlot, positive_prompt: "hello" }],
    };
    expect(
      countModuleSlotSelection(withPrompt, new Set([key]), { requireNoPrompt: true }),
    ).toBe(0);
    expect(
      countModuleSlotSelection(withPrompt, new Set([key]), { requirePrompt: true }),
    ).toBe(1);
  });

  it("counts all selected slots regardless of prompt for batch actions", () => {
    const project = baseProject();
    const mod = project.suite.modules[0]!;
    const displaySlot = resolveModuleDisplaySlots(mod)[0]!;
    const key = listDetailPageSuitePromptGenTargets(project)[0]!.key;
    const withPrompt = {
      ...mod,
      slots: [{ ...displaySlot, positive_prompt: "hello" }],
    };
    expect(countModuleSlotSelection(withPrompt, new Set([key]))).toBe(1);
    expect(
      listModuleSelectedSlotKeys(withPrompt, new Set([key]), { requireNoPrompt: true }),
    ).toEqual([]);
    expect(listModuleSelectedSlotKeys(withPrompt, new Set([key]))).toEqual([key]);
  });

  it("excludes busy keys from image gen resolution", () => {
    const project = baseProject();
    const mod = project.suite.modules[0]!;
    const s1 = resolveModuleDisplaySlots(mod)[0]!;
    project.suite.modules[0]!.slots = [{ ...s1, positive_prompt: "a" }];
    const k1 = "m1::" + s1.item_key;
    expect(
      resolveDetailPageSuiteImageGenSlotKeys(project, new Set([k1]), {
        excludeKeys: new Set([k1]),
      }),
    ).toEqual([]);
  });

  it("scopes image gen keys to one module when moduleId is set", () => {
    const project = baseProject();
    project.suite.modules[1]!.enable = true;
    project.suite.modules[1]!.generate_count = 1;
    const m1 = project.suite.modules[0]!;
    const m2 = project.suite.modules[1]!;
    const s1 = resolveModuleDisplaySlots(m1)[0]!;
    const s2 = resolveModuleDisplaySlots(m2)[0]!;
    project.suite.modules[0]!.slots = [{ ...s1, positive_prompt: "a" }];
    project.suite.modules[1]!.slots = [{ ...s2, positive_prompt: "b" }];
    const k1 = "m1::" + s1.item_key;
    const k2 = "m2::" + s2.item_key;
    const selected = new Set([k1, k2]);
    expect(resolveDetailPageSuiteImageGenSlotKeys(project, selected, { moduleId: "m2" })).toEqual([
      k2,
    ]);
  });
});
