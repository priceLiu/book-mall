import { describe, expect, it } from "vitest";

import { GATEWAY_CANONICAL_REGISTRY } from "@/lib/platform-model/canonical-registry";

describe("MiniMax H3 canonical registry", () => {
  it("groups all H3 modelKeys under billing canonicals with multiple routes", () => {
    const h3_2k = GATEWAY_CANONICAL_REGISTRY.find(
      (c) => c.canonicalModelKey === "minimax-h3-2k",
    );
    expect(h3_2k).toBeDefined();
    expect(h3_2k!.routes.map((r) => r.modelKey).sort()).toEqual(
      [
        "MiniMax/MiniMax-H3-fl2v",
        "MiniMax/MiniMax-H3-i2v",
        "MiniMax/MiniMax-H3-r2v",
        "MiniMax/MiniMax-H3-s2v",
        "MiniMax/MiniMax-H3-t2v",
      ].sort(),
    );

    const regen = GATEWAY_CANONICAL_REGISTRY.find(
      (c) => c.canonicalModelKey === "minimax-h3-regeneration-2k",
    );
    expect(regen?.routes).toHaveLength(1);
    expect(regen?.routes[0]?.modelKey).toBe("MiniMax/MiniMax-H3-regeneration");

    const ctx = GATEWAY_CANONICAL_REGISTRY.find(
      (c) => c.canonicalModelKey === "minimax-h3-context-ir",
    );
    expect(ctx?.routes).toHaveLength(1);
    expect(ctx?.routes[0]?.modelKey).toBe("MiniMax/MiniMax-H3-context-ir");
  });
});
