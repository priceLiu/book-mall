"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import {
  formatToolUsageChargeDisplay,
  formatToolUsageUnitPriceDisplay,
  isAiFitBillableTryOn,
} from "@/lib/tool-usage-charge-display";
import styles from "./expense-detail.module.css";

export type UsageEventRow = {
  id: string;
  toolKey: string;
  action: string;
  meta: unknown;
  costPoints: number | null;
  createdAt: string;
};

export type ToolSummaryRow = {
  toolKey: string;
  label: string;
  billCount: number;
  sumPoints: number;
};

type WalletPayload = {
  active: boolean;
  balancePoints: number | null;
  minBalanceLinePoints: number | null;
  reason?: string;
};

const PAGE_SIZE = 50;

function formatYuanFromPoints(points: number | null | undefined): string {
  if (points == null || !Number.isFinite(points)) return "—";
  return `${(points / 100).toFixed(2)}`;
}

function BalanceFooterStrip({
  loading,
  errorText,
  wallet,
}: {
  loading: boolean;
  errorText: string | null;
  wallet: WalletPayload | null;
}) {
  const amountDisplay = (() => {
    if (loading) return <span className={styles.balanceMuted}>读取中…</span>;
    if (errorText) return <span className={styles.balanceMuted}>{errorText}</span>;
    if (!wallet?.active && wallet?.reason === "tools_access_denied") {
      return <span className={styles.balanceMuted}>暂无准入 · 请充值或联系管理员</span>;
    }
    if (wallet?.balancePoints == null) {
      return <span className={styles.balanceMuted}>—</span>;
    }
    const pts = wallet.balancePoints;
    return (
      <>
        <span className={styles.balanceAmount}>
          {pts.toLocaleString("zh-CN")} 点
        </span>
        <span className={styles.balanceMuted}>（¥{formatYuanFromPoints(pts)}）</span>
      </>
    );
  })();

  const hint =
    !loading &&
    !errorText &&
    wallet?.active &&
    wallet.minBalanceLinePoints != null &&
    wallet.minBalanceLinePoints > 0 ? (
      <p className={styles.balanceHint}>
        最低可用余额线（工具准入）：
        {wallet.minBalanceLinePoints.toLocaleString("zh-CN")} 点（¥
        {formatYuanFromPoints(wallet.minBalanceLinePoints)}）
      </p>
    ) : null;

  return (
    <section
      className={`${styles.balanceStrip} ${styles.balanceStripFooter}`}
      aria-label="当前余额（页尾）"
    >
      <div className={styles.balanceStripInner}>
        <span className={styles.balanceLabel}>钱包余额</span>
        {amountDisplay}
      </div>
      {hint}
    </section>
  );
}

export function AppHistoryClient() {
  const [page, setPage] = useState(1);
  const [toolFilter, setToolFilter] = useState<string>("");
  const [events, setEvents] = useState<UsageEventRow[]>([]);
  const [summaryByTool, setSummaryByTool] = useState<ToolSummaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [walletPending, setWalletPending] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  /** 用户筛选：仅本页已加载事件的客户端模糊过滤（不重发请求） */
  const [quickQuery, setQuickQuery] = useState<string>("");

  const loadWallet = useCallback(async () => {
    setWalletPending(true);
    try {
      const walletRes = await fetch("/api/tool-wallet", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const walletData = (await walletRes.json()) as WalletPayload & { error?: string };
      if (!walletRes.ok) {
        setWallet(null);
        setWalletError(
          typeof walletData.error === "string" ? walletData.error : `钱包 ${walletRes.status}`,
        );
      } else {
        setWallet({
          active: Boolean(walletData.active),
          balancePoints: walletData.balancePoints ?? null,
          minBalanceLinePoints: walletData.minBalanceLinePoints ?? null,
          reason: walletData.reason,
        });
        setWalletError(null);
      }
    } catch {
      setWallet(null);
      setWalletError("余额读取失败");
    } finally {
      setWalletPending(false);
    }
  }, []);

  const loadUsage = useCallback(async (pageNum: number, filterTool: string) => {
    setUsageLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
      });
      if (filterTool) qs.set("toolKeyPrefix", filterTool);
      const usageRes = await fetch(`/api/tool-usage?${qs.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const usageData = (await usageRes.json()) as {
        events?: UsageEventRow[];
        summaryByTool?: ToolSummaryRow[];
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
        error?: string;
      };
      if (!usageRes.ok) {
        setEvents([]);
        setSummaryByTool([]);
        setTotal(0);
        setTotalPages(0);
        setError(typeof usageData.error === "string" ? usageData.error : `HTTP ${usageRes.status}`);
        return;
      }
      setEvents(Array.isArray(usageData.events) ? usageData.events : []);
      setSummaryByTool(
        Array.isArray(usageData.summaryByTool) ? usageData.summaryByTool : [],
      );
      setTotal(typeof usageData.total === "number" ? usageData.total : 0);
      setTotalPages(typeof usageData.totalPages === "number" ? usageData.totalPages : 0);
    } catch {
      setEvents([]);
      setSummaryByTool([]);
      setTotal(0);
      setTotalPages(0);
      setError("加载失败，请检查网络与主站连接");
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    void loadUsage(page, toolFilter);
  }, [page, toolFilter, loadUsage]);

  const refreshAll = useCallback(async () => {
    await loadWallet();
    await loadUsage(page, toolFilter);
  }, [loadWallet, loadUsage, page, toolFilter]);

  /** 拉取所有页（按当前 toolFilter）→ 拼成 CSV → 下载。 */
  const exportAllCsv = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const all: UsageEventRow[] = [];
      let p = 1;
      let totalPagesNow = totalPages > 0 ? totalPages : 1;
      // 上限保护：避免极端情况下死循环
      while (p <= totalPagesNow && p <= 1000) {
        const qs = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
        if (toolFilter) qs.set("toolKeyPrefix", toolFilter);
        const res = await fetch(`/api/tool-usage?${qs.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) {
          setExportMsg(`第 ${p} 页拉取失败（HTTP ${res.status}）`);
          break;
        }
        const data = (await res.json()) as {
          events?: UsageEventRow[];
          totalPages?: number;
        };
        if (Array.isArray(data.events)) all.push(...data.events);
        if (typeof data.totalPages === "number") totalPagesNow = data.totalPages;
        p += 1;
      }
      if (all.length === 0) {
        setExportMsg("没有可导出的数据");
        return;
      }
      const headers = [
        "时间",
        "工具",
        "动作",
        "扣点",
        "≈元",
        "modelId",
      ];
      const escape = (s: unknown): string => {
        const v = s == null ? "" : typeof s === "string" ? s : String(s);
        if (v.includes(",") || v.includes("\"") || v.includes("\n")) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      };
      const lines = all.map((r) => {
        const ts = new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 19);
        const pts = r.costPoints ?? 0;
        const yuan = (pts / 100).toFixed(2);
        const meta = r.meta as Record<string, unknown> | null;
        const model =
          meta && typeof meta === "object"
            ? (meta["modelId"] as string | undefined) ??
              (meta["apiModel"] as string | undefined) ??
              (meta["videoModel"] as string | undefined) ??
              (meta["textToImageModel"] as string | undefined) ??
              (meta["tryOnModel"] as string | undefined) ??
              ""
            : "";
        return [ts, r.toolKey, r.action, pts, yuan, model].map(escape).join(",");
      });
      const csv = `\uFEFF${headers.join(",")}\n${lines.join("\n")}\n`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = (() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
      })();
      const slug = toolFilter ? toolFilter.replace(/[^\w-]/g, "_") : "all";
      a.download = `tool-usage-${slug}-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg(`已导出 ${all.length} 条`);
    } finally {
      setExporting(false);
    }
  }, [exporting, toolFilter, totalPages]);

  const pageSumPoints = useMemo(() => {
    return events.reduce((acc, e) => {
      const c = e.costPoints;
      return acc + (typeof c === "number" && c > 0 ? c : 0);
    }, 0);
  }, [events]);

  const summarizedKeys = useMemo(
    () => new Set(summaryByTool.map((s) => s.toolKey)),
    [summaryByTool],
  );

  const orphanRows = useMemo(
    () => events.filter((e) => !summarizedKeys.has(e.toolKey)),
    [events, summarizedKeys],
  );
  /** 经 quickQuery 过滤的"其它"行；用于本页客户端搜索时同步收窄。 */
  const orphanRowsVisible = useMemo(() => {
    const t = quickQuery.trim().toLowerCase();
    if (!t) return orphanRows;
    return orphanRows.filter((e) => {
      const meta = e.meta as Record<string, unknown> | null;
      const modelStr =
        meta && typeof meta === "object"
          ? Object.values(meta)
              .filter((v) => typeof v === "string")
              .join(" ")
          : "";
      return [e.toolKey, e.action, modelStr, toolKeyToLabel(e.toolKey)]
        .join(" ")
        .toLowerCase()
        .includes(t);
    });
  }, [orphanRows, quickQuery]);

  const walletHintForStrip =
    walletError != null
      ? walletError === "no_session"
        ? "未登录工具站会话"
        : walletError
      : null;

  const showPager = total > 0 && totalPages > 0;

  const inlineBalance = (() => {
    if (walletPending) return <span className={styles.balanceMuted}>余额读取中…</span>;
    if (walletHintForStrip) {
      return <span className={styles.balanceMuted}>{walletHintForStrip}</span>;
    }
    if (!wallet?.active && wallet?.reason === "tools_access_denied") {
      return <span className={styles.balanceMuted}>暂无准入</span>;
    }
    if (wallet?.balancePoints == null) {
      return <span className={styles.balanceMuted}>—</span>;
    }
    return (
      <span className={styles.inlineBalanceAmt}>
        {wallet.balancePoints.toLocaleString("zh-CN")} 点（¥
        {formatYuanFromPoints(wallet.balancePoints)}）
      </span>
    );
  })();

  function renderRow(row: UsageEventRow) {
    const charge = formatToolUsageChargeDisplay(row.toolKey, row.action, row.costPoints);
    const unit = formatToolUsageUnitPriceDisplay(
      row.toolKey,
      row.action,
      row.costPoints,
      row.meta,
    );
    const chargeCls =
      charge.variant === "money"
        ? styles.costCharge
        : charge.variant === "nonbill"
          ? styles.costNonBillable
          : isAiFitBillableTryOn(row.toolKey, row.action)
            ? `${styles.costNone} ${styles.costMissingPrice}`
            : styles.costNone;
    const unitCls =
      unit.variant === "money"
        ? styles.unitPrice
        : unit.variant === "nonbill"
          ? styles.costNonBillable
          : isAiFitBillableTryOn(row.toolKey, row.action)
            ? `${styles.costNone} ${styles.costMissingPrice}`
            : styles.costNone;
    return (
      <div key={row.id} className={styles.detailRow}>
        <div className={styles.detailTime}>
          {new Date(row.createdAt).toLocaleString("zh-CN")}
        </div>
        <div className={styles.detailTool}>
          {toolKeyToLabel(row.toolKey)}
          <code>{row.toolKey}</code>
        </div>
        <div className={styles.detailAction}>{row.action}</div>
        <div className={`${unitCls} ${styles.cellNumeric}`}>{unit.text}</div>
        <div className={chargeCls}>{charge.text}</div>
      </div>
    );
  }

  /** 当前页 + 客户端模糊搜索的行（用于快速找某条事件）。 */
  const visibleEvents = useMemo(() => {
    const t = quickQuery.trim().toLowerCase();
    if (!t) return events;
    return events.filter((e) => {
      const meta = e.meta as Record<string, unknown> | null;
      const modelStr =
        meta && typeof meta === "object"
          ? Object.values(meta)
              .filter((v) => typeof v === "string")
              .join(" ")
          : "";
      const hay = [e.toolKey, e.action, modelStr, toolKeyToLabel(e.toolKey)]
        .join(" ")
        .toLowerCase();
      return hay.includes(t);
    });
  }, [events, quickQuery]);

  return (
    <div>
      {/* 顶部筛选 + 导出工具栏 */}
      <div
        className="tw-mb-3 tw-flex tw-flex-wrap tw-items-end tw-gap-2"
        aria-label="筛选与导出"
      >
        <div className="tw-flex tw-flex-col tw-gap-1">
          <label className="tw-text-xs tw-text-[var(--tool-muted)]">按工具筛选</label>
          <select
            value={toolFilter}
            onChange={(e) => {
              setToolFilter(e.target.value);
              setPage(1);
            }}
            className="tw-h-9 tw-rounded tw-border tw-border-[var(--tool-border,#d1d5db)] tw-bg-[var(--tool-bg,#fff)] tw-px-2 tw-text-sm tw-text-[var(--tool-text)]"
            disabled={usageLoading || exporting}
          >
            <option value="">全部工具</option>
            {summaryByTool.map((s) => (
              <option key={s.toolKey} value={s.toolKey}>
                {s.label}（{s.toolKey}）
              </option>
            ))}
          </select>
        </div>
        <div className="tw-flex tw-flex-col tw-gap-1 tw-flex-1 tw-min-w-[200px]">
          <label className="tw-text-xs tw-text-[var(--tool-muted)]">本页快速搜索</label>
          <input
            type="search"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="模型片段 / 工具名 / 动作"
            className="tw-h-9 tw-rounded tw-border tw-border-[var(--tool-border,#d1d5db)] tw-bg-[var(--tool-bg,#fff)] tw-px-2 tw-text-sm tw-text-[var(--tool-text)]"
          />
        </div>
        <div className="tw-flex tw-flex-col tw-gap-1">
          <span className="tw-text-xs tw-text-[var(--tool-muted)] tw-invisible">导出</span>
          <button
            type="button"
            onClick={() => void exportAllCsv()}
            disabled={exporting || total === 0}
            className="tw-h-9 tw-rounded tw-border tw-border-[var(--tool-border,#d1d5db)] tw-bg-[var(--tool-bg,#fff)] tw-px-3 tw-text-sm tw-text-[var(--tool-text)] hover:tw-bg-[var(--tool-bg-hover,#f5f5f5)] disabled:tw-opacity-60"
          >
            {exporting ? "正在导出…" : `导出 CSV（全部 ${total > 0 ? total : 0} 条）`}
          </button>
        </div>
        {exportMsg ? (
          <span className="tw-self-end tw-text-xs tw-text-[var(--tool-muted)] tw-py-2">
            {exportMsg}
          </span>
        ) : null}
      </div>

      <div className={styles.detailToolbarRow}>
        <div className={styles.detailToolbarMain}>
          <p className={styles.detailSectionTitle}>使用明细（扣费）</p>
          <button type="button" className={styles.refreshBtn} onClick={() => void refreshAll()}>
            刷新余额与明细
          </button>
        </div>
        <div className={styles.detailToolbarRight}>
          <div className={styles.inlineBalance}>
            <span className={styles.inlineBalanceLabel}>当前余额</span>
            {inlineBalance}
          </div>
          <div className={styles.toolNotes} aria-label="各工具扣费笔记">
            <div className={styles.toolNotesTitle}>扣费工具摘要（全部分页合计）</div>
            {summaryByTool.length === 0 ? (
              <p className={styles.toolNotesEmpty}>暂无汇总</p>
            ) : (
              <ul className={styles.toolNotesList}>
                {summaryByTool.map((s) => (
                  <li key={s.toolKey} className={styles.toolNotesLi}>
                    {s.label} · {s.billCount} 笔 ·{" "}
                    {s.sumPoints.toLocaleString("zh-CN")} 点（¥
                    {(s.sumPoints / 100).toFixed(2)}）
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {(() => {
        const fin = process.env.NEXT_PUBLIC_FINANCE_WEB_ORIGIN?.replace(/\/$/, "") ?? "";
        if (!fin) return null;
        return (
          <div className={styles.toolNotes} style={{ marginBottom: "1rem" }} aria-label="云级费用明细说明">
            <div className={styles.toolNotesTitle}>云级费用明细</div>
            <p className="tw-m-0 tw-text-sm tw-leading-snug tw-text-[var(--tool-muted)]">
              与云账单 CSV 同颗粒度（主站{" "}
              <code className="tw-font-mono tw-text-[0.7rem]">ToolBillingDetailLine</code>
              ）。在{" "}
              <a
                href={`${fin}/fees/billing/details`}
                target="_blank"
                rel="noopener noreferrer"
                className="tw-text-[var(--tool-text)] tw-underline tw-underline-offset-2"
              >
                财务控制台
              </a>
              打开完整表（建议在主站已登录同账号的浏览器中访问）。本页的「使用明细」仍为按次扣费流水；云级行也可经本站的{" "}
              <code className="tw-font-mono tw-text-[0.7rem]">GET /api/tool-billing-detail-lines</code>{" "}
              取 JSON。
            </p>
          </div>
        );
      })()}

      {usageLoading && events.length === 0 ? (
        <p className="tw-muted">加载中…</p>
      ) : error ? (
        <p className="tw-muted" style={{ color: "crimson" }}>
          {error}
          {" · "}
          <button type="button" onClick={() => void refreshAll()}>
            重试
          </button>
          {"（未登录工具站会话时会提示 no_session）"}
        </p>
      ) : total === 0 ? (
        <p className="tw-muted">
          暂无扣费记录。产生试衣成功等事件后将在此列出。
        </p>
      ) : (
        <div className={styles.detailCard}>
          <div className={styles.detailHead}>
            <span>时间</span>
            <span>工具</span>
            <span>动作</span>
            <span style={{ textAlign: "right" }}>单价</span>
            <span style={{ textAlign: "right" }}>AI扣费</span>
          </div>

          {summaryByTool.map((s) => {
            const rows = visibleEvents.filter((e) => e.toolKey === s.toolKey);
            if (rows.length === 0) return null;
            return (
              <div key={s.toolKey} className={styles.toolGroup}>
                <div className={styles.toolGroupHead}>
                  <span>{s.label}</span>
                  <span className={styles.toolGroupMeta}>
                    累计 {s.billCount} 笔 · 合计 {s.sumPoints.toLocaleString("zh-CN")}{" "}
                    点（¥{(s.sumPoints / 100).toFixed(2)}）
                  </span>
                </div>
                <div className={styles.toolGroupRows}>{rows.map(renderRow)}</div>
              </div>
            );
          })}

          {orphanRowsVisible.length > 0 ? (
            <div className={styles.toolGroup}>
              <div className={styles.toolGroupHead}>
                <span>其他</span>
                <span className={styles.toolGroupMeta}>
                  本页 {orphanRowsVisible.length}
                  {orphanRowsVisible.length !== orphanRows.length
                    ? ` / ${orphanRows.length}`
                    : ""}{" "}
                  条
                </span>
              </div>
              <div className={styles.toolGroupRows}>{orphanRowsVisible.map(renderRow)}</div>
            </div>
          ) : null}

          <div className={styles.summaryLine}>
            <span>本页合计扣费（仅已标价）</span>
            <span className={styles.summaryStrong}>
              {pageSumPoints > 0
                ? `${pageSumPoints.toLocaleString("zh-CN")} 点（¥${(pageSumPoints / 100).toFixed(2)}）`
                : "—"}
            </span>
          </div>
          {showPager ? (
            <div className={styles.pager}>
              <span>
                共 <strong className={styles.summaryStrong}>{total}</strong> 条 · 第{" "}
                <strong className={styles.summaryStrong}>{page}</strong> /{" "}
                <strong className={styles.summaryStrong}>{totalPages}</strong> 页
              </span>
              <div className={styles.pagerBtns}>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  disabled={page <= 1 || usageLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </button>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  disabled={page >= totalPages || usageLoading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <BalanceFooterStrip
        loading={walletPending}
        errorText={walletHintForStrip}
        wallet={wallet}
      />
    </div>
  );
}
