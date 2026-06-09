import { describe, expect, it } from "vitest";

import { evaluateAlerts, type PnlMetrics } from "@/lib/billing/pnl-alerts";

function metrics(partial: Partial<PnlMetrics>): PnlMetrics {
  return {
    periodKey: "2026-06",
    blendedMargin: 0.78,
    videoMargin: 0.76,
    todayVideoCostYuan: 100,
    yesterdayVideoCostYuan: 100,
    dailyVideoCostMoMRate: 0,
    lossRate: 0.02,
    ...partial,
  };
}

describe("evaluateAlerts — 多级盈亏预警阈值（Phase 5）", () => {
  it("各项健康 → 无预警", () => {
    expect(evaluateAlerts(metrics({}))).toHaveLength(0);
  });

  it("综合毛利 < 75% → 预警；跌破 70% → CRITICAL", () => {
    expect(evaluateAlerts(metrics({ blendedMargin: 0.74 }))[0]).toMatchObject({
      code: "BLENDED_MARGIN",
      level: "WARN",
    });
    expect(evaluateAlerts(metrics({ blendedMargin: 0.69 }))[0]).toMatchObject({
      code: "BLENDED_MARGIN",
      level: "CRITICAL",
    });
  });

  it("视频毛利 < 70% → 预警；跌破 65% → CRITICAL", () => {
    expect(evaluateAlerts(metrics({ videoMargin: 0.69 }))[0]).toMatchObject({
      code: "VIDEO_MARGIN",
      level: "WARN",
    });
    expect(evaluateAlerts(metrics({ videoMargin: 0.64 }))[0]).toMatchObject({
      code: "VIDEO_MARGIN",
      level: "CRITICAL",
    });
  });

  it("单日视频成本环比 +50% → 预警；翻倍 → CRITICAL", () => {
    expect(evaluateAlerts(metrics({ dailyVideoCostMoMRate: 0.6 }))[0]).toMatchObject({
      code: "DAILY_VIDEO_COST_SPIKE",
      level: "WARN",
    });
    expect(evaluateAlerts(metrics({ dailyVideoCostMoMRate: 1.2 }))[0]).toMatchObject({
      code: "DAILY_VIDEO_COST_SPIKE",
      level: "CRITICAL",
    });
  });

  it("积分损耗率 > 15% → 预警；> 30% → CRITICAL", () => {
    expect(evaluateAlerts(metrics({ lossRate: 0.2 }))[0]).toMatchObject({
      code: "LOSS_RATE",
      level: "WARN",
    });
    expect(evaluateAlerts(metrics({ lossRate: 0.35 }))[0]).toMatchObject({
      code: "LOSS_RATE",
      level: "CRITICAL",
    });
  });

  it("null 指标不触发", () => {
    expect(
      evaluateAlerts(
        metrics({ blendedMargin: null, videoMargin: null, dailyVideoCostMoMRate: null, lossRate: null }),
      ),
    ).toHaveLength(0);
  });
});
