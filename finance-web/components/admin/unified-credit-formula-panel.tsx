"use client";

import type { UnifiedFormulaSimulation } from "@/lib/unified-credit-formula-types";

function marginClass(ok: boolean): string {
  return ok ? "text-green-600" : "text-red-500";
}

export function UnifiedCreditFormulaPanel({ simulation }: { simulation: UnifiedFormulaSimulation }) {
  const anchor = simulation.models.find((m) => m.canonicalModelKey === simulation.anchorModelKey);

  return (
    <section className="space-y-4 rounded border border-[#e8e8e8] bg-white p-4">
      <div>
        <h2 className="text-sm font-medium">单积分统一计价公式 v{simulation.version}</h2>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          人人扣分相同（U₀）；价差仅在积分购入单价 ppc。锚定测算模型：
          <span className="font-mono text-[#595959]"> {simulation.anchorModelKey}</span>
          {anchor?.chargeCredits15s != null ? ` · 15s 扣 ${anchor.chargeCredits15s} 积分` : null}
        </p>
      </div>

      <pre className="overflow-x-auto rounded bg-[#fafafa] p-3 text-xs leading-relaxed text-[#595959]">
        {simulation.formulaLines.join("\n")}
      </pre>

      <div className="overflow-x-auto">
        <h3 className="mb-2 text-xs font-medium text-[#595959]">多厂商模型挂牌测算</h3>
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-[#fafafa] text-[#8c8c8c]">
            <tr>
              <th className="px-2 py-1.5">厂商</th>
              <th className="px-2 py-1.5">模型</th>
              <th className="px-2 py-1.5 text-right">C</th>
              <th className="px-2 py-1.5 text-right">M</th>
              <th className="px-2 py-1.5 text-right">P</th>
              <th className="px-2 py-1.5 text-right">U₀</th>
              <th className="px-2 py-1.5 text-right">15s扣分</th>
              <th className="px-2 py-1.5 text-right">锚定毛利</th>
            </tr>
          </thead>
          <tbody>
            {simulation.models.map((m) => (
              <tr key={m.canonicalModelKey} className="border-t">
                <td className="px-2 py-1.5">{m.vendor}</td>
                <td className="px-2 py-1.5 font-mono">{m.canonicalModelKey}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">¥{m.netCostYuan.toFixed(4)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{m.marginM.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">¥{m.listPriceYuan.toFixed(4)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{m.creditsPerUnit}</td>
                <td className="px-2 py-1.5 text-right tabular-nums font-medium text-[#1890ff]">
                  {m.chargeCredits15s ?? "—"}
                </td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${marginClass(m.marginOk)}`}>
                  {(m.baseMarginRate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SkuMarginTable title="订阅月付 · Seedance 15s 单笔毛利" rows={simulation.subscriptionSkus} />
      <SkuMarginTable title="App 轻量包 · 单笔毛利" rows={simulation.topupSkus} />
      <SkuMarginTable title="API 充值 · 单笔毛利" rows={simulation.apiSkus} />
    </section>
  );
}

function SkuMarginTable({
  title,
  rows,
}: {
  title: string;
  rows: UnifiedFormulaSimulation["subscriptionSkus"];
}) {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-2 text-xs font-medium text-[#595959]">{title}</h3>
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-[#fafafa] text-[#8c8c8c]">
          <tr>
            <th className="px-2 py-1.5">SKU</th>
            <th className="px-2 py-1.5 text-right">售价</th>
            <th className="px-2 py-1.5 text-right">积分</th>
            <th className="px-2 py-1.5 text-right">ppc</th>
            <th className="px-2 py-1.5 text-right">扣分</th>
            <th className="px-2 py-1.5 text-right">实收</th>
            <th className="px-2 py-1.5 text-right">成本</th>
            <th className="px-2 py-1.5 text-right">毛利</th>
            <th className="px-2 py-1.5 text-right">约条/包</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.skuId} className="border-t">
              <td className="px-2 py-1.5">{r.label}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">¥{r.priceYuan}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.credits.toLocaleString("zh-CN")}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.pricePerCreditYuan.toFixed(4)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.chargeCredits}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">¥{r.revenueYuan.toFixed(2)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">¥{r.netCostYuan.toFixed(2)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${marginClass(r.marginOk)}`}>
                {(r.marginRate * 100).toFixed(1)}%
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.maxGenerations}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
