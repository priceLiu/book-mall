"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BILL_COLUMN_GROUPS,
  filterColumnGroupsByRole,
  type BillViewerRole,
} from "@/lib/bill-config";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { getFinanceDevUserId, getFinanceUseDevProxy } from "@/lib/book-mall-billing-url";
import { mergeFeeTypeOptions } from "@/lib/cloud-bill-fee-types";
import { BillMultiFilter, type BillMultiFilterMode } from "@/components/bill-multi-filter";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type BillDetailsClientProps = {
  /** 指定 book-mall 用户 id（走管理员 API，需在 book-mall 以管理员登录） */
  adminTargetUserId?: string;
  /**
   * 视角：默认 `user`（不展示「云成本单价」「零售系数」两列）；传入 `admin` 时展示完整列。
   */
  viewerRole?: BillViewerRole;
  /**
   * `all-users` 模式（全部用户费用明细汇总）：
   *   - 调用 `/api/admin/finance/billing-detail-lines-all`（一次拉所有用户）
   *   - 隐藏「当前账单归属」等与单一登录用户绑定的顶部信息（按图示要求）
   *   - 不依赖 walletBalance（因没有"单一目标用户"概念），头部"钱包余额/余额减扣点"列折叠掉
   */
  mode?: "single-user" | "all-users";
};

type RemotePayload = {
  source: string;
  user: { id: string; name: string | null; email: string | null };
  balancePoints: number;
  rows: Record<string, string>[];
  /** 主站 API 返回：是否凭 NextAuth 会话拉取（本地 devUserId / 代理则非 session） */
  viewer?: { authMode: "session" | "dev_user_id" };
};

type AllUsersPayload = {
  source: string;
  rows: Record<string, string>[];
  total: number;
  returned: number;
  take: number;
  truncated: boolean;
};

const PAGE_SIZES = [10, 20, 50];

// v004：以「平台/*」作为主筛选维度——「平台/产品名称」是 catalog 命中后的 canonical 显示名，
// 在 TOOL_USAGE_GENERATED 与 CLOUD_CSV_IMPORT 两类行之间天然一致。
const K_BILL_MONTH = "平台账单/账单月份";
const K_FEE_TYPE = "平台账单/费用类型";
const K_PRODUCT = "平台/产品名称";
const K_COMMODITY = "厂商产品/商品名称";
const K_PLATFORM_POINTS = "平台/扣点";
/**
 * v007 Round 5：
 *   - 「厂商费用/目录总价」已删除（admin 心算可得，纯冗余）；
 *   - 「厂商应付/应付金额（含税）」→ 「平台/应付金额」（用户对平台应付，不是云口径）。
 */
const K_PAYABLE_YUAN = "平台/应付金额";
const K_USAGE_STEP_BAND = "厂商定价/目录价用量阶梯";

/** v004：阶梯字段「[0,9999999999999]」是"无阶梯占位"，前端折叠为友好文案；其它值原样显示。 */
function formatUsageStepBand(raw: string): string {
  if (!raw) return "";
  const t = raw.trim();
  if (t === "[0,9999999999999]") return "无阶梯";
  if (/^\[0,9{10,}\]$/.test(t)) return "无阶梯";
  return raw;
}

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
  mode = "single-user",
}: BillDetailsClientProps) {
  const base = useBookMallBaseUrl();
  const isAllUsers = mode === "all-users";
  const effectiveRole: BillViewerRole =
    viewerRole ?? (adminTargetUserId || isAllUsers ? "admin" : "user");
  const [allTotal, setAllTotal] = useState<number | null>(null);
  const [allTruncated, setAllTruncated] = useState(false);
  const columnGroups = useMemo(
    () => filterColumnGroupsByRole(BILL_COLUMN_GROUPS, effectiveRole),
    [effectiveRole],
  );
  /**
   * v007 Round 5 hotfix-3：筛选器也得跟随 admin-only 集合显示/隐藏。
   * 用户视角下「厂商产品/商品名称」整组隐藏 → 该筛选器不应渲染（否则用户能筛选自己看不见的列）。
   */
  const visibleKeys = useMemo(
    () => new Set(columnGroups.flatMap((g) => g.keys)),
    [columnGroups],
  );
  const canFilterCommodity = visibleKeys.has(K_COMMODITY);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [hint, setHint] = useState<string | null>(null);
  const [remoteUser, setRemoteUser] = useState<RemotePayload["user"] | null>(null);
  const [walletBalancePoints, setWalletBalancePoints] = useState<number | null>(null);
  const [viewerAuthMode, setViewerAuthMode] = useState<
    "session" | "dev_user_id" | undefined
  >(undefined);

  useEffect(() => {
    /**
     * v009：默认浏览器直连 book-mall 接口，使用主站真实 NextAuth 登录态。
     *   - localhost 跨端口（3002↔3000）属同站点，SameSite=Lax 的 session Cookie 会被发送；
     *   - 仅当用户在 URL 上显式 `?asDev=1` 时，才允许带 `?devUserId=` 模拟（仅本地）；
     *   - 仅当用户在 URL 上显式 `?useProxy=1` 时，才走 finance-web 服务端代理（即"以 FINANCE_DEV_USER_ID 模拟"）。
     *
     * 这两个开关都有强烈的红色顶部提示，避免再次出现「登录 A 看到 B 的明细」。
     */
    const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const explicitProxy = search?.get("useProxy") === "1";
    const explicitAsDev = search?.get("asDev") === "1";
    const useDevProxy = explicitProxy && getFinanceUseDevProxy();

    if (adminTargetUserId || isAllUsers) {
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

    const devId = explicitAsDev ? getFinanceDevUserId() : undefined;
    let url: string;
    if (isAllUsers) {
      url = `${base}/api/admin/finance/billing-detail-lines-all?take=2000`;
    } else if (adminTargetUserId) {
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
      useDevProxy && !adminTargetUserId && !isAllUsers
        ? { credentials: "same-origin", cache: "no-store" }
        : { credentials: "include", mode: "cors", cache: "no-store" };

    fetch(url, fetchInit)
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
          throw new Error(j.hint || j.error || `${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<RemotePayload | AllUsersPayload>;
      })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        if (isAllUsers) {
          const ad = data as AllUsersPayload;
          setAllTotal(ad.total);
          setAllTruncated(ad.truncated);
          setRemoteUser(null);
          setWalletBalancePoints(null);
          setViewerAuthMode(undefined);
        } else {
          const ud = data as RemotePayload;
          setRemoteUser(ud.user);
          setWalletBalancePoints(ud.balancePoints);
          setViewerAuthMode(
            ud.viewer?.authMode ?? ((useDevProxy || devId) && !adminTargetUserId ? "dev_user_id" : "session"),
          );
        }
        setLoadState("ok");
        setHint(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRows([]);
        setLoadState("error");
        setRemoteUser(null);
        setWalletBalancePoints(null);
        setViewerAuthMode(undefined);
        setAllTotal(null);
        setAllTruncated(false);
        const msg = e instanceof Error ? e.message : String(e);
        const tip = adminTargetUserId || isAllUsers
          ? "请确认：① book-mall 已启动且可达；② 当前浏览器以 ADMIN 角色登录到 book-mall（同浏览器打开 http://localhost:3000 → /login）。"
          : "请确认：① book-mall 已启动且可达；② 当前浏览器以你的真实账号登录到 book-mall（同浏览器打开 http://localhost:3000 → /login，再回到本页刷新）。";
        setHint(`未能从 book-mall 拉取明细（${msg}）。${tip}`);
      });

    return () => {
      cancelled = true;
    };
  }, [adminTargetUserId, isAllUsers, base]);

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
      if (canFilterCommodity && !matchesMulti(r[K_COMMODITY] ?? "", commoditySelected, commodityMode)) return false;
      if (feeType && r[K_FEE_TYPE] !== feeType) return false;
      if (!includeZero) {
        const payable = parseFloat(r[K_PAYABLE_YUAN] || "0");
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

  /** v004：用「平台/扣点」做"平台扣点合计"——TOOL_USAGE_GENERATED 行真值，CLOUD_CSV_IMPORT 行为空（不计入）。 */
  const totalPlatformPoints = useMemo(
    () => filtered.reduce((s, r) => s + (parseInt(r[K_PLATFORM_POINTS], 10) || 0), 0),
    [filtered],
  );
  /** v007 Round 5：「平台/应付金额」合计——用户对平台应付（= 平台扣点折元）。 */
  const totalPayableYuan = useMemo(
    () => filtered.reduce((s, r) => s + (parseFloat(r[K_PAYABLE_YUAN]) || 0), 0),
    [filtered],
  );

  const balanceAfter =
    walletBalancePoints != null ? walletBalancePoints - totalPlatformPoints : null;

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const isDevImpersonation = !adminTargetUserId && viewerAuthMode === "dev_user_id";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-[#f0f2f5]">
      <div className="mx-4 mt-4 space-y-3">
        {!isAllUsers && isDevImpersonation ? (
          <div className="rounded border-2 border-[#ff4d4f] bg-[#fff1f0] px-4 py-3 text-sm shadow-sm">
            <p className="text-base font-bold text-[#a8071a]">⚠️ 当前并非以你浏览器登录的真实账号在拉账单</p>
            <p className="mt-1 leading-relaxed text-[#820014]">
              主站接口报告 <code className="rounded bg-white px-1">authMode = dev_user_id</code>——这意味着请求里没有有效的{" "}
              <strong>NextAuth 会话 Cookie</strong>，主站改用了开发回退（URL 上的 <code className="rounded bg-white px-1">?devUserId=</code>{" "}
              或开发代理里的固定用户）。下方表格里的明细是<strong>那个固定用户</strong>的，不是你登录的账号的。
            </p>
            <p className="mt-2 leading-relaxed text-[#820014]">
              立即恢复正确账号的步骤：
            </p>
            <ol className="mt-1 list-inside list-decimal space-y-1 text-[#820014]">
              <li>
                同浏览器打开 <a className="underline" href="http://localhost:3000/login" target="_blank" rel="noreferrer">http://localhost:3000/login</a>{" "}
                以你的真实账号登录；
              </li>
              <li>
                关闭 finance-web 项目根的 <code className="rounded bg-white px-1">.env.development</code> /{" "}
                <code className="rounded bg-white px-1">.env.local</code> 里的{" "}
                <code className="rounded bg-white px-1">NEXT_PUBLIC_FINANCE_USE_DEV_PROXY</code>（不要默认开），并清掉{" "}
                <code className="rounded bg-white px-1">NEXT_PUBLIC_FINANCE_DEV_USER_ID</code>；
              </li>
              <li>重启 finance-web，刷新本页（带 <code className="rounded bg-white px-1">Cmd/Ctrl + Shift + R</code> 硬刷新）。</li>
            </ol>
          </div>
        ) : null}

        {!isAllUsers && remoteUser ? (
          <div
            className={cn(
              "rounded border px-4 py-3 text-sm shadow-sm",
              isDevImpersonation
                ? "border-[#ff4d4f] bg-white"
                : "border-[#1890ff] bg-[#f0f7ff]",
            )}
          >
            <div className={cn("mb-2 font-medium", isDevImpersonation ? "text-[#a8071a]" : "text-[#0958d9]")}>
              {isDevImpersonation
                ? "下表对应的「目标账号」（非你的真实登录态）"
                : "当前账单归属（主站账号 · 与明细行锁定同一用户）"}
            </div>
            <dl className="grid gap-2 sm:grid-cols-1 md:grid-cols-3">
              <div>
                <dt className="text-xs text-[#8c8c8c]">登录邮箱</dt>
                <dd className="mt-0.5 break-all font-medium text-[#262626]">
                  {remoteUser.email?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#8c8c8c]">昵称</dt>
                <dd className="mt-0.5 font-medium text-[#262626]">
                  {remoteUser.name?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#8c8c8c]">用户 ID（book-mall User.id）</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-[#262626]">{remoteUser.id}</dd>
              </div>
            </dl>
            {effectiveRole === "admin" ? (
              <p className="mt-2 text-xs text-[#8c8c8c]">代查指定用户时，以上为目标账号信息。</p>
            ) : (
              <p className="mt-2 text-xs text-[#8c8c8c]">
                认证方式：
                {viewerAuthMode === "session" ? (
                  <span className="text-[#262626]">主站 NextAuth 会话（Cookie 已随请求到达 book-mall）</span>
                ) : viewerAuthMode === "dev_user_id" ? (
                  <span className="font-medium text-[#a8071a]">开发回退（非会话）——上方红框已说明如何切回真实账号</span>
                ) : (
                  <span className="text-[#595959]">加载完成后显示</span>
                )}
              </p>
            )}
          </div>
        ) : null}

        {!isAllUsers && (loadState === "loading" || loadState === "error" || (loadState === "idle" && hint)) ? (
          <div
            className={cn(
              "rounded border px-4 py-2 text-sm",
              loadState === "error"
                ? "border-[#ffccc7] bg-[#fff2f0] text-[#a8071a]"
                : loadState === "idle" && hint
                  ? "border-[#ffe58f] bg-[#fffbe6] text-[#874d00]"
                  : "border-[#d9d9d9] bg-white text-[#595959]",
            )}
          >
            {loadState === "loading" && "正在请求 book-mall …"}
            {(loadState === "error" || (loadState === "idle" && hint)) && hint ? (
              <span className="block">{hint}</span>
            ) : null}
          </div>
        ) : null}

        {isAllUsers && (loadState === "loading" || loadState === "error" || hint) ? (
          <div
            className={cn(
              "rounded border px-4 py-2 text-sm",
              loadState === "error"
                ? "border-[#ffccc7] bg-[#fff2f0] text-[#a8071a]"
                : "border-[#d9d9d9] bg-white text-[#595959]",
            )}
          >
            {loadState === "loading" && "正在请求 book-mall …"}
            {hint && <span className="block">{hint}</span>}
          </div>
        ) : null}
        {isAllUsers && allTruncated && allTotal != null ? (
          <div className="rounded border border-[#ffe58f] bg-[#fffbe6] px-4 py-2 text-sm text-[#874d00]">
            当前显示前 {rows.length} 条；数据库共 {allTotal} 条已截断。如需更多请细化日期范围或联系开发扩容。
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
          <div
            className={
              canFilterCommodity
                ? "grid gap-4 lg:grid-cols-2"
                : "grid gap-4"
            }
          >
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
            {canFilterCommodity && (
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
            )}
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-6 border-b border-[#f0f0f0] pb-3 text-sm">
          <div>
            <span className="text-[#8c8c8c]">筛选条数：</span>
            <span className="font-medium text-[#262626]">{filtered.length}</span>
          </div>
          {/* v007 Round 5：双栏合计——平台扣点 + 应付金额（用户对平台支付）。云目录总价合计已删除（admin 心算可得） */}
          <div>
            <span className="text-[#8c8c8c]">平台扣点合计：</span>
            <span className="font-medium text-[#1d39c4]">{totalPlatformPoints}</span>
          </div>
          <div>
            <span className="text-[#8c8c8c]">应付金额合计：</span>
            <span className="font-medium text-[#262626]">¥{totalPayableYuan.toFixed(2)}</span>
          </div>
          {!isAllUsers ? (
            <div>
              <span className="text-[#8c8c8c]">钱包余额（点）：</span>
              <span className="font-medium text-[#262626]">
                {walletBalancePoints != null ? walletBalancePoints : "—"}
              </span>
            </div>
          ) : null}
          {!isAllUsers ? (
            balanceAfter != null ? (
              <div>
                <span className="text-[#8c8c8c]">余额 − 平台扣点合计：</span>
                <span
                  className={cn(
                    "font-medium",
                    balanceAfter < 0 ? "text-[#ff4d4f]" : "text-[#262626]",
                  )}
                >
                  {balanceAfter}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-[#8c8c8c]">余额 − 平台扣点：</span>
                <span className="font-medium text-[#8c8c8c]">登录主站后可算</span>
              </div>
            )
          ) : null}
          {isAllUsers && allTotal != null ? (
            <div>
              <span className="text-[#8c8c8c]">DB 总条数：</span>
              <span className="font-medium text-[#262626]">{allTotal}</span>
              {allTruncated ? (
                <span className="ml-1 text-xs text-[#fa8c16]">（已截断）</span>
              ) : null}
            </div>
          ) : null}
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
                // v006 Round 4：「平台/用户ID + 平台账单/消费时间 + 平台/计费项Code + 平台用量/用量」拼成稳定 key
                <tr
                  key={
                    [row["平台/用户ID"], row["平台账单/消费时间"], row["平台/计费项Code"], row["平台用量/用量"]]
                      .filter(Boolean)
                      .join("|") || String(ri)
                  }
                  className="bg-white hover:bg-[#fafafa]"
                >
                  {columnGroups.flatMap((g) =>
                    g.keys.map((k) => {
                      const rawV = row[k] ?? "";
                      // v006 Round 4：「厂商定价/目录价用量阶梯」= [0,9999999999999] 折叠为"无阶梯"
                      const v = k === K_USAGE_STEP_BAND ? formatUsageStepBand(rawV) : rawV;
                      const isVerbose = k.includes("详情") || k.includes("公式");
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
