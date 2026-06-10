import { describe, expect, it, vi, beforeEach } from "vitest";

import type { GatewayRequestLog } from "@prisma/client";

const { findUniqueMock, transactionMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    billingSettlementLine: {
      findUnique: findUniqueMock,
    },
    $transaction: transactionMock,
  },
}));

import { recordBillingSettlement } from "@/lib/billing/billing-settlement-service";

function fakeLog(overrides: Partial<GatewayRequestLog> = {}): GatewayRequestLog {
  return {
    id: "log-platform-1",
    userId: "gw-user",
    apiKeyId: "key-1",
    credentialId: null,
    providerKind: "BAILIAN",
    model: "aitryon",
    endpoint: "/v1/images",
    requestKind: "TRYON",
    status: "SUCCEEDED",
    externalTaskId: null,
    clientSource: "INTERNAL",
    clientPage: "/fitting-room",
    storyProjectId: null,
    storyTaskId: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    hasTokenUsage: false,
    metricsSource: "UNAVAILABLE",
    durationMs: null,
    vendorDurationMs: null,
    pricingModelKey: null,
    pricingTierRaw: null,
    billingKind: null,
    vendorListUnitCostYuan: null,
    estimatedVendorCostYuan: null,
    billingMode: "PLATFORM_CREDIT",
    canonicalModelKey: "aitryon",
    creditsCharged: 40,
    costSnapshotYuan: null,
    marginSnapshot: null,
    seatId: null,
    tenantId: null,
    actorBookUserId: "book-user-1",
    credentialAliasSnapshot: null,
    channelSnapshot: null,
    staffFlag: false,
    billingPersonaSnap: "PLATFORM_CREDIT",
    settlementKind: null,
    byokTaskKind: null,
    billingCategory: null,
    quotaDelta: null,
    includedUsedAfter: null,
    includedRemainingAfter: null,
    inputSummary: null,
    resultSummary: null,
    failCode: null,
    failMessage: null,
    submittedAt: new Date("2026-06-15T08:00:00.000Z"),
    completedAt: new Date("2026-06-15T08:00:01.000Z"),
    lastPolledAt: null,
    pollCount: 0,
    createdAt: new Date("2026-06-15T08:00:00.000Z"),
    updatedAt: new Date("2026-06-15T08:00:01.000Z"),
    ...overrides,
  } as GatewayRequestLog;
}

describe("recordBillingSettlement — platform billingCategory", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    transactionMock.mockReset();
    findUniqueMock.mockResolvedValue(null);
    transactionMock.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        billingSettlementLine: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "line-1",
            ...data,
          })),
        },
        gatewayRequestLog: {
          update: vi.fn(async () => ({})),
        },
      };
      return fn(tx);
    });
  });

  it("writes TEXT_TO_IMAGE for TRYON platform settlement", async () => {
    const log = fakeLog();
    const line = await recordBillingSettlement({
      log,
      ref: { ownerType: "USER", ownerId: "book-user-1" },
      settlementKind: "PLATFORM_CREDIT",
      creditsCharged: 40,
      creditLedgerId: "ledger-1",
    });

    expect(line.billingCategory).toBe("TEXT_TO_IMAGE");
    expect(line.feeDescription).toContain("文生图（含试衣）");
    expect(line.feeDescription).toContain("40");
  });

  it("writes TEXT for pure CHAT METER_ONLY", async () => {
    const log = fakeLog({ requestKind: "CHAT", model: "qwen-turbo", canonicalModelKey: "qwen-turbo" });
    const line = await recordBillingSettlement({
      log,
      ref: { ownerType: "USER", ownerId: "book-user-1" },
      settlementKind: "METER_ONLY",
      creditsCharged: 0,
    });

    expect(line.billingCategory).toBe("TEXT");
  });

  it("writes parsing tryon label and input units for aitryon-parsing-v1", async () => {
    const log = fakeLog({
      model: "aitryon-parsing-v1",
      canonicalModelKey: "aitryon-parsing-v1",
      clientPage: "canvas/story-pro/parse-outfit",
      inputSummary: {
        model: "aitryon-parsing-v1",
        input: { imageUrl: "https://x/a.jpg", imageCount: 1 },
      },
    });
    const line = await recordBillingSettlement({
      log,
      ref: { ownerType: "USER", ownerId: "book-user-1" },
      settlementKind: "PLATFORM_CREDIT",
      creditsCharged: 1,
      creditLedgerId: "ledger-parsing",
    });

    expect(line.tryonModelKey).toBe("aitryon-parsing-v1");
    expect(line.feeDescription).toContain("AI试衣·图片分割");
    expect(line.feeDescription).toContain("1 张输入");
    expect(line.feeDescription).toContain("1 积分");
  });
});
