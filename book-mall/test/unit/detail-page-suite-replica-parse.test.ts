import { describe, expect, it } from "vitest";

import {
  normalizeReplicaPhaseA,
  REPLICA_MODULE_IDS,
} from "@/lib/ecom/detail-page-suite-replica/replica-schemas";

describe("normalizeReplicaPhaseA", () => {
  it("accepts 12 modules in seed order", () => {
    const raw = {
      schemaVersion: "detail-page-suite-replica/v1",
      modules: REPLICA_MODULE_IDS.map((module_id) => ({
        module_id,
        detected: false,
        items: [],
      })),
    };
    const parsed = normalizeReplicaPhaseA(raw);
    expect(parsed.modules).toHaveLength(12);
  });

  it("reorders modules to seed order when LLM returns shuffled list", () => {
    const raw = {
      modules: [...REPLICA_MODULE_IDS].reverse().map((module_id) => ({
        module_id,
        detected: false,
        items: [],
      })),
    };
    const parsed = normalizeReplicaPhaseA(raw);
    expect(parsed.modules.map((m) => m.module_id)).toEqual([...REPLICA_MODULE_IDS]);
  });

  it("coerces null hints, missing item_key, and string referenceCopyHints", () => {
    const raw = {
      modules: REPLICA_MODULE_IDS.map((module_id, i) => ({
        module_id,
        detected: i === 0,
        sizeChartHint: null,
        items:
          i === 0
            ? [
                {
                  item_label: "首屏海报",
                  referenceCopyHints: "品牌 slogan 一行",
                },
              ]
            : [],
      })),
    };
    const parsed = normalizeReplicaPhaseA(raw);
    expect(parsed.modules[0]?.items[0]?.item_key).toBe("mod1_banner__1");
    expect(parsed.modules[0]?.items[0]?.referenceCopyHints).toEqual([
      "品牌 slogan 一行",
    ]);
    expect(parsed.modules[1]?.sizeChartHint).toBeUndefined();
  });
});
