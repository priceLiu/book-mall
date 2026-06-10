import { describe, expect, it } from "vitest";

import { K_TASK_KIND } from "@/lib/finance/bill-display-keys";
import { projectGatewayLogToBillRow } from "@/lib/finance/gateway-bill-projection";

const baseLog = {
  id: "log-1",
  model: "aitryon",
  canonicalModelKey: "aitryon",
  requestKind: "TRYON" as const,
  status: "SUCCEEDED" as const,
  clientPage: "/fitting-room/ai-fit",
  billingMode: "PLATFORM_CREDIT" as const,
  billingPersonaSnap: "PLATFORM_CREDIT" as const,
  creditsCharged: 40,
  costSnapshotYuan: null,
  marginSnapshot: null,
  submittedAt: new Date("2026-06-01T12:00:00.000Z"),
  completedAt: null,
  actorBookUserId: "user-1",
  settlementKind: "PLATFORM_CREDIT" as const,
  byokTaskKind: null,
  billingCategory: null,
  quotaDelta: null,
  includedUsedAfter: null,
  includedRemainingAfter: null,
  inputSummary: null,
};

describe("projectGatewayLogToBillRow — 平台代付七类", () => {
  it("TRYON → 文生图（含试衣） on K_TASK_KIND and 平台/请求类型", () => {
    const row = projectGatewayLogToBillRow(
      baseLog,
      "user-1",
      "Test User",
      new Map([["aitryon", "AI 试衣"]]),
      {
      id: "settle-1",
      gatewayLogId: "log-1",
      ownerType: "USER",
      ownerId: "user-1",
      actorBookUserId: "user-1",
      periodKey: "2026-06",
      settlementKind: "PLATFORM_CREDIT",
      byokTaskKind: null,
      billingCategory: "TEXT_TO_IMAGE",
      tryonModelKey: "aitryon",
      quotaDelta: 0,
      monthlyIncluded: null,
      includedUsedAfter: null,
      includedRemainingAfter: null,
      isOverage: false,
      creditsCharged: 40,
      creditLedgerId: null,
      canonicalModelKey: "aitryon",
      requestKind: "TRYON",
      clientPage: "/fitting-room/ai-fit",
      feeDescription: "平台代付 · 文生图（含试衣） · 扣 40 积分",
      submittedAt: baseLog.submittedAt,
      createdAt: baseLog.submittedAt,
    },
    new Map([["aitryon", "aliyun"]]),
    );

    expect(row["平台/厂商"]).toBe("阿里云");
    expect(row[K_TASK_KIND]).toBe("文生图（含试衣）");
    expect(row["平台/请求类型"]).toBe("文生图（含试衣）");
    expect(row["平台账单/费用说明"]).toContain("文生图（含试衣）");
  });

  it("FAILED logs show 调用失败 in 费用说明", () => {
    const row = projectGatewayLogToBillRow(
      {
        ...baseLog,
        status: "FAILED",
        failCode: "VOLCENGINE_TASK_FAILED",
        failMessage: "火山方舟账户欠费或余额不足",
        creditsCharged: 0,
        billingPersonaSnap: "BYOK",
      },
      "user-1",
      "Test User",
      new Map([["aitryon", "AI 试衣"]]),
      null,
    );
    expect(row["平台/状态"]).toBe("失败");
    expect(row["平台账单/费用说明"]).toContain("调用失败");
    expect(row["平台账单/费用说明"]).toContain("欠费");
  });

  it("falls back to classifyBillingCategory when billingCategory null", () => {
    const row = projectGatewayLogToBillRow(
      { ...baseLog, requestKind: "TTS", model: "qwen3-tts-flash", canonicalModelKey: "qwen3-tts-flash" },
      "user-1",
      "Test User",
      new Map(),
      null,
    );
    expect(row[K_TASK_KIND]).toBe("TTS / 语音");
    expect(row["平台/请求类型"]).toBe("TTS / 语音");
  });

  it("platform row K_TASK_KIND is not dash", () => {
    const row = projectGatewayLogToBillRow(baseLog, "user-1", "U", new Map(), null);
    expect(row[K_TASK_KIND]).not.toBe("—");
  });
});
