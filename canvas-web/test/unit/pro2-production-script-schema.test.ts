import { describe, expect, it } from "vitest";
import {
  pro2ProductionScriptPatchSchema,
  pro2ProductionScriptSchema,
} from "@/lib/canvas/data/pro2-production-script-schema";
import { PRO2_FIXTURE_FULL_PACK } from "../fixtures/pro2-production-script-fixture";

describe("pro2-production-script-schema", () => {
  it("accepts valid full_pack pro fixture", () => {
    const result = pro2ProductionScriptPatchSchema.safeParse(PRO2_FIXTURE_FULL_PACK);
    expect(result.success).toBe(true);
  });

  it("rejects pro tier shot missing required fields", () => {
    const bad = {
      ...PRO2_FIXTURE_FULL_PACK,
      patch: {
        shots: [
          {
            index: 1,
            sceneDescription: "只有描述",
            dialogue: "—",
          },
        ],
      },
      step: "storyboard" as const,
    };
    const result = pro2ProductionScriptPatchSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects full_pack missing handoff block", () => {
    const bad = {
      ...PRO2_FIXTURE_FULL_PACK,
      patch: { visualStyle: PRO2_FIXTURE_FULL_PACK.patch.visualStyle },
    };
    const result = pro2ProductionScriptPatchSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("pro2ProductionScriptSchema accepts schemaVersion 1 and 2", () => {
    expect(pro2ProductionScriptSchema.safeParse({ schemaVersion: 1 }).success).toBe(
      true,
    );
    expect(pro2ProductionScriptSchema.safeParse({ schemaVersion: 2 }).success).toBe(
      true,
    );
    expect(pro2ProductionScriptSchema.safeParse({ schemaVersion: 3 }).success).toBe(
      false,
    );
  });
});
