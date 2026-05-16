"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BILL_COLUMN_GROUPS,
  filterColumnGroupsByRole,
  type BillViewerRole,
} from "@/lib/bill-config";
import { getBookMallBaseUrl, getFinanceDevUserId, getFinanceUseDevProxy } from "@/lib/book-mall-billing-url";
import { mergeFeeTypeOptions } from "@/lib/cloud-bill-fee-types";
import { BillMultiFilter, type BillMultiFilterMode } from "@/components/bill-multi-filter";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type BillDetailsClientProps = {
  /** 管理端：book-mall 用户 id（走管理员 API，需在 book-mall 以管理员登录） */
  adminTargetUserId?: string;
  /**
   * 视角：默认 `user`（不展示「云成本单价」「零售系数」两列）；管理端调用方传 `admin` 才展示完整列。
   */
  viewerRole?: BillViewerRole;
};

type RemotePayload = {
  source: string;
  user: { id: string; name: string | null; email: string | null };
  balancePoints: number;
  rows: Record<string, string>[];
};

const PAGE_SIZES = [10, 20, 50];

const K_BILL_MONTH = "账单信息/账单月份";
const K_FEE_TYPE = "账单信息/费用类型";
const K_PRODUCT = "产品信息/产品名称";
const K_COMMODITY = "产品信息/商品名称";

function matchesMulti(
  cell: string,
  selected: Set<string>,
  mode: BillMultiFilterMode,
): boolean {
  if (selected.size === 0) return true;
  const inSet = selected.has(cell);
  return mode === "include" ? inSet : !inSet;
}

export function BillDetailsClient({
  adminTargetUserId,
  viewerRole,
}: BillDetailsClientProps) {
  const effectiveRole: BillViewerRole =
    viewerRole ?? (adminTargetUserId ? "admin" : "user");
  const columnGroups = useMemo(
    () => filterColumnGroupsByRole(BILL_COLUMN_GROUPS, effectiveRole),
    [effectiveRole],
  );
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [hint, setHint] = useState<string | null>(null);
  const [remoteUser, setRemoteUser] = useState<RemotePayload["user"] | null>(null);
  const [walletBalancePoints, setWalletBalancePoints] = useState<number | null>(null);

  useEffect(() => {
    const useDevProxy = getFinanceUseDevProxy();
    const base = getBookMallBaseUrl();

    if (adminTargetUserId) {
      if (!base) {
        setLoadState("idle");
        setHint("未配置 NEXT_PUBLIC_BOOK_MALL_URL，无法请求 book-mall 拉取明细。");
        setRows([]);
        return;
      }
    } else if (!useDevProxy && !base) {
      setLoadState("idle");
      setHint("未配置 NEXT_PUBLIC_BOOK_MALL_URL，无法请求 book-mall 拉取明细。");
      setRows([]);
      return;
    }

    const devId = getFinanceDevUserId();
    let url: string;
    if (adminTargetUserId) {
      url = `${base}/api/admin/finance/billing-detail-lines?userId=${encodeURIComponent(adminTargetUserId)}`;
    } else if (useDevProxy) {
      url = "/api/dev/book-mall-account-billing";
    } else {
      const q = devId ? `?devUserId=${encodeURIComponent(devId)}` : "";
      url = `${base}/api/account/billing-detail-lines${q}`;
    }

    let cancelled = false;
    setLoadState("loading");
    const fetchInit: RequestInit =
      useDevProxy && !adminTargetUserId
        ? { credentials: "same-origin" }
        : { credentials: "include", mode: "cors" };

    fetch(url, fetchInit)
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
          throw new Error(j.hint || j.error || res.statusText);
        }
        return res.json() as Promise<RemotePayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setRemoteUser(data.user);
        setWalletBalancePoints(data.balancePoints);
        setLoadState("ok");
        setHint(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRows([]);
        setLoadState("error");
        setRemoteUser(null);
        setWalletBalancePoints(null);
        const msg = e instanceof Error ? e.message : String(e);
        const devProxyHint =
          useDevProxy && !adminTargetUserId
            ? "（开发代理）请确认 finance-web .env.local 已设 FINANCE_DEV_USER_ID 与 BOOK_MALL_URL，主站 FINANCE_ALLOW_DEV_USER_QUERY=1，且 book-mall 已启动。"
            : adminTargetUserId
              ? "管理员已在 book-mall 登录"
              : "用户已在 book-mall 登录，或本地开发已配置 NEXT_PUBLIC_FINANCE_DEV_USER_ID 且主站 FINANCE_ALLOW_DEV_USER_QUERY=1";
        setHint(`未能从 book-mall 拉取明细（${msg}）。请确认：① book-mall 已启动且可达；② ${devProxyHint}。`);
      });

    return () => {
      cancelled = true;
    };
  }, [adminTargetUserId]);

  const [billMonth, setBillMonth] = useState("");
  const [feeType, setFeeType] = useState("");
  const [productMode, setProductMode] = useState<BillMultiFilterMode>("include");
  const [productSelected, setProductSelected] = useState<Set<string>>(new Set());
  const [commodityMode, setCommodityMode] = useState<BillMultiFilterMode>("include");
  const [commoditySelected, setCommoditySelected] = useState<Set<string>>(new Set());
  const [includeZero, setIncludeZero] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const months = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_BILL_MONTH]))).filter(Boolean).sort(),
    [rows],
  );
  const products = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_PRODUCT]))).filter(Boolean).sort(),
    [rows],
  );
  const commodities = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_COMMODITY]))).filter(Boolean).sort(),
    [rows],
  );
  const feeTypesFromRows = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_FEE_TYPE]))).filter(Boolean).sort(),
    [rows],
  );
  const feeTypeOptions = useMemo(
    () => mergeFeeTypeOptions(feeTypesFromRows),
    [feeTypesFromRows],
  );

  useEffect(() => {
    setProductSelected((s) => new Set(Array.from(s).filter((p) => products.includes(p))));
  }, [products]);

  useEffect(() => {
    setCommoditySelected((s) => new Set(Array.from(s).filter((c) => commodities.includes(c))));
  }, [commodities]);

  useEffect(() => {
    if (feeType && !feeTypeOptions.includes(feeType)) setFeeType("");
  }, [feeType, feeTypeOptions]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (billMonth && r[K_BILL_MONTH] !== billMonth) return false;
      if (!matchesMulti(r[K_PRODUCT] ?? "", productSelected, productMode)) return false;
      if (!matchesMulti(r[K_COMMODITY] ?? "", commoditySelected, commodityMode)) return false;
      if (feeType && r[K_FEE_TYPE] !== feeType) return false;
      if (!includeZero) {
        const payable = parseFloat(r["应付信息/应付金额（含税）"] || "0");
        if (!payable) return false;
      }
      return true;
    });
  }, [
    rows,
    billMonth,
    feeType,
    includeZero,
    productSelected,
    productMode,
    commoditySelected,
    commodityMode,
  ]);

  const totalPoints = useMemo(
    () => filtered.reduce((s, r) => s + (parseInt(r["对内计价/本行扣点"], 10) || 0), 0),
    [filtered],
  );

  const balanceAfter =
    walletBalancePoints != null ? walletBalancePoints - totalPoints : null;

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#f5f5f5]">
      <div className="mx-4 mt-4 space-y-2">
        <div className="rounded border border-[#bae0ff] bg-[#e6f7ff] px-4 py-2 text-sm text-[#262626]">
          数据来源：
          {loadState === "loading" && "正在请求 book-mall …"}
          {loadState === "ok" && "book-mall 数据库（ToolBillingDetailLine），对内计价在接口侧按当前规则计算。"}
          {loadState === "error" && "上次请求失败，表中为当前页内数据（可能为空）。"}
          {loadState === "idle" && !hint && rows.length === 0 && "等待加载或缺少配置。"}
          {hint && <span className="mt-1 block text-[#d4380d]">{hint}</span>}
          详细规则见{" "}
          <code className="rounded bg-white px-1">tool-web/doc/reconciliation-baseline-2026-05-16.md</code>。
        </div>
        {remoteUser ? (
          <div className="rounded border border-[#d9d9d9] bg-white px-4 py-2 text-sm text-[#595959]">
            平台用户：<span className="text-[#262626]">{remoteUser.name || remoteUser.email || remoteUser.id}</span>（
            <code className="text-xs">{remoteUser.id}</code>）
          </div>
        ) : null}
      </div>

      <div className="m-4 rounded border border-[#e8e8e8] bg-white p-4">
        <div className="mb-4 flex flex-col gap-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className="text-[#8c8c8c]">账单月份</span>
              <select
                className="rounded border border-[#d9d9d9] px-2 py-1.5"
                value={billMonth}
                onChange={(e) => {
                  setBillMonth(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8c8c8c]">费用类型</span>
              <select
                className="rounded border border-[#d9d9d9] px-2 py-1.5"
                value={feeType}
                onChange={(e) => {
                  setFeeType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                {feeTypeOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[#8c8c8c]">含应付金额为 0</span>
              <select
                className="rounded border border-[#d9d9d9] px-2 py-1.5"
                value={includeZero ? "yes" : "no"}
                onChange={(e) => {
                  setIncludeZero(e.target.value === "yes");
                  setPage(1);
                }}
              >
                <option value="yes">是</option>
                <option value="no">否</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <BillMultiFilter
              label="产品名称"
              options={products}
              mode={productMode}
              onModeChange={(m) => {
                setProductMode(m);
                setPage(1);
              }}
              selected={productSelected}
              onSelectedChange={(next) => {
                setProductSelected(next);
                setPage(1);
              }}
              disabled={rows.length === 0}
            />
            <BillMultiFilter
              label="商品名称"
              options={commodities}
              mode={commodityMode}
              onModeChange={(m) => {
                setCommodityMode(m);
                setPage(1);
              }}
              selected={commoditySelected}
              onSelectedChange={(next) => {
                setCommoditySelected(next);
                setPage(1);
              }}
              disabled={rows.length === 0}
            />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-6 border-b border-[#f0f0f0] pb-3 text-sm">
          <div>
            <span className="text-[#8c8c8c]">筛选条数：</span>
            <span className="font-medium text-[#262626]">{filtered.length}</span>
          </div>
          <div>
            <span className="text-[#8c8c8c]">筛选范围内扣点合计：</span>
            <span className="font-medium text-[#262626]">{totalPoints}</span>
          </div>
          <div>
            <span className="text-[#8c8c8c]">钱包余额（点）：</span>
            <span className="font-medium text-[#262626]">
              {walletBalancePoints != null ? walletBalancePoints : "—"}
            </span>
          </div>
          {balanceAfter != null ? (
            <div>
              <span className="text-[#8c8c8c]">余额 − 筛选扣点合计：</span>
              <span className={cn("font-medium", balanceAfter < 0 ? "text-[#ff4d4f]" : "text-[#262626]")}>
                {balanceAfter}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-[#8c8c8c]">余额 − 筛选扣点：</span>
              <span className="font-medium text-[#8c8c8c]">登录主站后可算</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto border border-[#e8e8e8]">
          <table className="min-w-[3200px] border-collapse text-xs">
            <thead>
              <tr className="bg-[#fafafa]">
                {columnGroups.map((g) => (
                  <th
                    key={g.group}
                    colSpan={g.keys.length}
                    className="border border-[#e8e8e8] px-2 py-2 text-left font-medium text-[#262626]"
                  >
                    {g.group}
                  </th>
                ))}
              </tr>
              <tr className="bg-[#fafafa]">
                {columnGroups.flatMap((g) =>
                  g.keys.map((k) => (
                    <th
                      key={k}
                      className="whitespace-nowrap border border-[#e8e8e8] px-2 py-2 text-left font-normal text-[#595959]"
                    >
                      {k.includes("/") ? k.split("/").slice(1).join("/") : k}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, ri) => (
                <tr key={row["标识信息/账单明细ID"] || String(ri)} className="bg-white hover:bg-[#fafafa]">
                  {columnGroups.flatMap((g) =>
                    g.keys.map((k) => {
                      const v = row[k] ?? "";
                      const isVerbose =
                        k.includes("详情") ||
                        k.includes("过程") ||
                        k.includes("公式") ||
                        k.includes("转换信息");
                      const limit = isVerbose ? 200 : 80;
                      const long = v.length > limit;
                      return (
                        <td
                          key={k}
                          className={cn(
                            "border border-[#e8e8e8] px-2 py-1.5 align-top text-[#262626]",
                            long && (isVerbose ? "max-w-[min(480px,40vw)]" : "max-w-[240px]"),
                          )}
                          title={long ? v : undefined}
                        >
                          {long ? `${v.slice(0, limit)}…` : v || "—"}
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[#595959]">
          <div>
            共 <span className="text-[#262626]">{filtered.length}</span> 条 · 每页
            <select
              className="mx-1 rounded border border-[#d9d9d9] px-1 py-0.5"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            条
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pageSafe <= 1}
              className="rounded border border-[#d9d9d9] p-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              {pageSafe} / {pageCount}
            </span>
            <button
              type="button"
              disabled={pageSafe >= pageCount}
              className="rounded border border-[#d9d9d9] p-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
