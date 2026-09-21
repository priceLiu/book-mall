import { describe, expect, it } from "vitest";

import { applyReplicaPolishToSuite } from "@/lib/ecom/detail-page-suite-replica/replica-materialize";
import { buildInitialReplicaSuite } from "@/lib/ecom/detail-page-suite-replica/replica-materialize";
import {
  normalizeReplicaModuleIds,
  normalizeReplicaPhaseBBatch,
  REPLICA_MODULE_IDS,
} from "@/lib/ecom/detail-page-suite-replica/replica-schemas";

describe("normalizeReplicaPhaseBBatch", () => {
  it("requires modules in request order", () => {
    const ids = ["mod1_banner", "mod3_model_show"];
    const raw = {
      schemaVersion: "detail-page-suite-replica-polish-batch/v1",
      modules: ids.map((module_id) => ({
        module_id,
        items: [],
      })),
    };
    const batch = normalizeReplicaPhaseBBatch(raw, ids);
    expect(batch.modules.map((m) => m.module_id)).toEqual(ids);
  });

  it("rejects wrong module order", () => {
    const ids = ["mod1_banner", "mod2_sellpoint"];
    const raw = {
      modules: [...ids].reverse().map((module_id) => ({ module_id, items: [] })),
    };
    expect(() => normalizeReplicaPhaseBBatch(raw, ids)).toThrow(/顺序/);
  });
});

describe("normalizeReplicaModuleIds", () => {
  it("sorts to seed order", () => {
    const shuffled = [...REPLICA_MODULE_IDS].reverse().slice(0, 3);
    expect(normalizeReplicaModuleIds(shuffled)).toEqual(
      REPLICA_MODULE_IDS.filter((id) => shuffled.includes(id)),
    );
  });
});

describe("applyReplicaPolishToSuite partial", () => {
  it("keeps untouched modules when targetModuleIds set", () => {
    const suite = buildInitialReplicaSuite();
    const phaseA = {
      modules: REPLICA_MODULE_IDS.map((module_id) => ({
        module_id,
        detected: module_id === "mod1_banner",
        items:
          module_id === "mod1_banner"
            ? [
                {
                  item_key: "a",
                  item_label: "首屏",
                },
              ]
            : [],
      })),
    };
    const polishByModule = new Map([
      [
        "mod1_banner",
        {
          module_id: "mod1_banner",
          items: [
            {
              item_key: "a",
              item_label: "首屏",
              positive_prompt: "测试用足够长的正向提示词内容",
            },
          ],
        },
      ],
    ]);
    const { suite: next } = applyReplicaPolishToSuite({
      suite,
      phaseA: phaseA as import("@/lib/ecom/detail-page-suite-replica/replica-schemas").ReplicaPhaseA,
      polishByModule,
      brief: null,
      targetModuleIds: ["mod1_banner"],
    });
    const mod1 = next.modules.find((m) => m.module_id === "mod1_banner");
    const mod2 = next.modules.find((m) => m.module_id === "mod2_highlight");
    expect(mod1?.slots.length).toBe(1);
    expect(mod2?.enable).toBe(false);
  });
});
