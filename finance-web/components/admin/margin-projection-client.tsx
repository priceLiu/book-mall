"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";

type ModelQuote = {
  id: string;
  label: string;
  canonicalModelKey: string;
  vendor: string;
  unit: "PER_IMAGE" | "PER_SEC";
  listCostYuan: number;
  discountRate: number;
  netCostYuan: number;
  marginM: number;
  listPriceYuan: number;
  creditsPerUnit: number;
  units: number;
  chargeCredits: number;
  clipCostYuan: number;
  source: "published" | "cost-profile" | "seed";
  computedCreditsPerUnit?: number;
  note?: string;
};

type ProjectionCell = {
  modelId: string;
  generations: number;
  leftoverCredits: number;
  vendorCostYuan: number;
  monthProfitYuan: number;
  monthMarginRate: number;
};

type TierRow = {
  tier: string;
  priceYuan: number;
  monthlyCredits: number;
  creditsPool: number;
  cells: ProjectionCell[];
};

type Dimension = {
  id: string;
  title: string;
  description: string;
  seats: number;
  planSource: "live" | "seed";
  rows: TierRow[];
};

type MarginProjectionPayload = {
  formulaVersion: number;
  formulaLines: string[];
  assumptions: string[];
  howToRead: string[];
  pricing: {
    creditAnchorYuan: number;
    defaultVideoSec: number;
    imageVideoMarginM: number;
    costBasis: "net";
  };
  models: ModelQuote[];
  dimensions: Dimension[];
};

const SOURCE_LABEL: Record<string, string> = {
  live: "会员套餐库",
  seed: "种子回退",
  published: "已发布报价",
  "cost-profile": "成本档（未发布）",
};

function isRepublishNeeded(m: ModelQuote): boolean {
  return (
    m.source === "published" &&
    m.computedCreditsPerUnit != null &&
    Math.abs(m.computedCreditsPerUnit - m.creditsPerUnit) > 0.001
  );
}

function exampleLine(data: MarginProjectionPayload): string | null {
  const dim = data.dimensions.find((d) => d.id === "personal-month");
  const row = dim?.rows[0];
  const model = data.models.find((m) => m.unit === "PER_SEC") ?? data.models[0];
  const cell = model ? row?.cells.find((c) => c.modelId === model.id) : undefined;
  if (!row || !model || !cell) return null;
  return `举例：个人${row.tier}实收 ${yuan(row.priceYuan)}、${row.creditsPool.toLocaleString()} 积分，只打 ${model.label}（${countLabel(model)}）。一次净成本 ${yuan(model.clipCostYuan)}、扣 ${model.chargeCredits} 分，能打 ${cell.generations} 次，厂商成本 ${yuan(cell.vendorCostYuan)}，整月毛利 ${yuan(cell.monthProfitYuan)}（${row.priceYuan} − ${cell.vendorCostYuan}）。`;
}

function yuan(n: number): string {
  return `¥${n.toFixed(2)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function countLabel(model: ModelQuote): string {
  return model.unit === "PER_IMAGE" ? "张图" : `${model.units} 秒视频`;
}

export function MarginProjectionClient() {
  const base = useBookMallBaseUrl();
  const [data, setData] = useState<MarginProjectionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    setError(null);
    const r = await financeApiFetch<MarginProjectionPayload>(base, "/api/finance/admin/margin-projection");
    if (!r.ok) setError(r.error);
    else setData(r.data);
    setLoading(false);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (loading || !data) return <FinancePageState>加载中…</FinancePageState>;

  const teamSeats = data.dimensions.find((d) => d.id === "team-month-seats")?.seats ?? 3;
  const example = exampleLine(data);

  return (
    <FinancePageShell className="gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-[#262626]">毛利测算</h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            个人 / 团队 × 月付 / 年付各 4 档，另加积分购买包。团队按 {teamSeats} 席测算。成本按净成本
            C（挂牌 × (1 − 折扣)），与现网扣分同口径。公式 v{data.formulaVersion}。
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white"
        >
          刷新
        </button>
      </header>

      <section className="rounded border border-[#d6e4ff] bg-[#f0f6ff] p-4">
        <h2 className="text-sm font-medium text-[#262626]">怎么读下面的表</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-[#262626]">
          {(data.howToRead ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        {example ? <p className="mt-3 text-sm text-[#595959]">{example}</p> : null}
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="text-sm font-medium text-[#262626]">测算维度</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.dimensions.map((dim) => (
            <div key={dim.id} className="rounded border border-[#f0f0f0] bg-[#fafafa] p-3">
              <p className="text-sm font-medium text-[#262626]">{dim.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#8c8c8c]">{dim.description}</p>
              <p className="mt-2 text-xs text-[#595959]">
                套餐来源：{SOURCE_LABEL[dim.planSource] ?? dim.planSource}
                {" · "}
                <Link href="/admin/membership-plans" className="text-[#1890ff] hover:underline">
                  会员套餐
                </Link>
              </p>
            </div>
          ))}
        </div>
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-[#8c8c8c]">
          {data.assumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="text-sm font-medium text-[#262626]">计算公式（净成本 C）</h2>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          锚定 ¥{data.pricing.creditAnchorYuan.toFixed(2)}/积分 · 视频默认 {data.pricing.defaultVideoSec}s ·
          图/视频默认 M={data.pricing.imageVideoMarginM}。P 是人民币价，U₀ 才是积分。
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-[#fafafa] p-3 text-xs leading-relaxed text-[#595959]">
          {data.formulaLines.join("\n")}
        </pre>
      </section>

      <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <div className="border-b px-3 py-2">
          <h2 className="text-sm font-medium text-[#262626]">一次生成花多少</h2>
          <p className="mt-0.5 text-xs text-[#8c8c8c]">
            挂牌、折扣、净成本 C 与 M 取自{" "}
            <Link href="/admin/model-cost" className="text-[#1890ff] hover:underline">
              模型成本
            </Link>
            ；U₀ 取已发布报价（现网实扣）。改折扣或 M 后需在{" "}
            <Link href="/admin/credit-pricing" className="text-[#1890ff] hover:underline">
              积分报价
            </Link>{" "}
            重新发布。
          </p>
        </div>
        <table className="w-full min-w-[880px] text-left text-xs">
          <thead className="bg-[#fafafa] text-[#8c8c8c]">
            <tr>
              <th className="px-3 py-2">模型</th>
              <th className="px-3 py-2">来源</th>
              <th className="px-3 py-2 text-right">挂牌</th>
              <th className="px-3 py-2 text-right">折扣</th>
              <th className="px-3 py-2 text-right">净成本 C</th>
              <th className="px-3 py-2 text-right">M</th>
              <th className="px-3 py-2 text-right">P（元）</th>
              <th className="px-3 py-2 text-right">U₀（积分）</th>
              <th className="px-3 py-2 text-right">一次扣分</th>
              <th className="px-3 py-2 text-right">一次厂商成本</th>
            </tr>
          </thead>
          <tbody>
            {data.models.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="px-3 py-2">
                  <p className="font-medium text-[#262626]">{m.label}</p>
                  <p className="font-mono text-[11px] text-[#8c8c8c]">{m.canonicalModelKey}</p>
                  {m.note ? <p className="mt-1 max-w-md text-[11px] leading-relaxed text-[#8c8c8c]">{m.note}</p> : null}
                </td>
                <td className="px-3 py-2 text-[#595959]">{SOURCE_LABEL[m.source] ?? m.source}</td>
                <td className="px-3 py-2 text-right tabular-nums">¥{m.listCostYuan.toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(m.discountRate)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">¥{m.netCostYuan.toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{m.marginM.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">¥{m.listPriceYuan.toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.creditsPerUnit}
                  {isRepublishNeeded(m) ? (
                    <p className="mt-0.5 text-[11px] text-[#d46b08]">
                      按当前成本档应为 {m.computedCreditsPerUnit}，待重新发布
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-[#1890ff]">{m.chargeCredits}</td>
                <td className="px-3 py-2 text-right tabular-nums">{yuan(m.clipCostYuan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.dimensions.map((dim) => (
        <section key={dim.id} className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-[#262626]">{dim.title}</h2>
            <p className="mt-0.5 text-xs text-[#8c8c8c]">{dim.description} 每个模型一张表，互斥情景。</p>
          </div>
          {data.models.map((model) => (
            <ModelResultTable key={`${dim.id}-${model.id}`} dim={dim} model={model} />
          ))}
        </section>
      ))}
    </FinancePageShell>
  );
}

function ModelResultTable({ dim, model }: { dim: Dimension; model: ModelQuote }) {
  return (
    <div className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
      <div className="border-b px-3 py-2">
        <h3 className="text-sm font-medium text-[#262626]">
          {dim.title} · 只打 {model.label}
        </h3>
        <p className="mt-0.5 text-xs text-[#8c8c8c]">
          一次 {countLabel(model)}，扣 {model.chargeCredits} 分，厂商净成本 {yuan(model.clipCostYuan)}。
        </p>
      </div>
      <table className="w-full min-w-[720px] text-left text-xs">
        <thead className="bg-[#fafafa] text-[#8c8c8c]">
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
                <tr key={`${dim.id}-${model.id}-${row.tier}`} className="border-t">
                  <td className="px-3 py-2">{row.tier}</td>
                  <td colSpan={7} className="px-3 py-2 text-[#bfbfbf]">
                    无测算
                  </td>
                </tr>
              );
            }
            return (
              <tr key={`${dim.id}-${model.id}-${row.tier}`} className="border-t">
                <td className="px-3 py-2 font-medium text-[#262626]">{row.tier}</td>
                <td className="px-3 py-2 text-right tabular-nums">{yuan(row.priceYuan)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.creditsPool.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-[#262626]">
                  {cell.generations.toLocaleString()} {countLabel(model)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{yuan(cell.vendorCostYuan)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-[#389e0d]">
                  {yuan(cell.monthProfitYuan)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{pct(cell.monthMarginRate)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[#8c8c8c]">
                  {cell.leftoverCredits.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
