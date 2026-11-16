import { describe, expect, it } from "vitest";

import { mergeModuleSlotsPreservingContent } from "@/lib/ecom/detail-page-suite/module-slots";
import {
  DETAIL_PAGE_SUITE_IMAGE_GEN_PENDING_MAX_MS,
  reconcileDetailPageSuitePendingMeta,
} from "@/lib/ecom/detail-page-suite/pending-state";
import type { DetailPageSuiteModuleState } from "@/lib/ecom/detail-page-suite/types";

describe("detail-page-suite pending + slot merge", () => {
  it("mergeModuleSlotsPreservingContent keeps prompt when next slot is empty", () => {
    const previous = [
      {
        item_key: "item_a",
        item_label: "卖点汇总",
        source: "template" as const,
        positive_prompt: "保留这条提示词",
      },
    ];
    const next = [
      {
        item_key: "item_a",
        item_label: "卖点汇总",
        source: "template" as const,
        positive_prompt: "",
        imageUrl: "https://example.com/a.png",
      },
    ];
    const merged = mergeModuleSlotsPreservingContent(previous, next);
    expect(merged[0]?.positive_prompt).toBe("保留这条提示词");
    expect(merged[0]?.imageUrl).toBe("https://example.com/a.png");
  });

  it("reconcile clears image pending after slot got image", () => {
    const mod: DetailPageSuiteModuleState = {
      module_id: "mod2_highlight",
      module_name: "亮点",
      enable: true,
      generate_count: 1,
      max_num: 2,
      select_mode: "manual",
      candidate_pool: ["A"],
      selected_item_list: ["A"],
      slots: [
        {
          item_key: "item_a",
          item_label: "A",
          source: "template",
          positive_prompt: "prompt",
          imageUrl: "https://example.com/x.png",
          imageHistory: [
            { url: "https://example.com/x.png", createdAt: "2026-09-13T10:00:00.000Z" },
          ],
        },
      ],
    };
    const meta = {
      pendingImages: {
        "mod2_highlight::item_a": { startedAt: "2026-09-13T09:59:00.000Z" },
      },
    };
    const reconciled = reconcileDetailPageSuitePendingMeta(
      { modules: [mod] },
      meta,
      Date.parse("2026-09-13T10:00:01.000Z"),
    );
    expect(reconciled?.pendingImages).toBeUndefined();
  });

  it("reconcile clears image pending older than gen max window", () => {
    const startedAt = new Date(Date.now() - DETAIL_PAGE_SUITE_IMAGE_GEN_PENDING_MAX_MS - 30_000).toISOString();
    const mod: DetailPageSuiteModuleState = {
      module_id: "mod2",
      module_name: "m",
      enable: true,
      generate_count: 1,
      max_num: 2,
      select_mode: "manual",
      candidate_pool: ["A"],
      selected_item_list: ["A"],
      slots: [
        {
          item_key: "item_a",
          item_label: "A",
          source: "template",
          positive_prompt: "prompt",
        },
      ],
    };
    const meta = {
      pendingImages: {
        "mod2::item_a": { startedAt },
      },
    };
    const reconciled = reconcileDetailPageSuitePendingMeta({ modules: [mod] }, meta);
    expect(reconciled?.pendingImages).toBeUndefined();
  });
});
