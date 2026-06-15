"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/app/app-history/expense-detail.module.css";

const K_CONSUME_TIME = "平台账单/消费时间";
const K_TOOL_PAGE = "平台/工具页面";
const K_MODEL_NAME = "平台/模型名称";
const K_MODEL_CODE = "平台/模型Code";
const K_CREDITS = "平台/消耗积分";
const K_FEE_DESC = "平台账单/费用说明";
const K_STATUS = "平台/状态";
const K_REQUEST_KIND = "平台/请求类型";

const DISPLAY_KEYS = [
  K_CONSUME_TIME,
  K_TOOL_PAGE,
  K_MODEL_NAME,
  K_REQUEST_KIND,
  K_CREDITS,
  K_STATUS,
  K_FEE_DESC,
] as const;

type BillingDetailsPayload = {
  source?: string;
  tab?: "usage" | "charge";
  poolBalances?: { general: number; video: number };
  totalCalls?: number;
  succeededCalls?: number;
  failedCalls?: number;
  returned?: number;
  truncated?: boolean;
  rows?: Record<string, string>[];
  error?: string;
};

function headerLabel(key: string): string {
  if (key.includes("/")) return key.split("/").slice(1).join("/");
  return key;
}

function parseCredits(cell: string | undefined): number {
  const n = parseInt(cell ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export function GatewayBillingDetailsPanel() {
  const [tab, setTab] = useState<"charge" | "usage">("charge");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BillingDetailsPayload | null>(null);

  const load = useCallback(async (nextTab: "charge" | "usage") => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ tab: nextTab, take: "100" });
      const res = await fetch(`/api/tool-billing-details?${qs.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as BillingDetailsPayload;
      if (!res.ok) {
        setPayload(null);
        setError(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
        return;
      }
      setPayload(data);
    } catch {
      setPayload(null);
      setError("加载 Gateway 扣减明细失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const rows = useMemo(
    () => (Array.isArray(payload?.rows) ? payload!.rows! : []),
    [payload],
  );

  const totalCredits = useMemo(
    () => rows.reduce((s, r) => s + parseCredits(r[K_CREDITS]), 0),
    [rows],
  );

  const pools = payload?.poolBalances;

  return (
    <section className={styles.gatewayPanel} aria-label="Gateway 扣减明细">
      <div className={styles.gatewayPanelHead}>
        <div>
          <h2 className={styles.gatewayPanelTitle}>Gateway 扣减明细</h2>
          <p className={styles.gatewayPanelLead}>
            Finance 2.0 · 与 finance-web 扣减明细同源（<code>GatewayRequestLog</code> +
            <code>BillingSettlementLine</code>）
          </p>
        </div>
        <div className={styles.gatewayPanelActions}>
          <div className={styles.gatewayTabGroup} role="tablist" aria-label="明细类型">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "charge"}
              className={tab === "charge" ? styles.gatewayTabActive : styles.gatewayTab}
              onClick={() => setTab("charge")}
            >
              扣减明细
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "usage"}
              className={tab === "usage" ? styles.gatewayTabActive : styles.gatewayTab}
              onClick={() => setTab("usage")}
            >
              全部用量
            </button>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => void load(tab)}
            disabled={loading}
          >
            刷新
          </button>
        </div>
      </div>

      <div className={styles.gatewayStats} aria-live="polite">
        {pools ? (
          <span className={styles.gatewayStatChip}>
            通用池 {pools.general.toLocaleString("zh-CN")} · 视频池{" "}
            {pools.video.toLocaleString("zh-CN")}
          </span>
        ) : null}
        {tab === "charge" && rows.length > 0 ? (
          <span className={styles.gatewayStatChip}>
            本页合计 <strong>{totalCredits.toLocaleString("zh-CN")}</strong> 积分
          </span>
        ) : null}
        {payload?.totalCalls != null ? (
          <span className={styles.gatewayStatChip}>
            调用 {payload.totalCalls} · 成功 {payload.succeededCalls ?? 0} · 失败{" "}
            {payload.failedCalls ?? 0}
          </span>
        ) : null}
        {payload?.truncated ? (
          <span className={styles.gatewayStatMuted}>仅展示最近 {payload.returned ?? 100} 条</span>
        ) : null}
      </div>

      {loading && rows.length === 0 ? (
        <p className={styles.stateBoxMuted}>加载 Gateway 明细…</p>
      ) : error ? (
        <div className={`${styles.stateBox} ${styles.stateBoxError}`} role="alert">
          {error}
          <button type="button" onClick={() => void load(tab)}>
            重试
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className={styles.stateBoxMuted}>
          {tab === "charge" ? "暂无扣减记录。" : "暂无用量记录。"}
        </p>
      ) : (
        <div className={styles.gatewayTableWrap}>
          <table className={styles.gatewayTable}>
            <thead>
              <tr>
                {DISPLAY_KEYS.map((k) => (
                  <th key={k}>{headerLabel(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={`${row[K_CONSUME_TIME]}-${row[K_MODEL_CODE]}-${ri}`}>
                  {DISPLAY_KEYS.map((k) => (
                    <td
                      key={k}
                      className={
                        k === K_CREDITS
                          ? styles.gatewayCreditsCell
                          : k === K_FEE_DESC
                            ? styles.gatewayDescCell
                            : undefined
                      }
                    >
                      {row[k]?.trim() ? row[k] : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
