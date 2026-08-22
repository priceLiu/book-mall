"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import { financeApiFetch } from "@/lib/finance-viewer";
import { formatUserCellPrimary, formatUserOptionLabel } from "@/lib/user-contact-display";
import { ReconciliationMasterPanel } from "@/components/admin/reconciliation-master-panel";
import {
  groupReconciliationLinesByVendor,
  reconciliationSummaryDiffClass,
  reconciliationAmountDiffClass,
  reconciliationVendorRowBg,
} from "@/lib/reconciliation-colors";

type ReconStatus =
  | "OK"
  | "OVER_PLATFORM"
  | "UNDER_PLATFORM"
  | "MISSING_PLATFORM"
  | "MISSING_VENDOR"
  | "PRICE_MISMATCH"
  | "UNBOUND";

type V2Summary = {
  engineVersion?: "v2";
  vendor?: string;
  priceMode?: string;
  csvRowCount: number;
  monthsCovered: string[];
  periodFrom?: string;
  periodTo?: string;
  periodKey?: string;
  boundUsers?: number;
  unboundCloudAccounts: Array<{
    cloudAccountId: string;
    cloudAccountName: string | null;
    csvRowCount: number;
    vendorListYuan?: number;
    payableYuanSum?: number;
  }>;
  totalVendorListYuan: number;
  totalPlatformListYuan: number;
  totalAmountDiffYuan: number;
  totalPlatformCredits: number;
  totalPlatformRevenueYuan: number;
  okCount: number;
  issueCount: number;
  periodFrom?: string;
  periodTo?: string;
  periodKey?: string;
  statusCounts?: Record<ReconStatus, number>;
  internalTotalYuan?: number;
  cloudTotalPayableYuan?: number;
  diffYuanInternalMinusCloud?: number;
};

type V2Line = {
  modelKey: string;
  modelDisplayName?: string;
  vendorDisplayName?: string;
  importVendorLabel?: string;
  tierRaw: string | null;
  unitKind: string;
  tokenDirection?: string;
  vendorUnits: number;
  platformUnits: number;
  usageDiff: number;
  listUnitYuan: number;
  vendorListYuan: number;
  platformListYuan: number;
  amountDiffYuan: number;
  platformCredits: number;
  platformRevenueYuan: number;
  reconStatus: ReconStatus;
  issueReason: string | null;
  sampleLogIds: string[];
  userId?: string | null;
  cloudAccountId?: string | null;
};

type RunResult = {
  runId: string;
  summary: Partial<V2Summary> & { engineVersion?: string; totalVendorListYuan?: number };
  lines: Partial<V2Line>[];
};

function normalizeSummary(raw: RunResult["summary"]): V2Summary {
  return {
    engineVersion: raw.engineVersion as "v2" | undefined,
    vendor: raw.vendor,
    priceMode: raw.priceMode,
    csvRowCount: raw.csvRowCount ?? 0,
    monthsCovered: Array.isArray(raw.monthsCovered)
      ? raw.monthsCovered
      : typeof raw.monthsCovered === "string"
        ? raw.monthsCovered.split(",").filter(Boolean)
        : [],
    boundUsers: raw.boundUsers,
    unboundCloudAccounts: raw.unboundCloudAccounts ?? [],
    totalVendorListYuan: raw.totalVendorListYuan ?? 0,
    totalPlatformListYuan: raw.totalPlatformListYuan ?? 0,
    totalAmountDiffYuan: raw.totalAmountDiffYuan ?? 0,
    totalPlatformCredits: raw.totalPlatformCredits ?? 0,
    totalPlatformRevenueYuan: raw.totalPlatformRevenueYuan ?? 0,
    okCount: raw.okCount ?? 0,
    issueCount: raw.issueCount ?? 0,
    periodFrom: raw.periodFrom,
    periodTo: raw.periodTo,
    periodKey: raw.periodKey,
    statusCounts: raw.statusCounts,
    internalTotalYuan: raw.internalTotalYuan,
    cloudTotalPayableYuan: raw.cloudTotalPayableYuan,
    diffYuanInternalMinusCloud: raw.diffYuanInternalMinusCloud,
  };
}

function normalizeLine(l: Partial<V2Line>): V2Line {
  return {
    modelKey: l.modelKey ?? "—",
    modelDisplayName: l.modelDisplayName,
    vendorDisplayName: l.vendorDisplayName,
    importVendorLabel: l.importVendorLabel,
    tierRaw: l.tierRaw ?? null,
    unitKind: l.unitKind ?? "—",
    tokenDirection: l.tokenDirection,
    vendorUnits: l.vendorUnits ?? 0,
    platformUnits: l.platformUnits ?? 0,
    usageDiff: l.usageDiff ?? 0,
    listUnitYuan: l.listUnitYuan ?? 0,
    vendorListYuan: l.vendorListYuan ?? 0,
    platformListYuan: l.platformListYuan ?? 0,
    amountDiffYuan: l.amountDiffYuan ?? 0,
    platformCredits: l.platformCredits ?? 0,
    platformRevenueYuan: l.platformRevenueYuan ?? 0,
    reconStatus: (l.reconStatus ?? "OK") as ReconStatus,
    issueReason: l.issueReason ?? null,
    sampleLogIds: l.sampleLogIds ?? [],
    userId: l.userId,
    cloudAccountId: l.cloudAccountId,
  };
}

type Binding = {
  id: string;
  cloudAccountId: string;
  cloudAccountName: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
};

type UserOption = { id: string; name: string | null; email: string | null; phone: string | null };

const STATUS_LABEL: Record<ReconStatus, string> = {
  OK: "一致",
  OVER_PLATFORM: "平台偏多",
  UNDER_PLATFORM: "平台偏少",
  MISSING_PLATFORM: "缺平台",
  MISSING_VENDOR: "缺厂商",
  PRICE_MISMATCH: "单价不一致",
  UNBOUND: "未绑定",
};

function lineRowKey(l: V2Line): string {
  return `${l.modelKey}|${l.tierRaw ?? ""}|${l.unitKind}|${l.tokenDirection ?? "none"}`;
}

function fmtYuan(n: number) {
  return `¥${n.toFixed(2)}`;
}

function fmtNum(n: number) {
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function exportLinesCsv(runId: string, lines: V2Line[]) {
  const header = [
    "modelKey",
    "tier",
    "unit",
    "vendorUnits",
    "platformUnits",
    "usageDiff",
    "listUnitYuan",
    "vendorListYuan",
    "platformListYuan",
    "amountDiffYuan",
    "platformCredits",
    "platformRevenueYuan",
    "status",
    "issueReason",
  ];
  const rows = lines.map((l) =>
    [
      l.modelKey,
      l.tierRaw ?? "",
      l.unitKind,
      l.vendorUnits,
      l.platformUnits,
      l.usageDiff,
      l.listUnitYuan,
      l.vendorListYuan,
      l.platformListYuan,
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
  a.download = `reconciliation-${runId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ReconciliationClient() {
  const base = useBookMallBaseUrl();
  const [recentRuns, setRecentRuns] = useState<
    Array<{ id: string; csvFilename: string; status: string; createdAt: string; engineVersion?: string }>
  >([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [vendor, setVendor] = useState<"aliyun" | "kie" | "deepseek">("aliyun");
  const defaultBillPeriod = (() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
      new Date(),
    );
    const [y, m] = today.split("-");
    return { from: `${y}-${m}-01`, to: today };
  })();
  const [billPeriodFrom, setBillPeriodFrom] = useState(defaultBillPeriod.from);
  const [billPeriodTo, setBillPeriodTo] = useState(defaultBillPeriod.to);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bindModal, setBindModal] = useState<{ cloudAccountId: string; cloudAccountName: string | null } | null>(
    null,
  );
  const [bindUserId, setBindUserId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"import" | "master">("master");
  const [masterRefreshKey, setMasterRefreshKey] = useState(0);

  const reload = useCallback(async () => {
    if (!base) return;
    const r = await financeApiFetch<{
      recentRuns: Array<{ id: string; csvFilename: string; status: string; createdAt: string }>;
      bindings: Binding[];
      users: UserOption[];
    }>(base, "/api/finance/admin/reconciliation");
    if (r.ok) {
      setRecentRuns(r.data.recentRuns);
      setBindings(r.data.bindings);
      setUsers(r.data.users);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [base]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function uploadCsv() {
    if (!base || !file) {
      setError("请先选择账单文件");
      return;
    }
    setError(null);
    setUploading(true);
    setResult(null);
    setExpandedRowKey(null);
    try {
      const form = new FormData();
      form.append("bill", file);
      if (file2) form.append("bill2", file2);
      form.append("vendor", vendor);
      form.append("periodFrom", billPeriodFrom);
      form.append("periodTo", billPeriodTo);
      form.append("engine", "v2");
      form.append("priceMode", "list");
      const { url, init } = resolveBookMallBrowserRequest(base, "/api/admin/finance/reconciliation/run", {
        method: "POST",
        body: form,
      });
      const res = await fetch(url, init);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);
      const payload = json as RunResult;
      const normalized = normalizeSummary(payload.summary ?? {});
      if (normalized.periodFrom && normalized.periodTo) {
        setBillPeriodFrom(normalized.periodFrom);
        setBillPeriodTo(normalized.periodTo);
      }
      setResult({
        runId: payload.runId,
        summary: normalized,
        lines: (payload.lines ?? []).map(normalizeLine),
      });
      setMasterRefreshKey((k) => k + 1);
      setTab("master");
      setMsg("对账完成，总表已更新");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function submitBind() {
    if (!base || !bindModal || !bindUserId.trim()) return;
    const { url, init } = resolveBookMallBrowserRequest(base, "/api/admin/finance/reconciliation/bind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cloudAccountId: bindModal.cloudAccountId,
        userId: bindUserId.trim(),
        cloudAccountName: bindModal.cloudAccountName,
      }),
    });
    const res = await fetch(url, init);
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error || "绑定失败");
      return;
    }
    setBindModal(null);
    setBindUserId("");
    setMsg("绑定成功，请重新上传同一 CSV");
    reload();
  }

  const isV2 = result?.summary?.engineVersion === "v2" || (result?.summary?.totalVendorListYuan ?? 0) > 0;

  const sortedLines = useMemo(() => {
    if (!result) return [];
    return [...result.lines].sort(
      (a, b) => Math.abs(b.amountDiffYuan) - Math.abs(a.amountDiffYuan),
    );
  }, [result]);

  const vendorGroups = useMemo(
    () => groupReconciliationLinesByVendor(sortedLines),
    [sortedLines],
  );

  const summary = result?.summary;

  return (
    <div className="flex w-full flex-col gap-4">
      <header>
        <h1 className="text-lg font-medium">对账总账</h1>
        <p className="mt-1 text-sm text-[#8c8c8c]">
          总表以平台 Gateway 明细为底；导入 CSV / Excel 后按 joinKey 合并厂商列并对比。详见 docs/阿里对账.md
        </p>
        <nav className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("master")}
            className={`rounded px-3 py-1.5 text-sm ${tab === "master" ? "bg-[#1890ff] text-white" : "border border-[#d9d9d9] text-[#595959]"}`}
          >
            对账总表
          </button>
          <button
            type="button"
            onClick={() => setTab("import")}
            className={`rounded px-3 py-1.5 text-sm ${tab === "import" ? "bg-[#1890ff] text-white" : "border border-[#d9d9d9] text-[#595959]"}`}
          >
            厂商导入
          </button>
        </nav>
      </header>
      {msg ? <p className="text-sm text-[#1890ff]">{msg}</p> : null}

      {tab === "master" ? (
        <ReconciliationMasterPanel
          refreshKey={masterRefreshKey}
          periodFrom={billPeriodFrom}
          periodTo={billPeriodTo}
          onPeriodApplied={(from, to) => {
            setBillPeriodFrom(from);
            setBillPeriodTo(to);
          }}
        />
      ) : null}

      {tab === "import" ? (
        <>
      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">厂商账单导入</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            厂商
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value as "aliyun" | "kie" | "deepseek")}
              className="rounded border px-2 py-1"
            >
              <option value="aliyun">阿里云</option>
              <option value="kie">KIE</option>
              <option value="deepseek">DeepSeek</option>
            </select>
            <span className="text-xs text-[#8c8c8c]">
              {vendor === "kie"
                ? "KIE 控制台 usage_data 导出（.xlsx / .csv）"
                : vendor === "deepseek"
                  ? "DeepSeek cost / amount CSV（可各传一份）"
                  : "阿里云 consumedetail 账单"}
            </span>
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-[#8c8c8c]">
            账单区间（须与总表一致）
            <span className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={billPeriodFrom}
                onChange={(e) => setBillPeriodFrom(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
              />
              <span>~</span>
              <input
                type="date"
                value={billPeriodTo}
                onChange={(e) => setBillPeriodTo(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
              />
            </span>
          </label>
          <label className="flex flex-col gap-0.5 text-sm">
            <input
              type="file"
              accept=".csv,.tsv,.txt,.xls,.xlsx,.xlsm,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            <span className="text-xs text-[#8c8c8c]">支持 CSV、TSV、Excel（.xls / .xlsx）</span>
          </label>
          {vendor === "deepseek" ? (
            <label className="flex flex-col gap-0.5 text-sm">
              <span className="text-xs text-[#8c8c8c]">第二文件（可选，cost ↔ amount 配对）</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,text/csv"
                onChange={(e) => setFile2(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={uploadCsv}
            disabled={uploading || !file}
            className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {uploading ? "对账中…" : "自动对账"}
          </button>
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </section>

      {result && isV2 && summary ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">厂商挂牌合计</p>
              <p className="text-lg font-medium">{fmtYuan(summary.totalVendorListYuan)}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">平台挂牌合计</p>
              <p className="text-lg font-medium">{fmtYuan(summary.totalPlatformListYuan)}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">挂牌差额</p>
              <p
                className={`text-lg font-medium ${reconciliationSummaryDiffClass(summary.totalAmountDiffYuan)}`}
              >
                {fmtYuan(summary.totalAmountDiffYuan)}
              </p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">积分 / 实收</p>
              <p className="text-lg font-medium">
                {summary.totalPlatformCredits.toLocaleString()} pt ·{" "}
                {fmtYuan(summary.totalPlatformRevenueYuan)}
              </p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">OK 行</p>
              <p className="text-lg font-medium text-green-700">{summary.okCount}</p>
            </div>
            <div className="rounded border bg-white p-3">
              <p className="text-xs text-[#8c8c8c]">问题行</p>
              <p className="text-lg font-medium text-red-600">{summary.issueCount}</p>
            </div>
          </section>

          {summary.unboundCloudAccounts.length > 0 ? (
            <ul className="space-y-1 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              {summary.unboundCloudAccounts.map((u) => (
                <li key={u.cloudAccountId} className="flex flex-wrap items-center gap-2">
                  <code>{u.cloudAccountId}</code>
                  <span className="text-[#8c8c8c]">
                    {u.csvRowCount} 行 · {fmtYuan(u.vendorListYuan ?? u.payableYuanSum ?? 0)}
                  </span>
                  <button
                    type="button"
                    className="text-[#1890ff] hover:underline"
                    onClick={() =>
                      setBindModal({ cloudAccountId: u.cloudAccountId, cloudAccountName: u.cloudAccountName })
                    }
                  >
                    绑定用户
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <section className="rounded border border-[#e8e8e8] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">
                对账明细 · {result.runId.slice(0, 12)}… · {summary.monthsCovered.join(", ") || "—"}
              </h2>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs hover:bg-[#fafafa]"
                onClick={() => exportLinesCsv(result.runId, sortedLines)}
              >
                导出 CSV
              </button>
            </div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8c8c8c]">
              <span>
                {sortedLines.length} 行 · {vendorGroups.length} 个厂商
              </span>
              <span>
                已与厂商对账：<span className="text-green-700">绿底 = 付多(亏)</span>
                <span className="mx-2">·</span>
                <span className="text-red-600">红底 = 付少(收益)</span>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#fafafa]">
                  <tr>
                    <th className="px-2 py-2 text-left">模型</th>
                    <th className="px-2 py-2 text-left">档位</th>
                    <th className="px-2 py-2 text-left">单位</th>
                    <th className="px-2 py-2 text-right">厂商用量</th>
                    <th className="px-2 py-2 text-right">平台用量</th>
                    <th className="px-2 py-2 text-right">用量差</th>
                    <th className="px-2 py-2 text-right">挂牌单价</th>
                    <th className="px-2 py-2 text-right">厂商挂牌</th>
                    <th className="px-2 py-2 text-right">平台挂牌</th>
                    <th className="px-2 py-2 text-right">金额差</th>
                    <th className="px-2 py-2 text-right">积分</th>
                    <th className="px-2 py-2 text-right">实收</th>
                    <th className="px-2 py-2 text-left">状态</th>
                    <th className="px-2 py-2 text-left">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorGroups.map((group) => (
                    <Fragment key={group.vendorDisplayName}>
                      <tr className="border-t bg-[#fafafa]">
                        <td colSpan={14} className="px-2 py-2">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <span className="text-sm font-medium text-[#262626]">
                              {group.vendorDisplayName}
                              <span className="ml-2 text-xs font-normal text-[#8c8c8c]">
                                {group.lines.length} 行
                              </span>
                            </span>
                            <span className="text-xs text-[#595959]">
                              厂商挂牌 {fmtYuan(group.totalVendorListYuan)}
                              <span className="mx-2 text-[#d9d9d9]">|</span>
                              平台挂牌 {fmtYuan(group.totalPlatformListYuan)}
                              <span className="mx-2 text-[#d9d9d9]">|</span>
                              差额 {fmtYuan(group.totalAmountDiffYuan)}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {group.lines.map((l) => {
                        const rowKey = lineRowKey(l);
                        return (
                          <Fragment key={rowKey}>
                            <tr
                              className={`cursor-pointer border-t ${reconciliationVendorRowBg(l.vendorListYuan, l.vendorUnits, l.amountDiffYuan)}`}
                              onClick={() =>
                                setExpandedRowKey(expandedRowKey === rowKey ? null : rowKey)
                              }
                            >
                              <td className="px-2 py-2 font-mono">{l.modelDisplayName ?? l.modelKey}</td>
                              <td className="px-2 py-2">{l.tierRaw ?? "—"}</td>
                              <td className="px-2 py-2">
                                {l.unitKind}
                                {l.tokenDirection && l.tokenDirection !== "none"
                                  ? `/${l.tokenDirection}`
                                  : ""}
                              </td>
                              <td className="px-2 py-2 text-right">{fmtNum(l.vendorUnits)}</td>
                              <td className="px-2 py-2 text-right">{fmtNum(l.platformUnits)}</td>
                              <td className="px-2 py-2 text-right">{fmtNum(l.usageDiff)}</td>
                              <td className="px-2 py-2 text-right">{l.listUnitYuan}</td>
                              <td className="px-2 py-2 text-right">{fmtYuan(l.vendorListYuan)}</td>
                              <td className="px-2 py-2 text-right">{fmtYuan(l.platformListYuan)}</td>
                              <td
                                className={`px-2 py-2 text-right ${reconciliationAmountDiffClass(l.amountDiffYuan)}`}
                              >
                                {fmtYuan(l.amountDiffYuan)}
                              </td>
                              <td className="px-2 py-2 text-right">{l.platformCredits || "—"}</td>
                              <td className="px-2 py-2 text-right">
                                {l.platformRevenueYuan ? fmtYuan(l.platformRevenueYuan) : "—"}
                              </td>
                              <td className="px-2 py-2">{STATUS_LABEL[l.reconStatus] ?? l.reconStatus}</td>
                              <td
                                className="max-w-[200px] truncate px-2 py-2 text-[#8c8c8c]"
                                title={l.issueReason ?? ""}
                              >
                                {l.issueReason ?? "—"}
                              </td>
                            </tr>
                            {expandedRowKey === rowKey && l.sampleLogIds.length > 0 ? (
                              <tr className="border-t bg-[#fafafa]">
                                <td colSpan={14} className="px-4 py-2 font-mono text-[11px] text-[#595959]">
                                  Gateway 日志 ID（最近 {l.sampleLogIds.length} 条）：{l.sampleLogIds.join(", ")}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">历史批次（{recentRuns.length}）</h2>
        <ul className="text-sm text-[#8c8c8c]">
          {recentRuns.map((r) => (
            <li key={r.id}>
              {r.createdAt.slice(0, 10)} · {r.csvFilename} · {r.status}
            </li>
          ))}
        </ul>
        <h2 className="mb-2 mt-4 text-sm font-medium">云账号绑定（{bindings.length}）</h2>
        <ul className="text-xs">
          {bindings.slice(0, 10).map((b) => (
            <li key={b.id}>
              {b.cloudAccountId} →{" "}
              {formatUserCellPrimary({ name: b.userName, email: b.userEmail, phone: b.userPhone, id: b.userId })}
            </li>
          ))}
        </ul>
      </section>

      {bindModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="max-w-md rounded bg-white p-4 shadow">
            <p className="text-sm">绑定云账号 {bindModal.cloudAccountId} 到用户 ID：</p>
            <select
              className="mt-2 w-full rounded border px-2 py-1.5 text-sm"
              value={bindUserId}
              onChange={(e) => setBindUserId(e.target.value)}
            >
              <option value="">选择用户</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {formatUserOptionLabel(u)}
                </option>
              ))}
            </select>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setBindModal(null)}>
                取消
              </button>
              <button type="button" className="rounded bg-[#1890ff] px-3 py-1.5 text-sm text-white" onClick={submitBind}>
                确认绑定
              </button>
            </div>
          </div>
        </div>
      ) : null}
        </>
      ) : null}
    </div>
  );
}
