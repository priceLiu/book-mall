import Link from "next/link";

import type { MarginProjectionPayload } from "@/lib/billing/margin-projection";

const SOURCE_LABEL: Record<string, string> = {
  live: "会员套餐库",
  seed: "种子回退",
  published: "已发布报价",
  "cost-profile": "成本档挂牌",
};

function yuan(n: number): string {
  return `¥${n.toFixed(2)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function countLabel(unit: "PER_IMAGE" | "PER_SEC", units: number): string {
  return unit === "PER_IMAGE" ? "张图" : `${units} 秒视频`;
}

export function MarginProjectionView({ data }: { data: MarginProjectionPayload }) {
  const teamSeats = data.dimensions.find((d) => d.id === "team-month-seats")?.seats ?? 3;

  return (
    <div className="flex w-full flex-col gap-5">
      <header>
        <h1 className="text-lg font-semibold text-[#1f2328]">毛利测算</h1>
        <p className="mt-1 text-sm text-[#656d76]">
          个人 / 团队 × 月付 / 年付各 4 档，另加积分购买包。团队按 {teamSeats}{" "}
          席测算。本页成本只按厂商挂牌原价。公式 v{data.formulaVersion}。
        </p>
      </header>

      <section className="rounded-lg border border-[#d0e3ff] bg-[#f0f6ff] p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">怎么读下面的表</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-[#1f2328]">
          {data.howToRead.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-[#656d76]">
          举例：个人标准档实收 ¥69、860 积分，只打 Wan 3.0（15 秒）。一条挂牌成本 ¥9、扣 450 分，能打{" "}
          <strong>1 条</strong>，厂商成本 ¥9，整月毛利 <strong>¥60</strong>（69 − 9）。
        </p>
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">测算维度</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.dimensions.map((dim) => (
            <div key={dim.id} className="rounded-md border border-[#d0d7de] bg-[#f6f8fa] p-3">
              <p className="text-sm font-medium text-[#1f2328]">{dim.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#656d76]">{dim.description}</p>
              <p className="mt-2 text-xs text-[#656d76]">
                套餐来源：{SOURCE_LABEL[dim.planSource] ?? dim.planSource}
                {" · "}
                <Link href="/admin/finance/membership-plans" className="text-[#0969da] hover:underline">
                  会员套餐
                </Link>
              </p>
            </div>
          ))}
        </div>
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-[#656d76]">
          {data.assumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-[#d0d7de] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1f2328]">计算公式</h2>
        <p className="mt-1 text-xs text-[#656d76]">
          现网实际扣分：C = 挂牌 × (1 − 渠道折扣)，P = C × M，U₀ = round2(P ÷ 0.03)。本页测算按挂牌、折扣当
          0，用来看「不打折时」能出多少。
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-[#f6f8fa] p-3 text-xs leading-relaxed text-[#656d76]">
          {data.formulaLines.join("\n")}
        </pre>
      </section>

      <section className="overflow-x-auto rounded-lg border border-[#d0d7de] bg-white">
        <div className="border-b border-[#d0d7de] px-3 py-2">
          <h2 className="text-sm font-semibold text-[#1f2328]">一次生成花多少（挂牌口径）</h2>
        </div>
        <table className="w-full min-w-[800px] text-left text-xs">
          <thead className="bg-[#f6f8fa] text-[#656d76]">
            <tr>
              <th className="px-3 py-2">模型</th>
              <th className="px-3 py-2">来源</th>
              <th className="px-3 py-2 text-right">挂牌 C</th>
              <th className="px-3 py-2 text-right">M</th>
              <th className="px-3 py-2 text-right">用户挂牌 P</th>
              <th className="px-3 py-2 text-right">一次扣分</th>
              <th className="px-3 py-2 text-right">一次厂商成本</th>
            </tr>
          </thead>
          <tbody>
            {data.models.map((m) => (
              <tr key={m.id} className="border-t border-[#d0d7de]">
                <td className="px-3 py-2">
                  <p className="font-medium text-[#1f2328]">{m.label}</p>
                  <p className="font-mono text-[11px] text-[#656d76]">{m.canonicalModelKey}</p>
                  {m.note ? <p className="mt-1 max-w-md text-[11px] leading-relaxed text-[#656d76]">{m.note}</p> : null}
                </td>
                <td className="px-3 py-2 text-[#656d76]">{SOURCE_LABEL[m.source] ?? m.source}</td>
                <td className="px-3 py-2 text-right tabular-nums">¥{m.listCostYuan.toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{m.marginM.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">¥{m.listPriceYuan.toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-[#0969da]">{m.chargeCredits}</td>
                <td className="px-3 py-2 text-right tabular-nums">{yuan(m.clipCostYuan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.dimensions.map((dim) => (
        <section key={dim.id} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1f2328]">{dim.title}</h2>
            <p className="mt-0.5 text-xs text-[#656d76]">{dim.description} 每个模型一张表，互斥情景。</p>
          </div>
          {data.models.map((model) => (
            <div key={`${dim.id}-${model.id}`} className="overflow-x-auto rounded-lg border border-[#d0d7de] bg-white">
              <div className="border-b border-[#d0d7de] px-3 py-2">
                <h3 className="text-sm font-medium text-[#1f2328]">
                  {dim.title} · 只打 {model.label}
                </h3>
                <p className="mt-0.5 text-xs text-[#656d76]">
                  一次 {countLabel(model.unit, model.units)}，扣 {model.chargeCredits} 分，厂商挂牌成本{" "}
                  {yuan(model.clipCostYuan)}。
                </p>
              </div>
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-[#f6f8fa] text-[#656d76]">
                  <tr>
                    <th className="px-3 py-2">档位</th>
                    <th className="px-3 py-2 text-right">套餐实收</th>
                    <th className="px-3 py-2 text-right">积分池</th>
                    <th className="px-3 py-2 text-right">能生成</th>
                    <th className="px-3 py-2 text-right">厂商成本</th>
                    <th className="px-3 py-2 text-right">整月毛利</th>
                    <th className="px-3 py-2 text-right">毛利率</th>
                    <th className="px-3 py-2 text-right">剩余积分</th>
                  </tr>
                </thead>
                <tbody>
                  {dim.rows.map((row) => {
                    const cell = row.cells.find((c) => c.modelId === model.id);
                    if (!cell) {
                      return (
                        <tr key={`${dim.id}-${model.id}-${row.tier}`} className="border-t border-[#d0d7de]">
                          <td className="px-3 py-2">{row.tier}</td>
                          <td colSpan={7} className="px-3 py-2 text-[#8c959f]">
                            无测算
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={`${dim.id}-${model.id}-${row.tier}`} className="border-t border-[#d0d7de]">
                        <td className="px-3 py-2 font-medium text-[#1f2328]">{row.tier}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{yuan(row.priceYuan)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.creditsPool.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-[#1f2328]">
                          {cell.generations.toLocaleString()} {countLabel(model.unit, model.units)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{yuan(cell.vendorCostYuan)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium text-[#1a7f37]">
                          {yuan(cell.monthProfitYuan)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{pct(cell.monthMarginRate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-[#656d76]">
                          {cell.leftoverCredits.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
