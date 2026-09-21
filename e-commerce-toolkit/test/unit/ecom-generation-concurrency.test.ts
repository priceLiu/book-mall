import { describe, expect, it } from "vitest";

import {
  ECOM_GENERATION_STANDARD_CONCURRENCY,
  mapWithConcurrencySettled,
  normalizeEcomGenerationConcurrencyLimit,
} from "@/lib/ecom-generation-concurrency";

describe("ecom-generation-concurrency", () => {
  it("normalizeEcomGenerationConcurrencyLimit falls back to standard default", () => {
    expect(normalizeEcomGenerationConcurrencyLimit(undefined)).toBe(
      ECOM_GENERATION_STANDARD_CONCURRENCY,
    );
    expect(normalizeEcomGenerationConcurrencyLimit(0)).toBe(
      ECOM_GENERATION_STANDARD_CONCURRENCY,
    );
    expect(normalizeEcomGenerationConcurrencyLimit(3.7)).toBe(4);
  });

  it("mapWithConcurrencySettled respects concurrency cap", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrencySettled(
      items,
      async (n) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return n * 2;
      },
      2,
    );
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
