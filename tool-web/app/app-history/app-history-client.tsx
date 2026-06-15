"use client";

import { useCallback, useEffect, useState } from "react";
import { GatewayBillingDetailsPanel } from "@/components/gateway-billing-details-panel";
import styles from "./expense-detail.module.css";

type ToolCreditsPayload = {
  active?: boolean;
  creditBalance?: number | null;
  creditPools?: { general: number; video: number } | null;
  reason?: string;
};

function creditsErrorMessage(code: string): string {
  if (code === "tools_session_inactive" || code === "no_session") {
    return "工具站会话未就绪，请从主站重新进入工具站（SSO）后再查看明细。";
  }
  if (code === "tools_access_denied") {
    return "暂无工具站准入，请开通会员或 BYOK 后再查看。";
  }
  return code;
}

export function AppHistoryClient() {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<ToolCreditsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCredits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tool-credits", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as ToolCreditsPayload & { error?: string };
      if (!res.ok) {
        setCredits(null);
        setError(
          typeof data.error === "string" ? creditsErrorMessage(data.error) : `HTTP ${res.status}`,
        );
        return;
      }
      setCredits(data);
    } catch {
      setCredits(null);
      setError("读取积分失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCredits();
  }, [loadCredits]);

  const balanceDisplay = (() => {
    if (loading) return <span className={styles.balanceMuted}>读取中…</span>;
    if (error) return <span className={styles.balanceMuted}>{error}</span>;
    if (!credits?.active && credits?.reason === "tools_access_denied") {
      return <span className={styles.balanceMuted}>暂无准入</span>;
    }
    if (credits?.creditBalance != null) {
      return (
        <>
          {credits.creditBalance.toLocaleString("zh-CN")} 积分
          {credits.creditPools ? (
            <span className={styles.balanceMuted}>
              {" "}
              · 通用 {credits.creditPools.general.toLocaleString("zh-CN")} · 视频{" "}
              {credits.creditPools.video.toLocaleString("zh-CN")}
            </span>
          ) : null}
        </>
      );
    }
    return <span className={styles.balanceMuted}>—</span>;
  })();

  const financeOrigin =
    process.env.NEXT_PUBLIC_FINANCE_WEB_ORIGIN?.replace(/\/$/, "") ?? "";

  return (
    <div className={styles.root}>
      <div className={styles.metaRow}>
        <div className={styles.metaLeft}>
          <button type="button" className={styles.refreshBtn} onClick={() => void loadCredits()}>
            刷新余额
          </button>
        </div>
        <div className={styles.metaRight}>
          <div className={styles.balanceCard} aria-live="polite">
            <span className={styles.balanceCardLabel}>积分余额</span>
            <div className={styles.balanceCardAmt}>{balanceDisplay}</div>
          </div>
        </div>
      </div>

      {financeOrigin ? (
        <p className={styles.pageLeadInline}>
          完整导出与团队明细请至{" "}
          <a
            href={`${financeOrigin}/fees/billing/details?tab=charge`}
            target="_blank"
            rel="noopener noreferrer"
          >
            财务控制台 · 扣减明细
          </a>
          、{" "}
          <a href={`${financeOrigin}/fees/usage`} target="_blank" rel="noopener noreferrer">
            积分用量中心
          </a>
          。
        </p>
      ) : null}

      <GatewayBillingDetailsPanel />
    </div>
  );
}
