"use client";

/** 与 book-mall gatewayTokenUsageToRecord 字段对齐。 */
export type FinanceGatewayUsage = {
  textToImageImages: number;
  imageToVideoSeconds: number;
  textToVideoSeconds: number;
  videoToVideoSeconds: number;
  videoUnderstandingKTokens: number;
  ttsKTokens: number;
  textKTokens: number;
  seedance20Seconds: number;
  otherCalls: number;
};

/** @deprecated */
export type FinanceTokenUsage = FinanceGatewayUsage;

export const FINANCE_USAGE_COLUMNS: {
  key: keyof FinanceGatewayUsage;
  label: string;
  unit: string;
}[] = [
  { key: "textToImageImages", label: "文生图", unit: "张" },
  { key: "imageToVideoSeconds", label: "图生视频", unit: "秒" },
  { key: "textToVideoSeconds", label: "文生视频", unit: "秒" },
  { key: "videoToVideoSeconds", label: "视频生视频", unit: "秒" },
  { key: "videoUnderstandingKTokens", label: "视频理解", unit: "千Token" },
  { key: "ttsKTokens", label: "TTS", unit: "千Token" },
  { key: "textKTokens", label: "文字", unit: "千Token" },
  { key: "seedance20Seconds", label: "Seedance 2.0", unit: "秒" },
  { key: "otherCalls", label: "其他", unit: "次" },
];

/** @deprecated */
export const FINANCE_TOKEN_COLUMNS = FINANCE_USAGE_COLUMNS.map((col) => ({
  key: col.key,
  label: `${col.label} · ${col.unit}`,
}));

function fmtUsage(n: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(n));
}

export function FinanceTokenUsageCell({
  value,
  unit,
}: {
  value: number;
  unit?: string;
}) {
  return (
    <span
      className="font-mono tabular-nums"
      title={
        unit
          ? `本月成功 Gateway 调用用量（${unit}，与账单计费单位一致）`
          : "本月成功 Gateway 调用用量"
      }
    >
      {fmtUsage(value)}
    </span>
  );
}

export function FinanceTokenUsageHeaderCells() {
  return FINANCE_USAGE_COLUMNS.map((col) => (
    <th
      key={col.key}
      className="border border-[#e8e8e8] px-3 py-2 text-right whitespace-nowrap"
    >
      {col.label} · {col.unit}
    </th>
  ));
}

export function FinanceTokenUsageRowCells({ usage }: { usage: FinanceGatewayUsage }) {
  return FINANCE_USAGE_COLUMNS.map((col) => (
    <td key={col.key} className="border border-[#e8e8e8] px-3 py-2 text-right">
      <FinanceTokenUsageCell value={usage[col.key] ?? 0} unit={col.unit} />
    </td>
  ));
}

export function FinanceTokenUsageSummaryPanel({
  usage,
  periodKey,
  title = "Gateway 用量",
}: {
  usage: FinanceGatewayUsage;
  periodKey?: string;
  title?: string;
}) {
  return (
    <section className="rounded border border-[#e8e8e8] bg-white p-4">
      <h2 className="mb-1 text-sm font-medium text-[#262626]">
        {title}
        {periodKey ? `（账期 ${periodKey}）` : null}
      </h2>
      <p className="mb-3 text-xs text-[#8c8c8c]">
        按七类计费单位汇总本月成功 Gateway 调用：文生图/试衣=张，视频=秒，文字/TTS/视频理解=千
        Token；与账单明细「平台用量」口径一致。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="bg-[#fafafa] text-left text-[#595959]">
              {FINANCE_USAGE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="border border-[#e8e8e8] px-3 py-2 text-right whitespace-nowrap"
                >
                  {col.label} · {col.unit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {FINANCE_USAGE_COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className="border border-[#e8e8e8] px-3 py-2 text-right font-mono tabular-nums"
                >
                  {fmtUsage(usage[col.key] ?? 0)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
