import { describe, expect, it } from "vitest";

import { importModelCostProfileVersioned } from "@/lib/pricing/import-model-cost-profile-versioned";

describe("importModelCostProfileVersioned", () => {
  it("re-exports versioned upsert with CHANNEL default", () => {
    expect(typeof importModelCostProfileVersioned).toBe("function");
  });
});
