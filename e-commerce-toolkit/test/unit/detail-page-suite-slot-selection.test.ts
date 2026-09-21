import { describe, expect, it } from "vitest";

import {
  composeSuiteSlotKey,
  isSuiteSlotImageBatchSelectable,
  listSelectedSuiteSlotKeys,
  suiteModuleImageSelectionState,
  suiteModuleSelectableSlots,
  toggleSuiteModuleImageSelection,
  toggleSuiteSlotImageSelection,
} from "@/lib/detail-page-suite-slot-selection";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

const baseProject = (): DetailPageSuiteProject => ({
  id: "p1",
  title: "test",
  module: "detail-page-suite",
  status: "draft",
  brief: null,
  settings: {},
  references: [],
  chatHistory: [],
  suite: {
    modules: [
      {
        module_id: "mod1",
        module_name: "主图",
        enable: true,
        generate_count: 2,
        max_num: 2,
        select_mode: "manual",
        candidate_pool: ["A", "B"],
        selected_item_list: ["A", "B"],
        slots: [
          {
            item_key: "a",
            item_label: "A",
            source: "template",
            positive_prompt: "prompt a",
            selectedForImage: true,
          },
          {
            item_key: "b",
            item_label: "B",
            source: "template",
            positive_prompt: "prompt b",
            selectedForImage: false,
          },
        ],
      },
    ],
  },
  meta: null,
  createdAt: "",
  updatedAt: "",
});

describe("detail-page-suite-slot-selection", () => {
  it("composeSuiteSlotKey", () => {
    expect(composeSuiteSlotKey("mod1", "a")).toBe("mod1::a");
  });

  it("listSelectedSuiteSlotKeys respects selectedForImage", () => {
    const keys = listSelectedSuiteSlotKeys(baseProject());
    expect(keys).toEqual(["mod1::a"]);
  });

  it("module selection state partial/all", () => {
    const mod = baseProject().suite.modules[0]!;
    expect(suiteModuleImageSelectionState(mod)).toBe("partial");
    const all = toggleSuiteModuleImageSelection(mod, true);
    expect(suiteModuleImageSelectionState(all)).toBe("all");
  });

  it("toggle slot selection", () => {
    const mod = baseProject().suite.modules[0]!;
    const next = toggleSuiteSlotImageSelection(mod, "b");
    const slotB = next.slots.find((s) => s.item_key === "b");
    expect(slotB?.selectedForImage).toBe(true);
  });

  it("keeps generated slots in batch image selection", () => {
    const mod = baseProject().suite.modules[0]!;
    const withImage = {
      ...mod,
      slots: mod.slots.map((s) =>
        s.item_key === "a"
          ? {
              ...s,
              imageUrl: "https://example.com/a.png",
              imageHistory: [{ url: "https://example.com/a.png", createdAt: "2026-01-01T00:00:00.000Z" }],
            }
          : s,
      ),
    };
    expect(suiteModuleSelectableSlots(withImage)).toHaveLength(2);
    expect(isSuiteSlotImageBatchSelectable(withImage.slots[0]!)).toBe(true);
    expect(listSelectedSuiteSlotKeys({ ...baseProject(), suite: { modules: [withImage] } })).toEqual([
      "mod1::a",
    ]);
  });
});
