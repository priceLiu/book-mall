import { describe, expect, it } from "vitest";

import {
  BYOK_PLATFORM_COST_ESTIMATE_YUAN,
  BYOK_SCOPE_PERSONAL,
  DEFAULT_BYOK_QUOTAS,
  buildByokIncludedUsageFromQuotas,
  hasVideoAttachmentInChatInput,
  mapLogToByokTaskKind,
  normalizeByokFeeDescription,
  normalizeByokQuotaSettlementSnapshot,
  simulateByokMonth,
} from "@/lib/billing/byok-pricing";
import { DEFAULT_CREDIT_ANCHOR_YUAN } from "@/lib/pricing/credit-pricing-formulas";

describe("mapLogToByokTaskKind — 七类映射", () => {
  it("IMAGE / TRYON → 文生图", () => {
    expect(mapLogToByokTaskKind({ requestKind: "IMAGE" })).toBe("TEXT_TO_IMAGE");
    expect(mapLogToByokTaskKind({ requestKind: "TRYON" })).toBe("TEXT_TO_IMAGE");
  });

  it("TTS → TTS", () => {
    expect(mapLogToByokTaskKind({ requestKind: "TTS" })).toBe("TTS");
  });

  it("CHAT + video_url → 视频理解；纯 CHAT → null", () => {
    const withVideo = {
      requestKind: "CHAT",
      inputSummary: {
        model: "qwen3-vl-plus",
        input: {
          messages: [
            {
              role: "user",
              content: [{ type: "video_url", video_url: { url: "data:video/mp4;base64,abc" } }],
            },
          ],
        },
      },
    };
    expect(mapLogToByokTaskKind(withVideo)).toBe("VIDEO_UNDERSTANDING");
    expect(hasVideoAttachmentInChatInput(withVideo.inputSummary)).toBe(true);
    expect(mapLogToByokTaskKind({ requestKind: "CHAT", inputSummary: { input: { messages: [] } } })).toBeNull();
  });

  it("VIDEO i2v vs v2v", () => {
    expect(mapLogToByokTaskKind({ requestKind: "VIDEO" })).toBe("IMAGE_TO_VIDEO");
    expect(
      mapLogToByokTaskKind({
        requestKind: "VIDEO",
        inputSummary: { mode: "v2v" },
      }),
    ).toBe("VIDEO_TO_VIDEO");
  });
});

describe("simulateByokMonth — BYOK 权益测算", () => {
  const personalQuotas = DEFAULT_BYOK_QUOTAS.filter((q) => q.scopeKey === BYOK_SCOPE_PERSONAL).map((q) => ({
    taskKind: q.taskKind,
    monthlyIncluded: q.monthlyIncluded,
    overageCredits: q.overageCredits,
  }));

  it("文生图含次 130 = 原 100+30 合并", () => {
    const t2i = personalQuotas.find((q) => q.taskKind === "TEXT_TO_IMAGE");
    expect(t2i?.monthlyIncluded).toBe(130);
  });

  it("套餐内用满：平台成本低于月费", () => {
    const report = simulateByokMonth({
      scopeKey: BYOK_SCOPE_PERSONAL,
      techServiceFeeYuan: 69,
      quotas: personalQuotas,
      usage: buildByokIncludedUsageFromQuotas(personalQuotas, 1),
    });
    expect(report.platformCostYuan).toBeLessThan(report.techFeeYuan);
    expect(report.overageCredits).toBe(0);
  });

  it("各任务超额单次毛利 ≥ 60%", () => {
    for (const q of personalQuotas) {
      const platformCost = BYOK_PLATFORM_COST_ESTIMATE_YUAN[q.taskKind];
      const overageYuan = q.overageCredits * DEFAULT_CREDIT_ANCHOR_YUAN;
      const margin = (overageYuan - platformCost) / overageYuan;
      expect(margin).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("超额示例有正毛利", () => {
    const included = buildByokIncludedUsageFromQuotas(personalQuotas, 1);
    const report = simulateByokMonth({
      scopeKey: BYOK_SCOPE_PERSONAL,
      techServiceFeeYuan: 69,
      quotas: personalQuotas,
      usage: {
        TEXT_TO_IMAGE: (included.TEXT_TO_IMAGE ?? 0) + 30,
        IMAGE_TO_VIDEO: (included.IMAGE_TO_VIDEO ?? 0) + 10,
        VIDEO_TO_VIDEO: (included.VIDEO_TO_VIDEO ?? 0) + 5,
        VIDEO_UNDERSTANDING: (included.VIDEO_UNDERSTANDING ?? 0) + 10,
        TTS: (included.TTS ?? 0) + 10,
      },
    });
    expect(report.overageCredits).toBeGreaterThan(0);
    expect(report.marginRate).toBeGreaterThan(0);
  });
});

describe("normalizeByokQuotaSettlementSnapshot — 试衣并入文生图", () => {
  it("corrects stale personal TRYON limit 30 → 130", () => {
    const snap = normalizeByokQuotaSettlementSnapshot({
      byokTaskKind: "TEXT_TO_IMAGE",
      ownerType: "USER",
      monthlyIncluded: 30,
      includedUsedAfter: 1,
      includedRemainingAfter: 29,
    });
    expect(snap.corrected).toBe(true);
    expect(snap.monthlyIncluded).toBe(130);
    expect(snap.includedRemainingAfter).toBe(129);
  });

  it("rewrites legacy AI试衣 fee description remaining", () => {
    const text = normalizeByokFeeDescription(
      "BYOK 套餐内 · AI试衣 -1, 套餐剩余 29",
      true,
      129,
    );
    expect(text).toContain("文生图（含试衣）");
    expect(text).toContain("套餐剩余 129");
    expect(text).not.toContain("AI试衣");
  });
});
