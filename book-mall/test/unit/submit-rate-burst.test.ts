import { describe, expect, it, vi, beforeEach } from "vitest";
import { SubmitBurstLimitError } from "@/lib/generation/submit-rate/assert-submit-burst";

const prismaMocks = vi.hoisted(() => {
  const findUnique = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const transaction = vi.fn();
  return { findUnique, create, update, transaction };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    generationTrafficState: {
      findUnique: prismaMocks.findUnique,
      create: prismaMocks.create,
      update: prismaMocks.update,
    },
    $transaction: prismaMocks.transaction,
  },
}));

vi.mock("@/lib/generation/submit-rate/submit-quota-cache", () => ({
  getCachedSubmitQuota: vi.fn(() => null),
  setCachedSubmitQuota: vi.fn(),
}));

describe("assertSubmitBurstAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        generationTrafficState: {
          findUnique: prismaMocks.findUnique,
          create: prismaMocks.create,
          update: prismaMocks.update,
        },
      };
      await fn(tx);
    });
  });

  it("creates state on first request when missing", async () => {
    prismaMocks.findUnique.mockResolvedValue(null);
    prismaMocks.create.mockResolvedValue({});

    const { assertSubmitBurstAllowed } = await import(
      "@/lib/generation/submit-rate/assert-submit-burst"
    );
    await assertSubmitBurstAllowed("user:u1");

    expect(prismaMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scopeKey: "user:u1",
          submitCount: 1,
        }),
      }),
    );
  });

  it("resets window when expired", async () => {
    const oldStart = new Date(Date.now() - 20_000);
    prismaMocks.findUnique.mockResolvedValue({
      submitCount: 10,
      submitWindowStartAt: oldStart,
      submitWindowSec: 10,
      submitBurstLimit: 10,
      submitTier: "STANDARD",
    });
    prismaMocks.update.mockResolvedValue({});

    const { assertSubmitBurstAllowed } = await import(
      "@/lib/generation/submit-rate/assert-submit-burst"
    );
    await assertSubmitBurstAllowed("user:u1");

    expect(prismaMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { submitCount: 1, submitWindowStartAt: expect.any(Date) },
      }),
    );
  });

  it("throws SubmitBurstLimitError when at limit", async () => {
    const windowStart = new Date(Date.now() - 1000);
    prismaMocks.findUnique.mockResolvedValue({
      submitCount: 10,
      submitWindowStartAt: windowStart,
      submitWindowSec: 10,
      submitBurstLimit: 10,
      submitTier: "STANDARD",
    });

    const { assertSubmitBurstAllowed } = await import(
      "@/lib/generation/submit-rate/assert-submit-burst"
    );

    await expect(assertSubmitBurstAllowed("user:u1")).rejects.toBeInstanceOf(
      SubmitBurstLimitError,
    );
  });

  it("increments count when under limit", async () => {
    const windowStart = new Date(Date.now() - 1000);
    prismaMocks.findUnique.mockResolvedValue({
      submitCount: 3,
      submitWindowStartAt: windowStart,
      submitWindowSec: 10,
      submitBurstLimit: 10,
      submitTier: "STANDARD",
    });
    prismaMocks.update.mockResolvedValue({});

    const { assertSubmitBurstAllowed } = await import(
      "@/lib/generation/submit-rate/assert-submit-burst"
    );
    await assertSubmitBurstAllowed("user:u1");

    expect(prismaMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { submitCount: { increment: 1 } },
      }),
    );
  });
});

describe("SubmitBurstLimitError", () => {
  it("includes tier and retry hint in message", () => {
    const err = new SubmitBurstLimitError({
      retryAfterSec: 5,
      tier: "ELEVATED",
      limit: 15,
    });
    expect(err.message).toContain("5");
    expect(err.message).toContain("中度");
    expect(err.message).toContain("15");
  });
});
