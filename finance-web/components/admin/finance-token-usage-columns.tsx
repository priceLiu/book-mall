"use client";

export type FinanceTokenUsage = {
  totalTokens: number;
  textToImageTokens: number;
  imageToVideoTokens: number;
  textToVideoTokens: number;
  videoToVideoTokens: number;
  videoUnderstandingTokens: number;
  ttsTokens: number;
  textTokens: number;
  otherTokens: number;
  seedance20Tokens: number;
};

export const FINANCE_TOKEN_COLUMNS: {
  key: keyof FinanceTokenUsage;
  label: string;
}[] = [
  { key: "totalTokens", label: "Token 消耗总量" },
  { key: "textToImageTokens", label: "文生图 Token" },
  { key: "imageToVideoTokens", label: "图生视频 Token" },
  { key: "textToVideoTokens", label: "文生视频 Token" },
  { key: "videoToVideoTokens", label: "视频生视频 Token" },
  { key: "videoUnderstandingTokens", label: "视频理解 Token" },
  { key: "ttsTokens", label: "TTS Token" },
  { key: "textTokens", label: "文字 Token" },
  { key: "seedance20Tokens", label: "Seedance 2.0 Token" },
  { key: "otherTokens", label: "其他 Token" },
];

function fmtTokens(n: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(n));
}

export function FinanceTokenUsageCell({ value }: { value: number }) {
  return (
    <span className="font-mono tabular-nums" title="本月成功调用 Token 合计（与 Gateway 日志同源）">
      {value > 0 ? fmtTokens(value) : "—"}
    </span>
  );
}

export function FinanceTokenUsageHeaderCells() {
  return FINANCE_TOKEN_COLUMNS.map((col) => (
    <th
      key={col.key}
      className="border border-[#e8e8e8] px-3 py-2 text-right whitespace-nowrap"
    >
      {col.label}
    </th>
  ));
}

export function FinanceTokenUsageRowCells({ usage }: { usage: FinanceTokenUsage }) {
  return FINANCE_TOKEN_COLUMNS.map((col) => (
    <td key={col.key} className="border border-[#e8e8e8] px-3 py-2 text-right">
      <FinanceTokenUsageCell value={usage[col.key] ?? 0} />
    </td>
  ));
}

export function FinanceTokenUsageSummaryPanel({
  usage,
  periodKey,
  title = "Token 消耗",
}: {
  usage: FinanceTokenUsage;
  periodKey?: string;
  title?: string;
}) {
  function fmt(n: number) {
    return new Intl.NumberFormat("zh-CN").format(Math.round(n));
  }

  return (
    <section className="rounded border border-[#e8e8e8] bg-white p-4">
      <h2 className="mb-1 text-sm font-medium text-[#262626]">
        {title}
        {periodKey ? `（账期 ${periodKey}）` : null}
      </h2>
      <p className="mb-3 text-xs text-[#8c8c8c]">
        统计本月成功 Gateway 调用 Token 合计，与 Gateway 日志同源；无厂商 usage 时按 prompt 估算。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="bg-[#fafafa] text-left text-[#595959]">
              {FINANCE_TOKEN_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="border border-[#e8e8e8] px-3 py-2 text-right whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {FINANCE_TOKEN_COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className="border border-[#e8e8e8] px-3 py-2 text-right font-mono tabular-nums"
                >
                  {usage[col.key] > 0 ? fmt(usage[col.key]) : "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
