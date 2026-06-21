import { describe, expect, it } from "vitest";

import { buildSlowGenerationWhere, isSlowGenerationAge } from "@/lib/generation/slow-generation";

describe("slow-generation", () => {
  it("buildSlowGenerationWhere matches completed and in-flight slow logs", () => {
    const now = Date.parse("2026-06-21T12:00:00.000Z");
    const where = buildSlowGenerationWhere(800_000, now);
    expect(where).toEqual({
      OR: [
        { durationMs: { gte: 800_000 } },
        {
          status: { in: ["PENDING", "RUNNING"] },
          submittedAt: { lte: new Date(now - 800_000) },
        },
      ],
    });
  });

  it("isSlowGenerationAge uses submittedAt when present", () => {
    const now = Date.parse("2026-06-21T12:00:00.000Z");
    expect(
      isSlowGenerationAge(
        new Date(now - 801_000),
        new Date(now - 900_000),
        now,
        800_000,
      ),
    ).toBe(true);
    expect(
      isSlowGenerationAge(
        new Date(now - 100_000),
        new Date(now - 900_000),
        now,
        800_000,
      ),
    ).toBe(false);
  });
});
