import { describe, expect, it } from "vitest";

import { shouldAcceptHitRewriteProgressWrite } from "@/lib/ecom/detail-page-suite-hit/hit-rewrite-service";

describe("shouldAcceptHitRewriteProgressWrite", () => {
  it("allows progress ticks while polishing or decomposing", () => {
    expect(shouldAcceptHitRewriteProgressWrite("polishing")).toBe(true);
    expect(shouldAcceptHitRewriteProgressWrite("decomposing")).toBe(true);
  });

  it("blocks stale heartbeat after ready", () => {
    expect(shouldAcceptHitRewriteProgressWrite("ready")).toBe(false);
    expect(shouldAcceptHitRewriteProgressWrite("decomposed")).toBe(false);
  });

  it("allows explicit hitStatus transitions", () => {
    expect(shouldAcceptHitRewriteProgressWrite("ready", { hitStatus: "polishing" })).toBe(true);
  });
});
