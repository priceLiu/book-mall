"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { financeApiFetch, financeApiPost } from "@/lib/finance-viewer";
import {
  groupReconciliationLinesByVendor,
  reconciliationAmountDiffClass,
  reconciliationProfitClass,
  reconciliationVendorRowBg,
} from "@/lib/reconciliation-colors";
import { S2vGapAuditPanel } from "@/components/admin/s2v-gap-audit-panel";

type ReconStatus =
  | "OK"
  | "OVER_PLATFORM"
  | "UNDER_PLATFORM"
  | "MISSING_PLATFORM"
  | "MISSING_VENDOR"
  | "PRICE_MISMATCH"
  | "UNBOUND";

type MasterLine = {
  joinKey: string;
  periodMonth: string;
  vendorCode?: string;
  importVendor: string;
  csvImportLabel?: string | null;
  importVendorLabel: string;
  vendorDisplayName: string;
  modelKey: string;
  modelDisplayName: string;
  tierRaw: string | null;
  unitKind: string;
  tokenDirection: string;
  vendorUnits: number;
  platformUnits: number;
  usageDiff: number;
  listUnitYuan: number;
  vendorListYuan: number;
  platformListYuan: number;
  amountDiffYuan: number;
  platformCredits: number;
  platformRevenueYuan: number;
  platformNetCostYuan: number;
  platformProfitYuan: number;
  reconStatus: ReconStatus;
  issueReason: string | null;
  sampleLogIds: string[];
  sourceRunId: string;
  sourceImportedAt: string;
  updatedAt: string;
};

type MasterSummary = {
  lineCount: number;
  importVendors: string[];
  months: string[];
  totalVendorListYuan: number;
  totalPlatformListYuan: number;
  totalAmountDiffYuan: number;
  totalPlatformNetCostYuan: number;
  totalPlatformRevenueYuan: number;
  totalPlatformProfitYuan: number;
  totalReconciledAmountDiffYuan: number;
  totalPlatformCredits: number;
  okCount: number;
  issueCount: number;
  usage?: {
    buckets: Array<{
      category: "video" | "image" | "other";
      label: string;
      platformUnits: number;
      unitLabel: string;
      platformListYuan: number;
      platformCredits: number;
      lineCount: number;
    }>;
    totalPlatformCredits: number;
    totalPlatformRevenueYuan: number;
  };
};

const STATUS_LABEL: Record<ReconStatus, string> = {
  OK: "一致",
  OVER_PLATFORM: "平台偏多",
  UNDER_PLATFORM: "平台偏少",
  MISSING_PLATFORM: "缺平台",
  MISSING_VENDOR: "缺厂商",
  PRICE_MISMATCH: "单价不一致",
  UNBOUND: "未绑定",
};

const IMPORT_VENDOR_LABEL: Record<string, string> = {
  aliyun: "阿里云",
  kie: "KIE",
  deepseek: "DeepSeek",
  minimax: "MiniMax",
  elevenlabs: "ElevenLabs",
  volcengine: "火山引擎",
  tencent: "腾讯云",
};

const COLUMN_TOOLTIPS = {
  vendorList: "厂商 CSV 目录价总额；未导入时为「待导入」",
  platformList: "Gateway 用量 × 挂牌单价（目录价预算，非用户实收）",
  platformNetCost: "Gateway 用量 × 净成本单价（costSnapshot / ModelCostProfile）",
  platformRevenue: "Σ 积分 × 用户 pricePerCreditYuan（用户实收）",
  platformProfit: "用户实收 − 预估净成本（经营毛利，与对账差额无关）",
  amountDiff: "平台挂牌 − 厂商挂牌（对账差额；未导入 CSV 时等于平台挂牌）",
  usageDiff: "平台用量 − 厂商用量",
} as const;

function Th({
  children,
  align = "left",
  tooltip,
}: {
  children: ReactNode;
  align?: "left" | "right";
  tooltip?: string;
}) {
  return (
    <th
      className={`px-2 py-2 ${align === "right" ? "text-right" : "text-left"} ${tooltip ? "cursor-help underline decoration-dotted decoration-[#bfbfbf] underline-offset-2" : ""}`}
      title={tooltip}
    >
      {children}
    </th>
  );
}

function fmtYuan(n: number) {
  return `¥${n.toFixed(2)}`;
}

function fmtNum(n: number) {
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function defaultMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function defaultPeriodRange(): { from: string; to: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
    new Date(),
  );
  const [y, m] = today.split("-");
  return { from: `${y}-${m}-01`, to: today };
}

function fmtUsageUnits(units: number, unitLabel: string): string {
  if (unitLabel === "混合") {
    return units > 0 ? fmtNum(units) : "—";
  }
  return `${fmtNum(units)} ${unitLabel}`;
}

function fmtVendorCell(units: number, yuan: number): string {
  if (units <= 0 && yuan <= 0) return "待导入";
  return `${fmtNum(units)} · ${fmtYuan(yuan)}`;
}

function exportMasterCsv(lines: MasterLine[]) {
  const header = [
    "periodMonth",
    "vendorDisplayName",
    "importVendor",
    "modelKey",
    "modelDisplayName",
    "tier",
    "unit",
    "vendorUnits",
    "platformUnits",
    "usageDiff",
    "vendorListYuan",
    "platformListYuan",
    "platformNetCostYuan",
    "platformRevenueYuan",
    "platformProfitYuan",
    "amountDiffYuan",
    "platformCredits",
    "platformRevenueYuan",
    "status",
    "issueReason",
  ];
  const rows = lines.map((l) =>
    [
      l.periodMonth,
      l.vendorDisplayName,
      l.importVendor,
      l.modelKey,
      l.modelDisplayName,
      l.tierRaw ?? "",
      l.unitKind,
      l.vendorUnits,
      l.platformUnits,
      l.usageDiff,
      l.vendorListYuan,
      l.platformListYuan,
      l.platformNetCostYuan,
      l.platformRevenueYuan,
      l.platformProfitYuan,
      l.amountDiffYuan,
      l.platformCredits,
      l.platformRevenueYuan,
      l.reconStatus,
      l.issueReason ?? "",
    ].join(","),
  );
  const blob = new Blob([`\uFEFF${header.join(",")}\n${rows.join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `reconciliation-master-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ReconciliationMasterPanel({
  refreshKey,
  periodFrom: periodFromProp,
  periodTo: periodToProp,
  onPeriodApplied,
}: {
  refreshKey?: number;
  periodFrom?: string;
  periodTo?: string;
  onPeriodApplied?: (from: string, to: string) => void;
}) {
  const base = useBookMallBaseUrl();
  const [lines, setLines] = useState<MasterLine[]>([]);
  const [summary, setSummary] = useState<MasterSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshingPlatform, setRefreshingPlatform] = useState(false);
  const defaults = defaultPeriodRange();
  const [periodFrom, setPeriodFrom] = useState(periodFromProp ?? defaults.from);
  const [periodTo, setPeriodTo] = useState(periodToProp ?? defaults.to);
  const [importVendor, setImportVendor] = useState("");
  const [status, setStatus] = useState("");
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);

  useEffect(() => {
    if (periodFromProp) setPeriodFrom(periodFromProp);
    if (periodToProp) setPeriodTo(periodToProp);
  }, [periodFromProp, periodToProp]);

  const load = useCallback(async () => {
    if (!base) return;
    if (!periodFrom.trim() || !periodTo.trim()) {
      setError("请选择账单开始日与结束日");
      return;
    }
    if (periodFrom > periodTo) {
      setError("开始日不能晚于结束日");
      return;
    }
    setLoading(true);
    setError(null);

    setRefreshingPlatform(true);
    const refreshR = await financeApiPost<{ lineCount: number; periodKey: string }>(
      base,
      "/api/finance/admin/reconciliation/master/refresh-platform",
      { periodFrom: periodFrom.trim(), periodTo: periodTo.trim() },
    );
    setRefreshingPlatform(false);
    if (!refreshR.ok) {
      setError(refreshR.error);
      setLoading(false);
      return;
    }

    const qs = new URLSearchParams({
      take: "500",
      periodFrom: periodFrom.trim(),
      periodTo: periodTo.trim(),
    });
    if (importVendor) qs.set("vendor", importVendor);
    if (status) qs.set("status", status);
    const r = await financeApiFetch<{
      lines: MasterLine[];
      total: number;
      summary: MasterSummary;
    }>(base, `/api/finance/admin/reconciliation/master?${qs}`);
    if (r.ok) {
      setLines(r.data.lines);
      setSummary(r.data.summary);
      setError(null);
      setHasLoaded(true);
      onPeriodApplied?.(periodFrom.trim(), periodTo.trim());
    } else {
      setError(r.error);
    }
    setLoading(false);
  }, [base, periodFrom, periodTo, importVendor, status, onPeriodApplied]);

  /** 厂商导入成功后由父组件递增 refreshKey，自动刷新一次 */
  useEffect(() => {
    if (refreshKey != null && refreshKey > 0) {
      void load();
    }
  }, [refreshKey, load]);

  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => Math.abs(b.amountDiffYuan) - Math.abs(a.amountDiffYuan)),
    [lines],
  );

  const vendorGroups = useMemo(
    () => groupReconciliationLinesByVendor(sortedLines),
    [sortedLines],
  );

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-base font-medium">对账总表</h2>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          平台 Gateway 明细为底；选好与厂商 CSV 一致的日期区间后点「刷新」。导入账单时须使用相同区间，否则对账无意义。
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded border border-[#e8e8e8] bg-white p-4">
        <label className="flex flex-col gap-1 text-xs text-[#8c8c8c]">
          开始日
          <input
            type="date"
            className="rounded border px-2 py-1.5 text-sm text-[#262626]"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#8c8c8c]">
          结束日
          <input
            type="date"
            className="rounded border px-2 py-1.5 text-sm text-[#262626]"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#8c8c8c]">
          CSV 导入
          <select
            className="rounded border px-2 py-1.5 text-sm text-[#262626]"
            value={importVendor}
            onChange={(e) => setImportVendor(e.target.value)}
          >
            <option value="">全部</option>
            {(summary?.importVendors ?? []).map((v) => (
              <option key={v} value={v}>
                {IMPORT_VENDOR_LABEL[v] ?? v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#8c8c8c]">
          状态
          <select
            className="rounded border px-2 py-1.5 text-sm text-[#262626]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">全部</option>
            {Object.entries(STATUS_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded border px-3 py-1.5 text-sm hover:bg-[#fafafa]"
          onClick={() => void load()}
          disabled={loading || refreshingPlatform}
        >
          {refreshingPlatform ? "刷新平台底表…" : "刷新"}
        </button>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#8c8c8c]">
          {refreshingPlatform ? "正在从 Gateway 刷新平台底表…" : "加载总表…"}
        </p>
      ) : null}

      {summary && !loading ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded border border-[#e6f4ff] bg-[#f0f6ff] p-3">
              <p className="text-xs text-[#8c8c8c]" title={COLUMN_TOOLTIPS.platformNetCost}>
                预算净成本
              </p>
              <p className="text-lg font-medium">{fmtYuan(summary.totalPlatformNetCostYuan)}</p>
              <p className="mt-0.5 text-[10px] text-[#8c8c8c]">应付厂商（净成本口径）</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]" title={COLUMN_TOOLTIPS.amountDiff}>
                已对账差额
              </p>
              <p
                className={`text-lg font-medium ${reconciliationAmountDiffClass(summary.totalReconciledAmountDiffYuan)}`}
              >
                {fmtYuan(summary.totalReconciledAmountDiffYuan)}
              </p>
              <p className="mt-0.5 text-[10px] text-[#8c8c8c]">仅含已导入 CSV 的行</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]" title={COLUMN_TOOLTIPS.platformRevenue}>
                用户实收
              </p>
              <p className="text-lg font-medium">{fmtYuan(summary.totalPlatformRevenueYuan)}</p>
              <p className="mt-0.5 text-[10px] text-[#8c8c8c]">积分 × 用户单价</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]" title={COLUMN_TOOLTIPS.platformProfit}>
                毛利
              </p>
              <p
                className={`text-lg font-medium ${reconciliationProfitClass(summary.totalPlatformProfitYuan)}`}
              >
                {fmtYuan(summary.totalPlatformProfitYuan)}
              </p>
              <p className="mt-0.5 text-[10px] text-[#8c8c8c]">实收 − 预算净成本</p>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">明细行</p>
              <p className="text-lg font-medium">{summary.lineCount}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">厂商挂牌合计</p>
              <p className="text-lg font-medium">{fmtYuan(summary.totalVendorListYuan)}</p>
              <p className="mt-0.5 text-[10px] text-[#8c8c8c]">已导入厂商账单</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">平台挂牌合计</p>
              <p className="text-lg font-medium">{fmtYuan(summary.totalPlatformListYuan)}</p>
              <p className="mt-0.5 text-[10px] text-[#8c8c8c]">Gateway 全量底表</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">已导入来源</p>
              <p className="text-sm font-medium">
                {summary.importVendors.map((v) => IMPORT_VENDOR_LABEL[v] ?? v).join("、") || "—"}
              </p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">OK / 问题</p>
              <p className="text-lg font-medium text-green-700">
                {summary.okCount} / <span className="text-red-600">{summary.issueCount}</span>
              </p>
            </div>
          </section>

          {summary.usage ? (
            <section className="rounded border border-[#e8e8e8] bg-white p-4">
              <h3 className="mb-3 text-sm font-medium text-[#262626]">
                平台用量 · {periodFrom} ~ {periodTo}
              </h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {summary.usage.buckets.map((bucket) => (
                  <div key={bucket.category} className="rounded border border-[#f0f0f0] bg-[#fafafa] p-3">
                    <p className="text-xs text-[#8c8c8c]">{bucket.label}</p>
                    <p className="mt-1 text-base font-medium text-[#262626]">
                      {bucket.lineCount > 0
                        ? fmtUsageUnits(bucket.platformUnits, bucket.unitLabel)
                        : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-[#595959]">
                      挂牌 {fmtYuan(bucket.platformListYuan)}
                      {bucket.platformCredits > 0 ? (
                        <>
                          <span className="mx-1 text-[#d9d9d9]">·</span>
                          {bucket.platformCredits.toLocaleString()} 积分
                        </>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-[#8c8c8c]">{bucket.lineCount} 行明细</p>
                  </div>
                ))}
                <div className="rounded border border-[#e6f4ff] bg-[#f0f6ff] p-3">
                  <p className="text-xs text-[#8c8c8c]">积分消耗</p>
                  <p className="mt-1 text-base font-medium text-[#262626]">
                    {summary.usage.totalPlatformCredits.toLocaleString()} pt
                  </p>
                  <p className="mt-1 text-[11px] text-[#595959]">
                    实收 {fmtYuan(summary.usage.totalPlatformRevenueYuan)}
                  </p>
                  <p className="text-[10px] text-[#8c8c8c]">用户侧扣点合计</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-[#8c8c8c]">
                视频=成片秒 · 图片=张 · 其他=Token/音频/按次等（单位不可直接相加）
              </p>
            </section>
          ) : null}

          <S2vGapAuditPanel periodFrom={periodFrom} periodTo={periodTo} />
        </>
      ) : null}

      {!loading && !hasLoaded ? (
        <p className="rounded border border-dashed border-[#d9d9d9] bg-[#fafafa] p-6 text-center text-sm text-[#8c8c8c]">
          请选择与导入 CSV 一致的日期区间，点击「刷新」加载对账总表（含从 Gateway 更新平台底表）。
        </p>
      ) : null}

      {!loading && hasLoaded && sortedLines.length === 0 ? (
        <p className="rounded border border-dashed border-[#d9d9d9] bg-[#fafafa] p-6 text-center text-sm text-[#8c8c8c]">
          所选月份暂无 Gateway 成功调用记录，或平台底表尚未刷新。可点「刷新」重试；有数据后可在「厂商导入」上传账单（CSV / Excel）。
        </p>
      ) : null}

      {sortedLines.length > 0 ? (
        <section className="rounded border border-[#e8e8e8] bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">全部明细 · 展示 {sortedLines.length} 行 · {vendorGroups.length} 个厂商</h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-[#8c8c8c]">
                已对厂商账单：
                <span className="text-green-700">绿底 = 付多(亏)</span>
                <span className="mx-1">·</span>
                <span className="text-red-600">红底 = 付少(收益)</span>
              </span>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs hover:bg-[#fafafa]"
                onClick={() => exportMasterCsv(sortedLines)}
              >
                导出 CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#fafafa]">
                <tr>
                  <Th>月份</Th>
                  <Th>账单来源</Th>
                  <Th>CSV</Th>
                  <Th>模型</Th>
                  <Th>档位</Th>
                  <Th>单位</Th>
                  <Th align="right">厂商用量</Th>
                  <Th align="right" tooltip={COLUMN_TOOLTIPS.usageDiff}>
                    平台用量
                  </Th>
                  <Th align="right" tooltip={COLUMN_TOOLTIPS.usageDiff}>
                    用量差
                  </Th>
                  <Th align="right" tooltip={COLUMN_TOOLTIPS.vendorList}>
                    厂商挂牌
                  </Th>
                  <Th align="right" tooltip={COLUMN_TOOLTIPS.platformList}>
                    平台挂牌
                  </Th>
                  <Th align="right" tooltip={COLUMN_TOOLTIPS.platformNetCost}>
                    预估净成本
                  </Th>
                  <Th align="right" tooltip={COLUMN_TOOLTIPS.platformRevenue}>
                    用户实收
                  </Th>
                  <Th align="right" tooltip={COLUMN_TOOLTIPS.platformProfit}>
                    行级毛利
                  </Th>
                  <Th align="right" tooltip={COLUMN_TOOLTIPS.amountDiff}>
                    对账差额
                  </Th>
                  <Th align="right">积分</Th>
                  <Th>状态</Th>
                  <Th>说明</Th>
                </tr>
              </thead>
              <tbody>
                {vendorGroups.map((group) => (
                  <Fragment key={group.vendorDisplayName}>
                    <tr className="border-t bg-[#fafafa]">
                      <td colSpan={19} className="px-2 py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <span className="text-sm font-medium text-[#262626]">
                            {group.vendorDisplayName}
                            <span className="ml-2 text-xs font-normal text-[#8c8c8c]">
                              {group.lines.length} 行
                            </span>
                          </span>
                          <span className="text-xs text-[#595959]">
                            净成本 {fmtYuan(group.totalPlatformNetCostYuan)}
                            <span className="mx-2 text-[#d9d9d9]">|</span>
                            实收 {fmtYuan(group.totalPlatformRevenueYuan)}
                            <span className="mx-2 text-[#d9d9d9]">|</span>
                            毛利{" "}
                            <span className={reconciliationProfitClass(group.totalPlatformProfitYuan)}>
                              {fmtYuan(group.totalPlatformProfitYuan)}
                            </span>
                            <span className="mx-2 text-[#d9d9d9]">|</span>
                            对账差额{" "}
                            <span className={reconciliationAmountDiffClass(group.totalAmountDiffYuan)}>
                              {fmtYuan(group.totalAmountDiffYuan)}
                            </span>
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.lines.map((l) => (
                      <Fragment key={l.joinKey}>
                        <tr
                          className={`cursor-pointer border-t ${reconciliationVendorRowBg(l.vendorListYuan, l.vendorUnits, l.amountDiffYuan)}`}
                          onClick={() =>
                            setExpandedRowKey(expandedRowKey === l.joinKey ? null : l.joinKey)
                          }
                        >
                          <td className="px-2 py-2">{l.periodMonth}</td>
                          <td className="px-2 py-2">{l.vendorDisplayName}</td>
                          <td className="px-2 py-2">
                            {l.csvImportLabel ? (
                              <span className="text-[#262626]">{l.csvImportLabel}</span>
                            ) : l.platformUnits > 0 ? (
                              <span className="text-[#faad14]">待导入</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-2" title={l.modelKey}>
                            {l.modelDisplayName}
                            <div className="font-mono text-[10px] text-[#8c8c8c]">{l.modelKey}</div>
                          </td>
                          <td className="px-2 py-2">{l.tierRaw ?? "—"}</td>
                          <td className="px-2 py-2">
                            {l.unitKind}
                            {l.tokenDirection !== "none" ? `/${l.tokenDirection}` : ""}
                          </td>
                          <td className="px-2 py-2 text-right">{fmtNum(l.vendorUnits)}</td>
                          <td className="px-2 py-2 text-right">{fmtNum(l.platformUnits)}</td>
                          <td className="px-2 py-2 text-right">{fmtNum(l.usageDiff)}</td>
                          <td className="px-2 py-2 text-right text-[#8c8c8c]">
                            {fmtVendorCell(l.vendorUnits, l.vendorListYuan)}
                          </td>
                          <td className="px-2 py-2 text-right">{fmtYuan(l.platformListYuan)}</td>
                          <td className="px-2 py-2 text-right">{fmtYuan(l.platformNetCostYuan)}</td>
                          <td className="px-2 py-2 text-right">{fmtYuan(l.platformRevenueYuan)}</td>
                          <td
                            className={`px-2 py-2 text-right ${reconciliationProfitClass(l.platformProfitYuan)}`}
                          >
                            {fmtYuan(l.platformProfitYuan)}
                          </td>
                          <td
                            className={`px-2 py-2 text-right ${reconciliationAmountDiffClass(l.amountDiffYuan)}`}
                          >
                            {fmtYuan(l.amountDiffYuan)}
                          </td>
                          <td className="px-2 py-2 text-right">{l.platformCredits || "—"}</td>
                          <td className="px-2 py-2">{STATUS_LABEL[l.reconStatus] ?? l.reconStatus}</td>
                          <td
                            className="max-w-[180px] truncate px-2 py-2 text-[#8c8c8c]"
                            title={l.issueReason ?? ""}
                          >
                            {l.issueReason ?? "—"}
                          </td>
                        </tr>
                        {expandedRowKey === l.joinKey && l.sampleLogIds.length > 0 ? (
                          <tr className="border-t bg-[#fafafa]">
                            <td colSpan={19} className="px-4 py-2 font-mono text-[11px] text-[#595959]">
                              Gateway 日志：{l.sampleLogIds.join(", ")}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
