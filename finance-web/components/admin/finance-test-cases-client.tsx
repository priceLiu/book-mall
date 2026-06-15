"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { FinancePageShell, FinancePageState } from "@/components/finance-page-shell";
import { financeApiFetch } from "@/lib/finance-viewer";

type UsageSnapshot = {
  label: string;
  description: string;
  videosCount: number;
  creditsUsed: number;
  vendorCostYuan: number;
  revenueYuan: number;
  profitYuan: number;
  marginRate: number;
  creditsRemaining?: number;
};

type BusinessScenario = {
  key: string;
  audience: string;
  tierLabel: string;
  subscription: {
    monthlyPriceYuan: number;
    monthlyCredits: number;
    videoPoolCredits: number;
    pricePerCreditYuan: number;
    seats?: number;
    totalTeamPriceYuan?: number;
    totalTeamCredits?: number;
  };
  singleVideo: {
    model: string;
    modelLabel: string;
    durationSeconds: number;
    creditsCharged: number;
    vendorCostYuan: number;
    revenueYuan: number;
    profitYuan: number;
    marginRate: number;
  };
  daily: UsageSnapshot[];
  monthly: UsageSnapshot[];
};

type BusinessPayload = {
  intro: string;
  benchmarkNote: string;
  validation: { ok: boolean; modelCount: number; marginRange: { minPct: number; maxPct: number } };
  scenarios: BusinessScenario[];
  glossary: { term: string; meaning: string }[];
};

type TestCase = {
  id: string;
  docId: string;
  category: string;
  suite: string;
  title: string;
  status?: "passed" | "failed" | "skipped" | "unknown";
};

type CategoryGroup = {
  category: string;
  label: string;
  docSection: string;
  count: number;
  cases: TestCase[];
};

type Payload = {
  business: BusinessPayload;
  vitestTotal: number;
  byCategory: CategoryGroup[];
  lastRun: {
    at: string;
    ok: boolean;
    numPassed: number;
    numFailed: number;
    numTotal: number;
    error?: string;
  } | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  pricing: "积分换算",
  reconciliation: "对账",
  simulation: "调价测算",
  "scenario-lab": "Scenario Lab",
  pnl: "盈亏预警",
  permissions: "权限",
};

function yuan(n: number) {
  return `¥${n.toFixed(2)}`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`;
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[#e8e8e8] bg-[#fafafa] px-3 py-2">
      <div className="text-xs text-[#8c8c8c]">{label}</div>
      <div className="mt-1 text-base font-medium text-[#262626]">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-[#8c8c8c]">{hint}</div> : null}
    </div>
  );
}

function UsageTable({ rows, period }: { rows: UsageSnapshot[]; period: "日" | "月" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#fafafa] text-left text-xs text-[#8c8c8c]">
          <tr>
            <th className="px-3 py-2">场景</th>
            <th className="px-3 py-2 text-right">视频条数</th>
            <th className="px-3 py-2 text-right">消耗积分</th>
            <th className="px-3 py-2 text-right">厂商成本</th>
            <th className="px-3 py-2 text-right">确认收入</th>
            <th className="px-3 py-2 text-right">利润</th>
            <th className="px-3 py-2 text-right">毛利率</th>
            {period === "月" ? <th className="px-3 py-2 text-right">剩余积分</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t align-top">
              <td className="px-3 py-2">
                <div className="font-medium text-[#262626]">{row.label}</div>
                <div className="mt-0.5 text-xs text-[#8c8c8c]">{row.description}</div>
              </td>
              <td className="px-3 py-2 text-right">{row.videosCount}</td>
              <td className="px-3 py-2 text-right">{row.creditsUsed.toLocaleString()}</td>
              <td className="px-3 py-2 text-right">{yuan(row.vendorCostYuan)}</td>
              <td className="px-3 py-2 text-right">{yuan(row.revenueYuan)}</td>
              <td className="px-3 py-2 text-right text-[#389e0d]">{yuan(row.profitYuan)}</td>
              <td className="px-3 py-2 text-right">{pct(row.marginRate)}</td>
              {period === "月" ? (
                <td className="px-3 py-2 text-right">
                  {row.creditsRemaining != null ? row.creditsRemaining.toLocaleString() : "—"}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScenarioPanel({ scenario }: { scenario: BusinessScenario }) {
  const sub = scenario.subscription;
  const sv = scenario.singleVideo;
  const isTeam = Boolean(sub.seats && sub.seats > 1);

  return (
    <section className="space-y-4 rounded border border-[#e8e8e8] bg-white p-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-[#e6f7ff] px-2 py-0.5 text-xs text-[#1890ff]">{scenario.audience}</span>
          <h2 className="text-base font-medium text-[#262626]">{scenario.tierLabel}</h2>
        </div>
        <p className="mt-2 text-sm text-[#595959]">
          {isTeam ? (
            <>
              团队 {sub.seats} 席 · 每席月付 {yuan(sub.monthlyPriceYuan)} · 每席 {sub.monthlyCredits.toLocaleString()}{" "}
              积分 → 团队合计月付 <strong>{yuan(sub.totalTeamPriceYuan ?? 0)}</strong>、
              {sub.totalTeamCredits?.toLocaleString()} 积分
            </>
          ) : (
            <>
              月付 <strong>{yuan(sub.monthlyPriceYuan)}</strong> · 含 {sub.monthlyCredits.toLocaleString()} 积分 ·
              视频专用池约 {sub.videoPoolCredits.toLocaleString()} 积分
            </>
          )}
          {isTeam ? (
            <span className="ml-1 text-xs text-[#8c8c8c]">
              （每席视频池 {sub.videoPoolCredits.toLocaleString()}，团队合计约{" "}
              {(sub.videoPoolCredits * (sub.seats ?? 1)).toLocaleString()}）
            </span>
          ) : null}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="积分单价"
          value={`${sub.pricePerCreditYuan.toFixed(6)} 元/积分`}
          hint="套餐价 ÷ 月积分"
        />
        <MetricCard label="单条扣分" value={`${sv.creditsCharged} 积分`} hint="基准模型 15s" />
        <MetricCard label="单条厂商成本" value={yuan(sv.vendorCostYuan)} hint="付给云厂商" />
        <MetricCard label="单条确认收入" value={yuan(sv.revenueYuan)} hint="扣分 × 积分单价" />
        <MetricCard label="单条利润" value={yuan(sv.profitYuan)} hint="收入 − 成本" />
        <MetricCard label="单条毛利率" value={pct(sv.marginRate)} hint="贵视频≈0%" />
      </div>

      <div className="rounded border border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-xs text-[#595959]">
        基准：{sv.modelLabel}（{sv.model}）· 时长 {sv.durationSeconds}s
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[#262626]">按日测算（当日生成视频）</h3>
        <UsageTable rows={scenario.daily} period="日" />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[#262626]">按月测算（整月汇总）</h3>
        <UsageTable rows={scenario.monthly} period="月" />
      </div>
    </section>
  );
}

export function FinanceTestCasesClient() {
  const base = useBookMallBaseUrl();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"business" | "technical">("business");
  const [techOpen, setTechOpen] = useState(false);

  const load = useCallback(
    async (run = false) => {
      if (!base) return;
      if (run) setRunning(true);
      else setLoading(true);
      setError(null);
      const qs = run ? "?run=1" : "";
      const r = await financeApiFetch<Payload>(base, `/api/finance/admin/test-cases${qs}`);
      if (!r.ok) setError(r.error);
      else setData(r.data);
      setLoading(false);
      setRunning(false);
    },
    [base],
  );

  useEffect(() => {
    load();
  }, [load]);

  const passedCount = useMemo(() => {
    if (!data) return 0;
    return data.byCategory.flatMap((g) => g.cases).filter((c) => c.status === "passed").length;
  }, [data]);

  if (loading) return <FinancePageState>加载测算数据…</FinancePageState>;
  if (error) return <FinancePageState variant="error">{error}</FinancePageState>;
  if (!data) return null;

  const biz = data.business;

  return (
    <FinancePageShell>
      <header>
        <h1 className="text-lg font-medium text-[#262626]">财务测算 · 个人与团队</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#595959]">{biz.intro}</p>
        <p className="mt-2 text-xs text-[#8c8c8c]">{biz.benchmarkNote}</p>
      </header>

      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded px-3 py-2 text-sm ${
          biz.validation.ok ? "bg-[#f6ffed] text-[#389e0d]" : "bg-[#fff1f0] text-[#cf1322]"
        }`}
      >
        <span>
          系统验算：{biz.validation.modelCount} 个视频模型毛利均在 {biz.validation.marginRange.minPct}%～
          {biz.validation.marginRange.maxPct}%（
          <Link href="/admin/scenario-lab" className="underline">
            查看明细
          </Link>
          ）
        </span>
        {data.lastRun ? (
          <span className="text-xs">
            技术验收 {data.lastRun.numPassed}/{data.lastRun.numTotal} 通过
          </span>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-[#e8e8e8]">
        <TabBtn active={tab === "business"} onClick={() => setTab("business")}>
          业务测算
        </TabBtn>
        <TabBtn active={tab === "technical"} onClick={() => setTab("technical")}>
          并排对比
        </TabBtn>
      </div>

      {tab === "business" ? (
        <>
          {biz.scenarios.map((s) => (
            <ScenarioPanel key={s.key} scenario={s} />
          ))}

          <section className="rounded border border-[#e8e8e8] bg-white p-4">
            <h2 className="text-sm font-medium text-[#262626]">名词解释</h2>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {biz.glossary.map((g) => (
                <div key={g.term} className="rounded bg-[#fafafa] px-3 py-2">
                  <dt className="text-xs font-medium text-[#262626]">{g.term}</dt>
                  <dd className="mt-0.5 text-xs text-[#595959]">{g.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      ) : (
        <section className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#fafafa] text-left text-xs text-[#8c8c8c]">
              <tr>
                <th className="px-3 py-2">对比项</th>
                {biz.scenarios.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right">
                    {s.audience}
                    <div className="font-normal">{s.tierLabel}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="月付" values={biz.scenarios.map((s) => yuan(s.subscription.monthlyPriceYuan))} />
              <CompareRow
                label="月积分"
                values={biz.scenarios.map((s) =>
                  s.subscription.totalTeamCredits
                    ? `${s.subscription.totalTeamCredits.toLocaleString()}（${s.subscription.seats} 席）`
                    : s.subscription.monthlyCredits.toLocaleString(),
                )}
              />
              <CompareRow
                label="单条扣分"
                values={biz.scenarios.map((s) => String(s.singleVideo.creditsCharged))}
              />
              <CompareRow
                label="单条成本"
                values={biz.scenarios.map((s) => yuan(s.singleVideo.vendorCostYuan))}
              />
              <CompareRow
                label="单条收入"
                values={biz.scenarios.map((s) => yuan(s.singleVideo.revenueYuan))}
              />
              <CompareRow
                label="单条利润"
                values={biz.scenarios.map((s) => yuan(s.singleVideo.profitYuan))}
              />
              <CompareRow
                label="单条毛利率"
                values={biz.scenarios.map((s) => pct(s.singleVideo.marginRate))}
              />
              <CompareRow
                label="1 条/天 · 利润"
                values={biz.scenarios.map((s) => yuan(s.daily[0]?.profitYuan ?? 0))}
              />
              <CompareRow
                label="3 条/天 · 利润"
                values={biz.scenarios.map((s) => yuan(s.daily[1]?.profitYuan ?? 0))}
              />
              <CompareRow
                label="约 10 条/月 · 利润"
                values={biz.scenarios.map((s) => yuan(s.monthly[1]?.profitYuan ?? 0))}
              />
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded border border-[#e8e8e8] bg-white">
        <button
          type="button"
          onClick={() => setTechOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-[#595959]"
        >
          <span>技术验收（开发人员 · {data.vitestTotal} 条自动化用例）</span>
          <span className="text-xs text-[#8c8c8c]">{techOpen ? "收起 ▲" : "展开 ▼"}</span>
        </button>
        {techOpen ? (
          <div className="border-t px-4 pb-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pt-3">
              <p className="text-xs text-[#8c8c8c]">
                以下为代码层 vitest 用例，供研发回归；财务同事可忽略。
                {passedCount > 0 ? ` 已加载 ${passedCount}/${data.vitestTotal} 通过。` : null}
              </p>
              <button
                type="button"
                disabled={running}
                onClick={() => load(true)}
                className="rounded border border-[#1890ff] px-2 py-1 text-xs text-[#1890ff] disabled:opacity-50"
              >
                {running ? "运行中…" : "运行全部单测"}
              </button>
            </div>
            {data.lastRun && !data.lastRun.ok ? (
              <p className="mb-2 text-xs text-[#cf1322]">{data.lastRun.error ?? "部分用例未通过"}</p>
            ) : null}
            {data.byCategory.map((group) => (
              <div key={group.category} className="mb-3 overflow-x-auto rounded border border-[#f0f0f0]">
                <div className="border-b bg-[#fafafa] px-3 py-1.5 text-xs font-medium">
                  {CATEGORY_LABEL[group.category] ?? group.label} · {group.count} 条
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {group.cases.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-3 py-1.5 w-16 font-mono text-[#8c8c8c]">{c.docId}</td>
                        <td className="px-3 py-1.5">{c.title}</td>
                        <td className="px-3 py-1.5 text-center">
                          {c.status === "passed" ? (
                            <span className="text-[#389e0d]">✓</span>
                          ) : c.status === "failed" ? (
                            <span className="text-[#cf1322]">✗</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </FinancePageShell>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        active ? "border-[#1890ff] font-medium text-[#1890ff]" : "border-transparent text-[#595959]"
      }`}
    >
      {children}
    </button>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium text-[#262626]">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2 text-right">
          {v}
        </td>
      ))}
    </tr>
  );
}
