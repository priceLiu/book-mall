import { describe, expect, it } from "vitest";

import { OUTDOOR_JACKET_MODULES } from "@/lib/ecom/detail-page-suite/category-seeds";
import {
  applyReplicaPolishToSuite,
  buildInitialReplicaSuite,
} from "@/lib/ecom/detail-page-suite-replica/replica-materialize";
import {
  REPLICA_MODULE_IDS,
  type ReplicaPhaseA,
} from "@/lib/ecom/detail-page-suite-replica/replica-schemas";

function emptyPhaseA(): ReplicaPhaseA {
  return {
    schemaVersion: "detail-page-suite-replica/v1",
    categoryKey: "outdoor_jacket",
    modules: REPLICA_MODULE_IDS.map((module_id) => ({
      module_id,
      detected: false,
      items: [],
    })),
  };
}

describe("buildInitialReplicaSuite", () => {
  it("materializes 12 outdoor modules with template placeholder counts", () => {
    const suite = buildInitialReplicaSuite();
    expect(suite.modules).toHaveLength(12);
    expect(suite.modules.map((m) => m.module_id)).toEqual(REPLICA_MODULE_IDS);
    expect(suite.modules.every((m) => m.enable && m.generate_count > 0)).toBe(true);
    const banner = suite.modules.find((m) => m.module_id === "mod1_banner");
    expect(banner?.selected_item_list.length).toBe(1);
  });
});

describe("applyReplicaPolishToSuite", () => {
  it("writes polish slots for detected module", () => {
    const phaseA = emptyPhaseA();
    phaseA.modules[0] = {
      module_id: "mod1_banner",
      detected: true,
      items: [{ item_key: "b1", item_label: "首屏主视觉" }],
    };
    const polishByModule = new Map([
      [
        "mod1_banner",
        {
          schemaVersion: "detail-page-suite-replica-polish/v1",
          module_id: "mod1_banner",
          items: [
            {
              item_key: "b1",
              item_label: "首屏主视觉",
              positive_prompt: "商业摄影，竖版详情页，红色羽绒服模特雪山背景，8K",
              negative_prompt: "文字，logo",
            },
          ],
        },
      ],
    ]);
    const { suite } = applyReplicaPolishToSuite({
      suite: buildInitialReplicaSuite(),
      phaseA,
      polishByModule,
      brief: null,
    });
    const mod1 = suite.modules.find((m) => m.module_id === "mod1_banner");
    expect(mod1?.slots).toHaveLength(1);
    expect(mod1?.slots[0]?.positive_prompt).toContain("商业摄影");
    expect(mod1?.enable).toBe(true);
  });

  it("keeps 12 modules when polish empty", () => {
    const { suite } = applyReplicaPolishToSuite({
      suite: buildInitialReplicaSuite(),
      phaseA: emptyPhaseA(),
      polishByModule: new Map(),
      brief: null,
    });
    expect(suite.modules).toHaveLength(OUTDOOR_JACKET_MODULES.length);
  });
});
