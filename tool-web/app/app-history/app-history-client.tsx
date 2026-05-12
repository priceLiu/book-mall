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
  costMinor: number | null;
  createdAt: string;
};

export type ToolSummaryRow = {
  toolKey: string;
  label: string;
  billCount: number;
  sumMinor: number;
};

type WalletPayload = {
  active: boolean;
  balanceMinor: number | null;
  minBalanceLineMinor: number | null;
  reason?: string;
};

const PAGE_SIZE = 50;

function formatYuanFromMinor(minor: number | null | undefined): string {
  if (minor == null || !Number.isFinite(minor)) return "—";
  return `${(minor / 100).toFixed(2)}`;
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
    if (wallet?.balanceMinor == null) {
      return <span className={styles.balanceMuted}>—</span>;
    }
    return (
      <>
        <span className={styles.balanceAmount}>¥{formatYuanFromMinor(wallet.balanceMinor)}</span>
        <span className={styles.balanceMuted}> CNY</span>
      </>
    );
  })();

  const hint =
    !loading &&
    !errorText &&
    wallet?.active &&
    wallet.minBalanceLineMinor != null &&
    wallet.minBalanceLineMinor > 0 ? (
      <p className={styles.balanceHint}>
        最低可用余额线（工具准入）：¥{formatYuanFromMinor(wallet.minBalanceLineMinor)}
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
  const [events, setEvents] = useState<UsageEventRow[]>([]);
  const [summaryByTool, setSummaryByTool] = useState<ToolSummaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [walletPending, setWalletPending] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

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
          balanceMinor: walletData.balanceMinor ?? null,
          minBalanceLineMinor: walletData.minBalanceLineMinor ?? null,
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

  const loadUsage = useCallback(async (pageNum: number) => {
    setUsageLoading(true);
    setError(null);
    try {
      const usageRes = await fetch(
        `/api/tool-usage?page=${pageNum}&limit=${PAGE_SIZE}`,
        { cache: "no-store", credentials: "same-origin" },
      );
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
    void loadUsage(page);
  }, [page, loadUsage]);

  const refreshAll = useCallback(async () => {
    await loadWallet();
    await loadUsage(page);
  }, [loadWallet, loadUsage, page]);

  const pageSumMinor = useMemo(() => {
    return events.reduce((acc, e) => {
      const c = e.costMinor;
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
    if (wallet?.balanceMinor == null) {
      return <span className={styles.balanceMuted}>—</span>;
    }
    return (
      <span className={styles.inlineBalanceAmt}>
        ¥{formatYuanFromMinor(wallet.balanceMinor)}
      </span>
    );
  })();

  function renderRow(row: UsageEventRow) {
    const charge = formatToolUsageChargeDisplay(row.toolKey, row.action, row.costMinor);
    const unit = formatToolUsageUnitPriceDisplay(
      row.toolKey,
      row.action,
      row.costMinor,
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

  return (
    <div>
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
                    {s.label} · {s.billCount} 笔 · ¥{(s.sumMinor / 100).toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

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
            const rows = events.filter((e) => e.toolKey === s.toolKey);
            if (rows.length === 0) return null;
            return (
              <div key={s.toolKey} className={styles.toolGroup}>
                <div className={styles.toolGroupHead}>
                  <span>{s.label}</span>
                  <span className={styles.toolGroupMeta}>
                    累计 {s.billCount} 笔 · 合计 ¥{(s.sumMinor / 100).toFixed(2)}
                  </span>
                </div>
                <div className={styles.toolGroupRows}>{rows.map(renderRow)}</div>
              </div>
            );
          })}

          {orphanRows.length > 0 ? (
            <div className={styles.toolGroup}>
              <div className={styles.toolGroupHead}>
                <span>其他</span>
                <span className={styles.toolGroupMeta}>本页 {orphanRows.length} 条</span>
              </div>
              <div className={styles.toolGroupRows}>{orphanRows.map(renderRow)}</div>
            </div>
          ) : null}

          <div className={styles.summaryLine}>
            <span>本页合计扣费（仅已标价）</span>
            <span className={styles.summaryStrong}>
              {pageSumMinor > 0 ? `¥${(pageSumMinor / 100).toFixed(2)}` : "—"}
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
