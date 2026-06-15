"use client";

import { useState } from "react";

type SimRow = {
  tier: string;
  pricePerCreditYuan: number;
  creditsPerGen: number;
  revenueYuan: number;
  costYuan: number;
  marginRate: number;
  gensPerMonth: number;
  monthlyCostCeilingYuan: number;
  monthlyCostCeilingRate: number;
  marginPassed: boolean;
};

type SimulationReport = {
  model?: string;
  guard?: number;
  baseCostYuan?: number;
  allPassed?: boolean;
  worstMargin?: number;
  rows?: SimRow[];
};

type RevenueSim = {
  totalRevenueYuan: number;
  totalCostCeilingYuan: number;
  blendedMargin: number;
  byTier: { tier: string; revenueYuan: number; costCeilingYuan: number }[];
};

type SimulationBundle = {
  report?: SimulationReport;
  revenue?: RevenueSim | null;
  videoMarginM?: number;
  guard?: number;
  units?: number;
};

type ReverseModeA = {
  mode: "TARGET_MARGIN";
  requiredMarginM?: number;
  requiredListPriceYuan?: number;
  requiredCreditsByTier?: { tier: string; creditsPerGen: number }[];
  passed?: boolean;
  note?: string;
};

type ReverseModeB = {
  mode: "BREAK_EVEN";
  breakEven?: {
    tier: string;
    breakEvenCredits: number;
    currentCredits: number;
    safetyRatio: number;
    safe: boolean;
  }[];
  passed?: boolean;
  note?: string;
};

type ReverseCheck = {
  modeA?: ReverseModeA;
  modeB?: ReverseModeB;
};

const TABS = [
  { id: "base", label: "基础成本" },
  { id: "credits", label: "扣费变动" },
  { id: "margin", label: "毛利校验" },
  { id: "ceiling", label: "成本上限" },
  { id: "revenue", label: "营收模拟" },
  { id: "impact", label: "用户影响" },
  { id: "reverse", label: "反向验算" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function PlanChangeSimulationPanel({
  simulation,
  reverseCheck,
}: {
  simulation: SimulationBundle | SimulationReport | null;
  reverseCheck: ReverseCheck | null;
}) {
  const [tab, setTab] = useState<TabId>("margin");

  const bundle: SimulationBundle =
    simulation && "report" in simulation && simulation.report
      ? (simulation as SimulationBundle)
      : { report: simulation as SimulationReport | undefined };

  const report = bundle.report;
  const rows = report?.rows ?? [];

  if (!rows.length) {
    return <p className="text-sm text-[#8c8c8c]">暂无测算结果，请先运行 simulate。</p>;
  }

  const guard = bundle.guard ?? report?.guard ?? 0;
  const effectiveGuard = guard - 0.002;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              tab === t.id
                ? "border border-[#1890ff] bg-[#e6f7ff] text-[#1890ff]"
                : "border border-[#e8e8e8] text-[#595959] hover:border-[#1890ff]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-[#8c8c8c]">
        模型 {report?.model ?? "—"} · M={bundle.videoMarginM ?? "—"} · {bundle.units ?? 15}s · 护栏{" "}
        {pct(guard)}（含 0.2% 容差有效 {pct(effectiveGuard)}）· 单次成本 ¥
        {report?.baseCostYuan?.toFixed(2) ?? "—"} ·{" "}
        {report?.allPassed ? (
          <span className="text-green-600">全档通过</span>
        ) : (
          <span className="text-red-600">存在未通过档位（最低 {pct(report?.worstMargin ?? 0)}）</span>
        )}
      </p>

      {tab === "base" ? (
        <section className="rounded border border-[#f0f0f0] bg-[#fafafa] p-3 text-sm">
          <h3 className="mb-2 text-xs font-medium text-[#595959]">维度 1 · 套餐基础成本测算</h3>
          <ul className="space-y-1 text-xs text-[#595959]">
            <li>
              代表性模型：<strong className="text-[#262626]">{report?.model}</strong>
            </li>
            <li>
              计费单位：<strong className="text-[#262626]">{bundle.units ?? 15} 秒/次</strong>（视频封顶）
            </li>
            <li>
              单次厂商净成本：<strong className="text-[#262626]">¥{report?.baseCostYuan?.toFixed(4)}</strong>
            </li>
            <li>
              视频系数 M：<strong className="text-[#262626]">{bundle.videoMarginM ?? 1.5}</strong>（贵视频 1.0 / 普通 1.5）
            </li>
          </ul>
        </section>
      ) : null}

      {tab === "credits" ? (
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-2 py-1 text-left">档位</th>
              <th className="px-2 py-1 text-right">单价（元/积分）</th>
              <th className="px-2 py-1 text-right">拟定扣分/次</th>
              <th className="px-2 py-1 text-right">单次实收</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tier} className="border-t">
                <td className="px-2 py-1">{r.tier}</td>
                <td className="px-2 py-1 text-right">¥{r.pricePerCreditYuan.toFixed(5)}</td>
                <td className="px-2 py-1 text-right font-medium">{r.creditsPerGen}</td>
                <td className="px-2 py-1 text-right">¥{r.revenueYuan.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {tab === "margin" ? (
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-2 py-1 text-left">档位</th>
              <th className="px-2 py-1 text-right">扣分</th>
              <th className="px-2 py-1 text-right">实收</th>
              <th className="px-2 py-1 text-right">成本</th>
              <th className="px-2 py-1 text-right">毛利</th>
              <th className="px-2 py-1 text-right">校验</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tier} className="border-t">
                <td className="px-2 py-1">{r.tier}</td>
                <td className="px-2 py-1 text-right">{r.creditsPerGen}</td>
                <td className="px-2 py-1 text-right">¥{r.revenueYuan.toFixed(2)}</td>
                <td className="px-2 py-1 text-right">¥{r.costYuan.toFixed(2)}</td>
                <td className={`px-2 py-1 text-right ${r.marginPassed ? "" : "text-red-600"}`}>
                  {pct(r.marginRate)}
                </td>
                <td className="px-2 py-1 text-right text-xs">
                  {r.marginPassed ? (
                    <span className="text-green-600">通过</span>
                  ) : (
                    <span className="text-red-600">未过</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {tab === "ceiling" ? (
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-2 py-1 text-left">档位</th>
              <th className="px-2 py-1 text-right">月可生成次数</th>
              <th className="px-2 py-1 text-right">月度成本上限</th>
              <th className="px-2 py-1 text-right">占套餐价比</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tier} className="border-t">
                <td className="px-2 py-1">{r.tier}</td>
                <td className="px-2 py-1 text-right">{r.gensPerMonth}</td>
                <td className="px-2 py-1 text-right">¥{r.monthlyCostCeilingYuan.toFixed(2)}</td>
                <td className="px-2 py-1 text-right">{pct(r.monthlyCostCeilingRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {tab === "revenue" ? (
        bundle.revenue ? (
          <div className="space-y-2">
            <p className="text-xs text-[#8c8c8c]">
              合计营收 ¥{bundle.revenue.totalRevenueYuan.toFixed(2)} · 成本上限 ¥
              {bundle.revenue.totalCostCeilingYuan.toFixed(2)} · 综合毛利 {pct(bundle.revenue.blendedMargin)}
            </p>
            <table className="w-full text-sm">
              <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
                <tr>
                  <th className="px-2 py-1 text-left">档位</th>
                  <th className="px-2 py-1 text-right">订阅营收</th>
                  <th className="px-2 py-1 text-right">成本上限</th>
                </tr>
              </thead>
              <tbody>
                {bundle.revenue.byTier.map((r) => (
                  <tr key={r.tier} className="border-t">
                    <td className="px-2 py-1">{r.tier}</td>
                    <td className="px-2 py-1 text-right">¥{r.revenueYuan.toFixed(2)}</td>
                    <td className="px-2 py-1 text-right">¥{r.costCeilingYuan.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#8c8c8c]">
            未配置订阅量场景。创建提案时在 payload 中传入 scenarios 后可在此查看营收模拟。
          </p>
        )
      ) : null}

      {tab === "impact" ? (
        <table className="w-full text-sm">
          <thead className="bg-[#fafafa] text-xs text-[#8c8c8c]">
            <tr>
              <th className="px-2 py-1 text-left">档位</th>
              <th className="px-2 py-1 text-right">月积分</th>
              <th className="px-2 py-1 text-right">扣分/次</th>
              <th className="px-2 py-1 text-right">月可生成</th>
              <th className="px-2 py-1 text-right">用户侧单次实收</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tier} className="border-t">
                <td className="px-2 py-1">{r.tier}</td>
                <td className="px-2 py-1 text-right">—</td>
                <td className="px-2 py-1 text-right">{r.creditsPerGen}</td>
                <td className="px-2 py-1 text-right">{r.gensPerMonth}</td>
                <td className="px-2 py-1 text-right">¥{r.revenueYuan.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {tab === "reverse" ? (
        <div className="space-y-3 text-sm">
          {reverseCheck?.modeA ? (
            <section className="rounded border border-[#f0f0f0] p-3">
              <h3 className="mb-1 text-xs font-medium text-[#595959]">模式 A · 目标毛利反推定价</h3>
              <p className="text-xs text-[#8c8c8c]">{reverseCheck.modeA.note}</p>
              {reverseCheck.modeA.requiredCreditsByTier?.length ? (
                <table className="mt-2 w-full text-xs">
                  <thead className="text-[#8c8c8c]">
                    <tr>
                      <th className="py-1 text-left">档位</th>
                      <th className="py-1 text-right">所需扣分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reverseCheck.modeA.requiredCreditsByTier.map((r) => (
                      <tr key={r.tier} className="border-t">
                        <td className="py-1">{r.tier}</td>
                        <td className="py-1 text-right">{r.creditsPerGen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>
          ) : null}
          {reverseCheck?.modeB ? (
            <section className="rounded border border-[#f0f0f0] p-3">
              <h3 className="mb-1 text-xs font-medium text-[#595959]">
                模式 B · 保本线核验{" "}
                {reverseCheck.modeB.passed ? (
                  <span className="text-green-600">通过</span>
                ) : (
                  <span className="text-red-600">未通过</span>
                )}
              </h3>
              <p className="text-xs text-[#8c8c8c]">{reverseCheck.modeB.note}</p>
              {reverseCheck.modeB.breakEven?.length ? (
                <table className="mt-2 w-full text-xs">
                  <thead className="text-[#8c8c8c]">
                    <tr>
                      <th className="py-1 text-left">档位</th>
                      <th className="py-1 text-right">保本扣分</th>
                      <th className="px-2 py-1 text-right">当前扣分</th>
                      <th className="py-1 text-right">安全垫</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reverseCheck.modeB.breakEven.map((r) => (
                      <tr key={r.tier} className="border-t">
                        <td className="py-1">{r.tier}</td>
                        <td className="py-1 text-right">{r.breakEvenCredits}</td>
                        <td className="px-2 py-1 text-right">{r.currentCredits}</td>
                        <td className={`py-1 text-right ${r.safe ? "text-green-600" : "text-red-600"}`}>
                          {r.safetyRatio.toFixed(2)}×
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </section>
          ) : null}
          {!reverseCheck?.modeA && !reverseCheck?.modeB ? (
            <p className="text-sm text-[#8c8c8c]">暂无反向验算数据。</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
