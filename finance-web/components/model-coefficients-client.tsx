"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { getBookMallBaseUrl } from "@/lib/book-mall-billing-url";
import { RETAIL_MULTIPLIER_DEFAULT } from "@/lib/bill-config";
import { cn } from "@/lib/utils";

type RowStatus = "current" | "future" | "expired" | "inactive";

type BillableRowJson = {
  id: string;
  toolKey: string;
  action: string | null;
  schemeARefModelKey: string | null;
  cloudModelKey: string | null;
  cloudTierRaw: string | null;
  cloudBillingKind: string | null;
  cloudVendor: string | null;
  productInfo: string | null;
  schemeAUnitCostYuan: number | null;
  schemeAAdminRetailMultiplier: number | null;
  pricePoints: number;
  active: boolean;
  status: RowStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string | null;
};

const STATUS_LABEL: Record<RowStatus, string> = {
  current: "生效",
  future: "未生效",
  expired: "已过期",
  inactive: "停用",
};

const VENDOR_LABEL: Record<string, string> = {
  aliyun: "阿里云",
  tencent: "腾讯云",
  huawei: "华为云",
  volcengine: "火山引擎",
  aws: "AWS",
  azure: "Azure",
};

function displayVendor(v: string | null): string {
  if (!v?.trim()) return "—";
  const key = v.trim().toLowerCase();
  return VENDOR_LABEL[key] ?? v.trim();
}

function fmtCost(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(6).replace(/\.?0+$/, "");
}

export function ModelCoefficientsClient() {
  const base = getBookMallBaseUrl();
  const [q, setQ] = useState("");
  const qDeferred = useDeferredValue(q);
  const [toolKey, setToolKey] = useState("");
  const [scope, setScope] = useState<"current" | "all">("current");
  const [toolKeys, setToolKeys] = useState<string[]>([]);
  const [rows, setRows] = useState<BillableRowJson[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [draftM, setDraftM] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!base) {
      setLoadState("error");
      setErrMsg("未配置 NEXT_PUBLIC_BOOK_MALL_URL");
      return;
    }
    const ac = new AbortController();
    setLoadState("loading");
    setErrMsg(null);
    const qs = new URLSearchParams();
    if (qDeferred.trim()) qs.set("q", qDeferred.trim());
    if (toolKey) qs.set("toolKey", toolKey);
    qs.set("scope", scope);
    fetch(`${base}/api/admin/finance/tool-billable-prices?${qs.toString()}`, {
      credentials: "include",
      mode: "cors",
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error || `${res.status}`);
        }
        return res.json() as Promise<{
          toolKeys: string[];
          rows: BillableRowJson[];
          truncated: boolean;
        }>;
      })
      .then((data) => {
        if (ac.signal.aborted) return;
        setToolKeys(data.toolKeys);
        setRows(data.rows);
        setTruncated(data.truncated);
        setLoadState("ok");
        setDraftM((prev) => {
          const next = { ...prev };
          const ids = new Set(data.rows.map((r) => r.id));
          for (const k of Object.keys(next)) {
            if (!ids.has(k)) delete next[k];
          }
          return next;
        });
        setRowErr({});
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setLoadState("error");
        setErrMsg(e instanceof Error ? e.message : "加载失败");
        setRows([]);
      });
    return () => ac.abort();
  }, [base, qDeferred, toolKey, scope]);

  const canSave = useMemo(() => {
    return (r: BillableRowJson) => {
      const d = draftM[r.id];
      if (d === undefined) return false;
      const n = Number(d);
      const cur = r.schemeAAdminRetailMultiplier;
      if (!Number.isFinite(n) || n <= 0) return false;
      if (cur != null && Math.abs(n - cur) < 1e-9) return false;
      return true;
    };
  }, [draftM]);

  async function saveRow(r: BillableRowJson) {
    if (!base || !canSave(r)) return;
    const n = Number(draftM[r.id]);
    setSavingId(r.id);
    setRowErr((p) => ({ ...p, [r.id]: "" }));
    try {
      const res = await fetch(`${base}/api/admin/finance/tool-billable-prices/${encodeURIComponent(r.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        mode: "cors",
        body: JSON.stringify({ schemeAAdminRetailMultiplier: n }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        row?: { schemeAAdminRetailMultiplier: number; pricePoints: number };
      };
      if (!res.ok) throw new Error(j.error || res.statusText);
      if (j.row) {
        setRows((list) =>
          list.map((x) =>
            x.id === r.id
              ? {
                  ...x,
                  schemeAAdminRetailMultiplier: j.row!.schemeAAdminRetailMultiplier,
                  pricePoints: j.row!.pricePoints,
                }
              : x,
          ),
        );
        setDraftM((p) => {
          const c = { ...p };
          delete c[r.id];
          return c;
        });
      }
    } catch (e: unknown) {
      setRowErr((p) => ({
        ...p,
        [r.id]: e instanceof Error ? e.message : "保存失败",
      }));
    } finally {
      setSavingId(null);
    }
  }

  if (!base) {
    return (
      <p className="text-sm text-[#a8071a]">请配置 NEXT_PUBLIC_BOOK_MALL_URL 后刷新。</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-xs leading-relaxed text-[#8c8c8c]">
        系数 M 与主站 <code className="rounded bg-[#f5f5f5] px-1">ToolBillablePrice</code>{" "}
        同步；保存后按{" "}
        <code className="rounded bg-[#f5f5f5] px-1">扣点 = round(成本元 × M × 100)</code>{" "}
        重算标价（与「工具应用 → 定价」一致）。默认系数约定为{" "}
        <strong className="text-[#595959]">{RETAIL_MULTIPLIER_DEFAULT}</strong>。
      </p>

      <div className="flex flex-col gap-3 rounded border border-[#e8e8e8] bg-white p-4 shadow-sm md:flex-row md:flex-wrap md:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-xs text-[#8c8c8c]">搜索（工具 / 模型 / 云厂商 / 产品 / 档位 / 备注）</span>
          <input
            className="rounded border border-[#d9d9d9] px-3 py-2 text-sm outline-none focus:border-[#1890ff]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="输入即筛选，无需回车"
          />
        </label>
        <label className="flex w-full min-w-[140px] flex-col gap-1 md:w-48">
          <span className="text-xs text-[#8c8c8c]">工具</span>
          <select
            className="rounded border border-[#d9d9d9] px-3 py-2 text-sm outline-none focus:border-[#1890ff]"
            value={toolKey}
            onChange={(e) => setToolKey(e.target.value)}
          >
            <option value="">全部工具</option>
            {toolKeys.map((tk) => (
              <option key={tk} value={tk}>
                {tk}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#595959]">
          <input
            type="checkbox"
            className="rounded border-[#d9d9d9]"
            checked={scope === "current"}
            onChange={(e) => setScope(e.target.checked ? "current" : "all")}
          />
          仅当前生效
        </label>
        <span className="text-xs text-[#8c8c8c] md:ml-auto">
          {loadState === "loading" ? "加载中…" : `共 ${rows.length} 条`}
          {truncated ? "（已达上限，请缩小搜索）" : ""}
        </span>
      </div>

      {errMsg ? (
        <div className="rounded border border-[#ffccc7] bg-[#fff2f0] px-3 py-2 text-sm text-[#a8071a]">
          {errMsg}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded border border-[#e8e8e8] bg-white">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#f0f0f0] bg-[#fafafa] text-xs text-[#8c8c8c]">
              <th className="px-3 py-2 font-medium">工具</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">云厂商</th>
              <th className="min-w-[12rem] max-w-[22rem] px-3 py-2 font-medium">厂商产品信息</th>
              <th className="px-3 py-2 font-medium">参考模型</th>
              <th className="px-3 py-2 font-medium">档位</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">成本(元)</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">系数 M</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">标价(点)</th>
              <th className="px-3 py-2 font-medium">状态</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap"> </th>
            </tr>
          </thead>
          <tbody className="text-[#262626]">
            {rows.length === 0 && loadState !== "loading" ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-[#8c8c8c]">
                  无匹配行；试清空搜索或勾选「全部生效范围」
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const mStr =
                  draftM[r.id] ??
                  (r.schemeAAdminRetailMultiplier != null
                    ? String(r.schemeAAdminRetailMultiplier)
                    : "");
                const saving = savingId === r.id;
                const err = rowErr[r.id];
                return (
                  <tr key={r.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa]/80">
                    <td className="px-3 py-2 font-mono text-xs">{r.toolKey}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-[#262626]">
                      {displayVendor(r.cloudVendor)}
                    </td>
                    <td className="max-w-[20rem] px-3 py-2 align-top text-xs leading-snug text-[#595959]">
                      <div
                        className="line-clamp-2 whitespace-pre-line break-words"
                        title={r.productInfo && r.productInfo !== "—" ? r.productInfo.replace(/\n/g, " · ") : undefined}
                      >
                        {r.productInfo ?? "—"}
                      </div>
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2 font-mono text-xs" title={r.schemeARefModelKey ?? ""}>
                      {r.schemeARefModelKey ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#595959]">{r.cloudTierRaw ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">{fmtCost(r.schemeAUnitCostYuan)}</td>
                    <td className="px-3 py-2">
                      <input
                        className="w-20 rounded border border-[#d9d9d9] px-2 py-1 font-mono text-xs tabular-nums outline-none focus:border-[#1890ff]"
                        value={mStr}
                        onChange={(e) =>
                          setDraftM((p) => ({
                            ...p,
                            [r.id]: e.target.value,
                          }))
                        }
                        inputMode="decimal"
                        aria-label={`系数 M · ${r.toolKey}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">{r.pricePoints}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-block rounded px-2 py-0.5 text-xs",
                          r.status === "current"
                            ? "bg-[#f6ffed] text-[#389e0d]"
                            : r.status === "inactive"
                              ? "bg-[#fff2e8] text-[#d46b08]"
                              : "bg-[#f5f5f5] text-[#595959]",
                        )}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          type="button"
                          disabled={!canSave(r) || saving}
                          onClick={() => void saveRow(r)}
                          className={cn(
                            "rounded px-2 py-1 text-xs font-medium",
                            canSave(r) && !saving
                              ? "bg-[#1890ff] text-white hover:bg-[#40a9ff]"
                              : "cursor-not-allowed bg-[#f5f5f5] text-[#bfbfbf]",
                          )}
                        >
                          {saving ? "保存中…" : "保存"}
                        </button>
                        {err ? <span className="max-w-[10rem] text-xs text-[#cf1322]">{err}</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
