import { describe, expect, it } from "vitest";

import {
  listDetailPageSuitePendingImageKeys,
  reconcileDetailPageSuitePendingMeta,
} from "@/lib/detail-page-suite-pending";
import type { DetailPageSuiteProject } from "@/lib/detail-page-suite-types";

describe("detail-page-suite-pending (client)", () => {
  it("lists pending image keys from meta", () => {
    const meta: NonNullable<DetailPageSuiteProject["meta"]> = {
      pendingImages: {
        "mod1::item_a": { startedAt: "2026-09-13T10:00:00.000Z" },
      },
    };
    expect(listDetailPageSuitePendingImageKeys(meta)).toEqual(["mod1::item_a"]);
  });

  it("reconcile drops pending when slot has new image after startedAt", () => {
    const startedAt = "2026-09-13T10:00:00.000Z";
    const meta = {
      pendingImages: {
        "mod1::item_a": { startedAt },
      },
    };
    const suite = {
      modules: [
        {
          module_id: "mod1",
          enable: true,
          generate_count: 1,
          slots: [
            {
              item_key: "item_a",
              item_label: "A",
              positive_prompt: "p",
              imageUrl: "https://cdn.example/a.png",
              imageHistory: [
                { url: "https://cdn.example/a.png", createdAt: "2026-09-13T10:00:01.000Z" },
              ],
            },
          ],
        },
      ],
    };
    const reconciled = reconcileDetailPageSuitePendingMeta(suite as never, meta);
    expect(reconciled?.pendingImages).toBeUndefined();
  });

  it("reconcile drops stale pending", () => {
    const meta = {
      pendingImages: {
        "mod1::item_a": { startedAt: "2020-01-01T00:00:00.000Z" },
      },
    };
    const reconciled = reconcileDetailPageSuitePendingMeta({ modules: [] }, meta, Date.now());
    expect(reconciled?.pendingImages).toBeUndefined();
  });
});
