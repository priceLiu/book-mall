"use client";

type PackageUsageRow = {
  key: string;
  label: string;
  total: number | null;
  succeeded: number;
  failed: number;
  remaining: number | null;
};

type TryonModelUsageRow = {
  modelKey: string;
  label: string;
  succeeded: number;
  failed: number;
};

export type PackageReconciliationData = {
  periodKey: string;
  billingPersona: string | null;
  scopeKey: string | null;
  usageSummary: {
    topupCreditsThisMonth: number;
    grantCreditsThisMonth: number;
    creditsConsumed: number;
    creditsRemaining: number;
    totalCallsThisMonth: number;
  };
  packageUsageRows: PackageUsageRow[];
  tryonByModel: TryonModelUsageRow[];
};

function fmtQuota(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("zh-CN");
}

export function PackageReconciliationPanel({ data }: { data: PackageReconciliationData }) {
  const isByok = data.billingPersona === "BYOK";

  return (
    <section className="space-y-4 rounded border border-[#e8e8e8] bg-white p-4">
      <header>
        <h2 className="text-sm font-medium text-[#262626]">
          套餐与积分对帐 · {data.periodKey}
          {data.scopeKey ? (
            <span className="ml-2 text-xs font-normal text-[#8c8c8c]">BYOK · {data.scopeKey}</span>
          ) : null}
        </h2>
        <p className="mt-1 text-xs text-[#8c8c8c]">
          本月权益次数（总数 / 成功 / 失败 / 剩余）与轻量包积分；试衣按模型拆分调用统计。
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label={isByok ? "轻量包加购" : "本月发放"} value={data.usageSummary.topupCreditsThisMonth} />
        <Stat label="本月消耗积分" value={data.usageSummary.creditsConsumed} />
        <Stat label="剩余积分" value={data.usageSummary.creditsRemaining} />
        <Stat label="Gateway 成功调用" value={data.usageSummary.totalCallsThisMonth} />
      </div>

      {data.packageUsageRows.length > 0 ? (
        <div className="overflow-x-auto rounded border border-[#f0f0f0]">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="bg-[#fafafa] text-[#8c8c8c]">
              <tr>
                <th className="px-3 py-2 text-left font-medium">任务类型</th>
                <th className="px-3 py-2 text-right font-medium">套餐总数</th>
                <th className="px-3 py-2 text-right font-medium">成功</th>
                <th className="px-3 py-2 text-right font-medium">失败</th>
                <th className="px-3 py-2 text-right font-medium">剩余</th>
              </tr>
            </thead>
            <tbody>
              {data.packageUsageRows.map((row) => (
                <tr key={row.key} className="border-t border-[#f0f0f0]">
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQuota(row.total)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#389e0d]">{row.succeeded}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#cf1322]">{row.failed}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtQuota(row.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-[#8c8c8c]">该用户无 BYOK 套餐额度或未开通有效 BYOK。</p>
      )}

      {data.tryonByModel.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs font-medium text-[#595959]">AI 试衣 · 按模型</h3>
          <div className="overflow-x-auto rounded border border-[#f0f0f0]">
            <table className="w-full min-w-[360px] text-xs">
              <thead className="bg-[#fafafa] text-[#8c8c8c]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">模型</th>
                  <th className="px-3 py-2 text-right font-medium">成功</th>
                  <th className="px-3 py-2 text-right font-medium">失败</th>
                </tr>
              </thead>
              <tbody>
                {data.tryonByModel.map((row) => (
                  <tr key={row.modelKey} className="border-t border-[#f0f0f0]">
                    <td className="px-3 py-2 font-mono text-[11px]">{row.modelKey}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#389e0d]">{row.succeeded}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#cf1322]">{row.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-[#f0f0f0] px-3 py-2">
      <p className="text-[11px] text-[#8c8c8c]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#262626]">
        {value.toLocaleString("zh-CN")}
      </p>
    </div>
  );
}
