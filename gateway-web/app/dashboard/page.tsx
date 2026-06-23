import { gatewayJson } from "@/lib/gateway-api";

export const dynamic = "force-dynamic";

type UsageData = {
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCostYuan: number;
    days: number;
  };
  topModels: { model: string; count: number; tokens: number; cost: number }[];
  daily: { date: string; requests: number; tokens: number }[];
};

export default async function DashboardUsagePage() {
  const { data } = await gatewayJson<UsageData>("/api/gateway/usage?days=30");
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--gw-ink)]">用量统计</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">近 {summary?.days ?? 30} 天</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="请求数" value={summary?.totalRequests ?? 0} />
        <StatCard label="Token 总量" value={summary?.totalTokens ?? 0} />
        <StatCard
          label="预估厂商成本（元）"
          value={(summary?.totalCostYuan ?? 0).toFixed(4)}
        />
      </div>

      <section className="gw-card">
        <h2 className="mb-3 text-sm font-medium text-[var(--gw-ink)]">按模型 Top</h2>
        <table className="gw-table">
          <thead>
            <tr>
              <th>模型</th>
              <th>次数</th>
              <th>Token</th>
              <th>成本（元）</th>
            </tr>
          </thead>
          <tbody>
            {(data?.topModels ?? []).map((m) => (
              <tr key={m.model}>
                <td className="font-mono text-xs">{m.model}</td>
                <td>{m.count}</td>
                <td>{m.tokens}</td>
                <td>{m.cost.toFixed(4)}</td>
              </tr>
            ))}
            {!data?.topModels?.length ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[var(--gw-muted)]">
                  暂无数据
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="gw-card">
        <h2 className="mb-3 text-sm font-medium text-[var(--gw-ink)]">按日趋势</h2>
        <table className="gw-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>请求</th>
              <th>Token</th>
            </tr>
          </thead>
          <tbody>
            {(data?.daily ?? []).slice(-14).map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.requests}</td>
                <td>{d.tokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="gw-card">
      <div className="text-xs text-[var(--gw-muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--gw-ink)]">{value}</div>
    </div>
  );
}
