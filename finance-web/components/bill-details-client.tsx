"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BILL_COLUMN_GROUPS,
  filterColumnGroupsByRole,
  K_CREDITS_CONSUMED,
  K_INCLUDED_REMAINING,
  K_INCLUDED_USED,
  K_GATEWAY_KEY,
  K_USER_KEY,
  type BillViewerRole,
} from "@/lib/bill-config";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { bookMallLoginHint } from "@/lib/book-mall-login-hint";
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import { getFinanceDevUserId, getFinanceUseDevProxy } from "@/lib/book-mall-billing-url";
import { BillMultiFilter, type BillMultiFilterMode } from "@/components/bill-multi-filter";
import {
  PackageReconciliationPanel,
  type PackageReconciliationData,
} from "@/components/package-reconciliation-panel";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

export type BillDetailsClientProps = {
  /** 指定 book-mall 用户 id（走管理员 API，需在 book-mall 以管理员登录） */
  adminTargetUserId?: string;
  /** 团队费用明细（OWNER/ADMIN） */
  teamScope?: boolean;
  teamTenantId?: string;
  teamActorUserId?: string;
  /** 平台员工查看某团队明细（含成本列） */
  adminTeamTenantId?: string;
  /**
   * 视角：默认 `user`（不展示「云成本单价」「零售系数」两列）；传入 `admin` 时展示完整列。
   */
  viewerRole?: BillViewerRole;
  /**
   * `all-users` 模式（全部用户费用明细汇总）：
   *   - 调用 `/api/finance/admin/billing-details-all`（一次拉所有用户）
   *   - 隐藏「当前账单归属」等与单一登录用户绑定的顶部信息（按图示要求）
   *   - 不依赖 walletBalance（因没有"单一目标用户"概念），头部「钱包余额 / 余额减积分消耗」折叠
   */
  mode?: "single-user" | "all-users";
};

type RemotePayload = {
  source: string;
  tab?: "usage" | "charge";
  user?: { id: string; name: string | null; email: string | null; phone: string | null };
  tenant?: { id: string; name: string | null };
  tenantId?: string;
  tenantName?: string | null;
  balancePoints: number;
  poolBalances?: { general: number; video: number };
  totalCalls?: number;
  succeededCalls?: number;
  failedCalls?: number;
  returned?: number;
  take?: number;
  truncated?: boolean;
  rows: Record<string, string>[];
  packageReconciliation?: PackageReconciliationData | null;
  /** 主站 API 返回：是否凭 NextAuth 会话拉取（本地 devUserId / 代理则非 session） */
  viewer?: { authMode: "session" | "dev_user_id" };
};

type AllUsersPayload = {
  source: string;
  tab?: "usage" | "charge";
  rows: Record<string, string>[];
  total: number;
  returned: number;
  take: number;
  truncated: boolean;
  totalCalls?: number;
  succeededCalls?: number;
  failedCalls?: number;
};

const PAGE_SIZES = [10, 20, 50];

// v004：以「平台/*」作为主筛选维度——「平台/产品名称」是 catalog 命中后的 canonical 显示名，
// 在 TOOL_USAGE_GENERATED 与 CLOUD_CSV_IMPORT 两类行之间天然一致。
const K_USER_ID = "平台/用户ID";
const K_USER_NAME = "平台/用户名";
const K_MODEL_CODE = "平台/模型Code";
const K_MODEL_NAME = "平台/模型名称";
const K_TASK_KIND = "套餐对帐/任务类型";
const K_CONSUME_TIME = "平台账单/消费时间";
const K_GATEWAY_LOG_ID = "平台/Gateway日志ID";
const K_BILL_MONTH = "平台账单/账单月份";
const K_FEE_DESC = "平台账单/费用说明";
const K_TOOL_PAGE = "平台/工具页面";
const K_STATUS = "平台/状态";

function billColumnHeaderLabel(key: string): string {
  if (key === K_INCLUDED_USED) return "结算后已用";
  if (key === K_INCLUDED_REMAINING) return "结算后剩余";
  if (key === K_GATEWAY_KEY) return "Gateway Key";
  if (key === K_USER_KEY) return "User Key";
  if (key.includes("/")) return key.split("/").slice(1).join("/");
  return key;
}

function rowSortTime(row: Record<string, string>): number {
  const t = row[K_CONSUME_TIME]?.trim();
  if (!t) return 0;
  const ms = Date.parse(t.replace(" ", "T"));
  return Number.isFinite(ms) ? ms : 0;
}

function rowStableKey(row: Record<string, string>, ri: number): string {
  return (
    [row[K_USER_ID], row[K_GATEWAY_LOG_ID], row[K_CONSUME_TIME]]
      .filter(Boolean)
      .join("|") || String(ri)
  );
}

type UserBillGroup = {
  userId: string;
  userName: string;
  latestTime: number;
  latestTimeLabel: string;
  rows: Record<string, string>[];
  credits: number;
};

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
  teamScope,
  teamTenantId,
  teamActorUserId,
  adminTeamTenantId,
  viewerRole,
  mode = "single-user",
}: BillDetailsClientProps) {
  const base = useBookMallBaseUrl();
  const isAllUsers = mode === "all-users";
  const isTeamScope = Boolean(teamScope || teamTenantId || adminTeamTenantId);
  const effectiveRole: BillViewerRole =
    viewerRole ??
    (adminTargetUserId || isAllUsers || adminTeamTenantId ? "admin" : "user");
  const [allTotal, setAllTotal] = useState<number | null>(null);
  const [allTruncated, setAllTruncated] = useState(false);
  const [rowsTruncated, setRowsTruncated] = useState(false);
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
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [hint, setHint] = useState<string | null>(null);
  const [remoteUser, setRemoteUser] = useState<RemotePayload["user"] | null>(null);
  const [remoteTenantName, setRemoteTenantName] = useState<string | null>(null);
  const [walletBalancePoints, setWalletBalancePoints] = useState<number | null>(null);
  const [totalCallsRemote, setTotalCallsRemote] = useState<number | null>(null);
  const [succeededCallsRemote, setSucceededCallsRemote] = useState<number | null>(null);
  const [failedCallsRemote, setFailedCallsRemote] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"usage" | "charge">("usage");
  const [viewerAuthMode, setViewerAuthMode] = useState<
    "session" | "dev_user_id" | undefined
  >(undefined);
  const [packageReconciliation, setPackageReconciliation] =
    useState<PackageReconciliationData | null>(null);
  const [groupByUser, setGroupByUser] = useState(true);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const tabParam = search?.get("tab");
    const tab: "usage" | "charge" = tabParam === "charge" ? "charge" : "usage";
    setActiveTab(tab);

    /**
     * v009：默认浏览器直连 book-mall 接口，使用主站真实 NextAuth 登录态。
     *   - localhost 跨端口（3002↔3000）属同站点，SameSite=Lax 的 session Cookie 会被发送；
     *   - 仅当用户在 URL 上显式 `?asDev=1` 时，才允许带 `?devUserId=` 模拟（仅本地）；
     *   - 仅当用户在 URL 上显式 `?useProxy=1` 时，才走 finance-web 服务端代理（即"以 FINANCE_DEV_USER_ID 模拟"）。
     *
     * 这两个开关都有强烈的红色顶部提示，避免再次出现「登录 A 看到 B 的明细」。
     */
    const explicitProxy = search?.get("useProxy") === "1";
    const explicitAsDev = search?.get("asDev") === "1";
    const useDevProxy = explicitProxy && getFinanceUseDevProxy();

    if (adminTargetUserId || isAllUsers || isTeamScope) {
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
    let fetchInit: RequestInit;
    if (useDevProxy && !adminTargetUserId && !isAllUsers && !isTeamScope) {
      url = "/api/dev/book-mall-account-billing";
      fetchInit = { credentials: "same-origin", cache: "no-store" };
    } else {
      let apiPath: string;
      const tabQs = `tab=${encodeURIComponent(tab)}`;
      if (isAllUsers) {
        apiPath = `/api/finance/admin/billing-details-all?take=2000&${tabQs}`;
      } else if (adminTeamTenantId) {
        const actorQs = teamActorUserId
          ? `&actorUserId=${encodeURIComponent(teamActorUserId)}`
          : "";
        apiPath = `/api/finance/admin/teams/${encodeURIComponent(adminTeamTenantId)}/billing-details?take=2000&${tabQs}${actorQs}`;
      } else if (adminTargetUserId) {
        apiPath = `/api/finance/admin/billing-details?userId=${encodeURIComponent(adminTargetUserId)}&take=2000&${tabQs}`;
      } else if (teamScope || teamTenantId) {
        const actorQs = teamActorUserId
          ? `&actorUserId=${encodeURIComponent(teamActorUserId)}`
          : "";
        const tenantQs = teamTenantId ? `tenantId=${encodeURIComponent(teamTenantId)}&` : "";
        apiPath = `/api/finance/team/billing-details?${tenantQs}take=2000&${tabQs}${actorQs}`;
      } else {
        const extra = devId ? `&devUserId=${encodeURIComponent(devId)}` : "";
        apiPath = `/api/finance/account/billing-details?take=2000&${tabQs}${extra}`;
      }
      ({ url, init: fetchInit } = resolveBookMallBrowserRequest(base, apiPath));
    }

    let cancelled = false;
    setLoadState("loading");

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
          setRowsTruncated(false);
          setTotalCallsRemote(ad.totalCalls ?? null);
          setSucceededCallsRemote(ad.succeededCalls ?? null);
          setFailedCallsRemote(ad.failedCalls ?? null);
          setRemoteUser(null);
          setRemoteTenantName(null);
          setWalletBalancePoints(null);
          setViewerAuthMode(undefined);
          setPackageReconciliation(null);
        } else {
          const ud = data as RemotePayload;
          setRemoteUser(ud.user ?? null);
          setRemoteTenantName(ud.tenant?.name ?? ud.tenantName ?? null);
          setWalletBalancePoints(ud.balancePoints);
          setTotalCallsRemote(ud.totalCalls ?? null);
          setSucceededCallsRemote(ud.succeededCalls ?? null);
          setFailedCallsRemote(ud.failedCalls ?? null);
          setPackageReconciliation(ud.packageReconciliation ?? null);
          setRowsTruncated(Boolean(ud.truncated));
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
        setRemoteTenantName(null);
        setWalletBalancePoints(null);
        setTotalCallsRemote(null);
        setViewerAuthMode(undefined);
        setAllTotal(null);
        setAllTruncated(false);
        setRowsTruncated(false);
        setPackageReconciliation(null);
        const msg = e instanceof Error ? e.message : String(e);
        const tip = bookMallLoginHint(
          base,
          adminTargetUserId || isAllUsers || adminTeamTenantId ? "admin" : isTeamScope ? "team" : "user",
        ).text;
        setHint(`未能从 book-mall 拉取明细（${msg}）。${tip}`);
      });

    return () => {
      cancelled = true;
    };
  }, [adminTargetUserId, adminTeamTenantId, teamScope, teamTenantId, teamActorUserId, isAllUsers, isTeamScope, base, activeTab]);

  function switchTab(next: "usage" | "charge") {
    setActiveTab(next);
    setPage(1);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", next);
      window.history.replaceState(null, "", u.toString());
    }
  }

  const [billMonth, setBillMonth] = useState("");
  const [feeDesc, setFeeDesc] = useState("");
  const [toolPageFilter, setToolPageFilter] = useState("");
  const [productMode, setProductMode] = useState<BillMultiFilterMode>("include");
  const [productSelected, setProductSelected] = useState<Set<string>>(new Set());
  const [gatewayKeyMode, setGatewayKeyMode] = useState<BillMultiFilterMode>("include");
  const [gatewayKeySelected, setGatewayKeySelected] = useState<Set<string>>(new Set());
  const [userKeyMode, setUserKeyMode] = useState<BillMultiFilterMode>("include");
  const [userKeySelected, setUserKeySelected] = useState<Set<string>>(new Set());
  const [includeZeroCredits, setIncludeZeroCredits] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const months = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_BILL_MONTH]))).filter(Boolean).sort(),
    [rows],
  );
  const models = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_MODEL_NAME]))).filter(Boolean).sort(),
    [rows],
  );
  const feeDescOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_FEE_DESC]))).filter(Boolean).sort(),
    [rows],
  );
  const toolPages = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_TOOL_PAGE]))).filter(Boolean).sort(),
    [rows],
  );
  const gatewayKeys = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_GATEWAY_KEY]))).filter(Boolean).sort(),
    [rows],
  );
  const userKeys = useMemo(
    () => Array.from(new Set(rows.map((r) => r[K_USER_KEY]))).filter(Boolean).sort(),
    [rows],
  );

  useEffect(() => {
    setProductSelected((s) => new Set(Array.from(s).filter((p) => models.includes(p))));
  }, [models]);

  useEffect(() => {
    setGatewayKeySelected((s) => new Set(Array.from(s).filter((p) => gatewayKeys.includes(p))));
  }, [gatewayKeys]);

  useEffect(() => {
    setUserKeySelected((s) => new Set(Array.from(s).filter((p) => userKeys.includes(p))));
  }, [userKeys]);

  useEffect(() => {
    if (feeDesc && !feeDescOptions.includes(feeDesc)) setFeeDesc("");
  }, [feeDesc, feeDescOptions]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (billMonth && r[K_BILL_MONTH] !== billMonth) return false;
      if (!matchesMulti(r[K_MODEL_NAME] ?? "", productSelected, productMode)) return false;
      if (toolPageFilter && !(r[K_TOOL_PAGE] ?? "").includes(toolPageFilter)) return false;
      if (feeDesc && r[K_FEE_DESC] !== feeDesc) return false;
      if (!matchesMulti(r[K_GATEWAY_KEY] ?? "", gatewayKeySelected, gatewayKeyMode)) return false;
      if (!matchesMulti(r[K_USER_KEY] ?? "", userKeySelected, userKeyMode)) return false;
      if (!includeZeroCredits) {
        const credits = parseInt(r[K_CREDITS_CONSUMED] || "0", 10);
        if (!credits) return false;
      }
      return true;
    });
  }, [
    rows,
    billMonth,
    feeDesc,
    toolPageFilter,
    includeZeroCredits,
    productSelected,
    productMode,
    gatewayKeySelected,
    gatewayKeyMode,
    userKeySelected,
    userKeyMode,
  ]);

  const filteredSorted = useMemo(
    () =>
      [...filtered].sort((a, b) => rowSortTime(b) - rowSortTime(a)),
    [filtered],
  );

  const totalColumnCount = useMemo(
    () => columnGroups.reduce((n, g) => n + g.keys.length, 0),
    [columnGroups],
  );

  const userGroups = useMemo((): UserBillGroup[] => {
    if (!isAllUsers || effectiveRole !== "admin") return [];
    const map = new Map<string, UserBillGroup>();
    for (const row of filteredSorted) {
      const userId = row[K_USER_ID]?.trim() || "—";
      const t = rowSortTime(row);
      const prev = map.get(userId);
      if (!prev) {
        map.set(userId, {
          userId,
          userName: row[K_USER_NAME]?.trim() || userId,
          latestTime: t,
          latestTimeLabel: row[K_CONSUME_TIME]?.trim() || "—",
          rows: [row],
          credits:
            parseInt(row[K_CREDITS_CONSUMED] || "0", 10) || 0,
        });
        continue;
      }
      prev.rows.push(row);
      prev.credits += parseInt(row[K_CREDITS_CONSUMED] || "0", 10) || 0;
      if (t >= prev.latestTime) {
        prev.latestTime = t;
        prev.latestTimeLabel = row[K_CONSUME_TIME]?.trim() || prev.latestTimeLabel;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.latestTime - a.latestTime);
  }, [filteredSorted, isAllUsers, effectiveRole]);

  const useUserGrouping = isAllUsers && effectiveRole === "admin" && groupByUser;

  const totalCreditsConsumed = useMemo(
    () => filtered.reduce((s, r) => s + (parseInt(r[K_CREDITS_CONSUMED], 10) || 0), 0),
    [filtered],
  );

  const balanceAfter =
    walletBalancePoints != null ? walletBalancePoints - totalCreditsConsumed : null;

  const groupedSummary = useMemo(() => {
    if (!isAllUsers || effectiveRole !== "admin") return [];
    const map = new Map<
      string,
      {
        userId: string;
        userName: string;
        modelCode: string;
        modelName: string;
        taskKind: string;
        count: number;
        credits: number;
        latestTime: number;
      }
    >();
    for (const row of filteredSorted) {
      const userId = row[K_USER_ID] ?? "";
      const userName = row[K_USER_NAME] ?? "";
      const modelCode = row[K_MODEL_CODE] ?? "";
      const modelName = row[K_MODEL_NAME] ?? "";
      const taskKind = row[K_TASK_KIND] ?? "";
      const key = [userId, modelCode, taskKind].join("|");
      const t = rowSortTime(row);
      const prev = map.get(key) ?? {
        userId,
        userName,
        modelCode,
        modelName,
        taskKind,
        count: 0,
        credits: 0,
        latestTime: 0,
      };
      prev.count += 1;
      prev.credits += parseInt(row[K_CREDITS_CONSUMED] || "0", 10) || 0;
      if (t >= prev.latestTime) prev.latestTime = t;
      map.set(key, prev);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.latestTime - a.latestTime ||
        a.userName.localeCompare(b.userName, "zh-CN") ||
        a.modelCode.localeCompare(b.modelCode),
    );
  }, [filteredSorted, isAllUsers, effectiveRole]);

  const pageCount = useMemo(() => {
    if (useUserGrouping) return Math.max(1, Math.ceil(userGroups.length / pageSize));
    return Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  }, [useUserGrouping, userGroups.length, filteredSorted.length, pageSize]);
  const pageSafe = Math.min(page, pageCount);
  const paged = useMemo(
    () =>
      filteredSorted.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [filteredSorted, pageSafe, pageSize],
  );
  const pagedUserGroups = useMemo(
    () => userGroups.slice((pageSafe - 1) * pageSize, pageSafe * pageSize),
    [userGroups, pageSafe, pageSize],
  );

  function toggleUserExpanded(userId: string) {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function renderDetailRow(row: Record<string, string>, ri: number) {
    return (
      <tr key={rowStableKey(row, ri)} className="bg-white hover:bg-[#fafafa]">
        {columnGroups.flatMap((g) =>
          g.keys.map((k) => {
            const v = row[k] ?? "";
            const isVerbose = k.includes("详情") || k.includes("公式");
            const limit = isVerbose ? 200 : 80;
            const long = v.length > limit;
            const isFailedStatus = k === K_STATUS && v === "失败";
            return (
              <td
                key={k}
                className={cn(
                  "border border-[#e8e8e8] px-2 py-1.5 align-top",
                  isFailedStatus ? "font-medium text-[#ff4d4f]" : "text-[#262626]",
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
    );
  }

  const isDevImpersonation = !adminTargetUserId && viewerAuthMode === "dev_user_id";

  return (
    <div className="flex w-full flex-col bg-[#f0f2f5]">
      <div className="flex w-full flex-col gap-3 p-6">
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

        {!isAllUsers && isTeamScope && remoteTenantName ? (
          <div className="rounded border border-[#1890ff] bg-[#f0f7ff] px-4 py-3 text-sm shadow-sm">
            <div className="mb-2 font-medium text-[#0958d9]">当前团队账单归属</div>
            <p className="text-[#262626]">{remoteTenantName}</p>
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
            <dl className="grid gap-2 sm:grid-cols-1 md:grid-cols-4">
              <div>
                <dt className="text-xs text-[#8c8c8c]">手机号</dt>
                <dd className="mt-0.5 break-all font-medium text-[#262626]">
                  {remoteUser.phone?.trim() || "—"}
                </dd>
              </div>
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

        {!isAllUsers && packageReconciliation ? (
          <PackageReconciliationPanel data={packageReconciliation} />
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
        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-[#f0f0f0] pb-3">
          <button
            type="button"
            onClick={() => switchTab("usage")}
            className={cn(
              "rounded px-3 py-1.5 text-sm",
              activeTab === "usage"
                ? "bg-[#1890ff] text-white"
                : "border border-[#d9d9d9] bg-white text-[#595959] hover:border-[#1890ff]",
            )}
          >
            全部用量
          </button>
          <button
            type="button"
            onClick={() => switchTab("charge")}
            className={cn(
              "rounded px-3 py-1.5 text-sm",
              activeTab === "charge"
                ? "bg-[#1890ff] text-white"
                : "border border-[#d9d9d9] bg-white text-[#595959] hover:border-[#1890ff]",
            )}
          >
            积分扣费明细
          </button>
          <span className="text-xs text-[#8c8c8c]">
            {activeTab === "usage"
              ? "含成功与失败调用；BYOK 套餐内 0 积分行亦展示"
              : "仅实际消耗积分 > 0 的行"}
          </span>
        </div>
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
              <span className="text-[#8c8c8c]">费用说明</span>
              <select
                className="rounded border border-[#d9d9d9] px-2 py-1.5"
                value={feeDesc}
                onChange={(e) => {
                  setFeeDesc(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部</option>
                {feeDescOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            {visibleKeys.has(K_TOOL_PAGE) ? (
              <label className="flex flex-col gap-1">
                <span className="text-[#8c8c8c]">工具页面</span>
                <select
                  className="rounded border border-[#d9d9d9] px-2 py-1.5"
                  value={toolPageFilter}
                  onChange={(e) => {
                    setToolPageFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">全部</option>
                  {toolPages.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className="text-[#8c8c8c]">含消耗积分为 0</span>
              <select
                className="rounded border border-[#d9d9d9] px-2 py-1.5"
                value={includeZeroCredits ? "yes" : "no"}
                onChange={(e) => {
                  setIncludeZeroCredits(e.target.value === "yes");
                  setPage(1);
                }}
              >
                <option value="yes">是</option>
                <option value="no">否</option>
              </select>
            </label>
          </div>
          <BillMultiFilter
            label="模型名称"
            options={models}
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
          <div className="grid gap-3 md:grid-cols-2">
            <BillMultiFilter
              label="Gateway Key"
              options={gatewayKeys}
              mode={gatewayKeyMode}
              onModeChange={(m) => {
                setGatewayKeyMode(m);
                setPage(1);
              }}
              selected={gatewayKeySelected}
              onSelectedChange={(next) => {
                setGatewayKeySelected(next);
                setPage(1);
              }}
              disabled={rows.length === 0}
            />
            <BillMultiFilter
              label="User Key"
              options={userKeys}
              mode={userKeyMode}
              onModeChange={(m) => {
                setUserKeyMode(m);
                setPage(1);
              }}
              selected={userKeySelected}
              onSelectedChange={(next) => {
                setUserKeySelected(next);
                setPage(1);
              }}
              disabled={rows.length === 0}
            />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-6 border-b border-[#f0f0f0] pb-3 text-sm">
          {(rowsTruncated || allTruncated) ? (
            <div className="w-full rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              仅加载最近 {isAllUsers ? "2000" : "2000"} 条明细
              {allTotal != null ? `（库内共 ${allTotal} 条）` : ""}
              。更早记录（例如昨晚生成）可能未出现在本页，请缩小日期筛选或联系管理员导出。
            </div>
          ) : null}
          <div>
            <span className="text-[#8c8c8c]">筛选条数：</span>
            <span className="font-medium text-[#262626]">{filtered.length}</span>
          </div>
          <div>
            <span className="text-[#8c8c8c]">积分消耗合计：</span>
            <span className="font-medium text-[#1d39c4]">{totalCreditsConsumed}</span>
          </div>
          {activeTab === "usage" && (succeededCallsRemote != null || failedCallsRemote != null) ? (
            <div>
              <span className="text-[#8c8c8c]">成功 / 失败：</span>
              <span className="font-medium text-[#262626]">
                {succeededCallsRemote ?? 0}
              </span>
              <span className="text-[#8c8c8c]"> / </span>
              <span
                className={cn(
                  "font-medium",
                  (failedCallsRemote ?? 0) > 0 ? "text-[#ff4d4f]" : "text-[#262626]",
                )}
              >
                {failedCallsRemote ?? 0}
              </span>
            </div>
          ) : activeTab === "usage" && totalCallsRemote != null ? (
            <div>
              <span className="text-[#8c8c8c]">成功调用总次数：</span>
              <span className="font-medium text-[#262626]">{totalCallsRemote}</span>
            </div>
          ) : null}
          {!isAllUsers ? (
            <div>
              <span className="text-[#8c8c8c]">积分余额：</span>
              <span className="font-medium text-[#262626]">
                {walletBalancePoints != null ? walletBalancePoints : "—"}
              </span>
            </div>
          ) : null}
          {!isAllUsers ? (
            balanceAfter != null ? (
              <div>
                <span className="text-[#8c8c8c]">余额 − 积分消耗合计：</span>
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
                <span className="text-[#8c8c8c]">余额 − 积分消耗：</span>
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

        {isAllUsers && effectiveRole === "admin" ? (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={groupByUser}
                onChange={(e) => {
                  setGroupByUser(e.target.checked);
                  setPage(1);
                }}
              />
              <span>按用户折叠明细</span>
            </label>
            {groupByUser ? (
              <>
                <button
                  type="button"
                  className="rounded border border-[#d9d9d9] px-2 py-0.5 text-xs hover:border-[#1890ff]"
                  onClick={() =>
                    setExpandedUsers(new Set(pagedUserGroups.map((g) => g.userId)))
                  }
                >
                  展开本页用户
                </button>
                <button
                  type="button"
                  className="rounded border border-[#d9d9d9] px-2 py-0.5 text-xs hover:border-[#1890ff]"
                  onClick={() => setExpandedUsers(new Set())}
                >
                  折叠本页用户
                </button>
              </>
            ) : null}
            <span className="text-xs text-[#8c8c8c]">
              用户组与明细均按消费时间倒序；组内明细亦倒序。
            </span>
          </div>
        ) : null}

        {isAllUsers && groupedSummary.length > 0 ? (
          <div className="mb-4 rounded border border-[#e8e8e8] bg-[#fafafa] p-3">
            <p className="mb-2 text-xs font-medium text-[#262626]">
              汇总视图（当前筛选 · 按用户 + 模型 + 任务类型）
            </p>
            <p className="mb-2 text-[11px] text-[#8c8c8c]">
              「结算后已用 / 结算后剩余」按<strong>同任务类型 + 账单月</strong>、消费时间顺序累计（每次套餐内扣次 -1）；与「套餐对帐」面板「套餐已用」一致。
            </p>
            <div className="max-h-48 overflow-auto rounded border border-[#e8e8e8] bg-white">
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <thead>
                  <tr className="bg-[#fafafa] text-[#8c8c8c]">
                    <th className="border border-[#e8e8e8] px-2 py-1.5 text-left">用户</th>
                    <th className="border border-[#e8e8e8] px-2 py-1.5 text-left">模型 Code</th>
                    <th className="border border-[#e8e8e8] px-2 py-1.5 text-left">任务类型</th>
                    <th className="border border-[#e8e8e8] px-2 py-1.5 text-right">条数</th>
                    <th className="border border-[#e8e8e8] px-2 py-1.5 text-right">消耗积分</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedSummary.slice(0, 50).map((g) => (
                    <tr key={`${g.userId}|${g.modelCode}|${g.taskKind}`}>
                      <td className="border border-[#e8e8e8] px-2 py-1.5">
                        <div className="font-medium">{g.userName || "—"}</div>
                        <div className="font-mono text-[10px] text-[#8c8c8c]">{g.userId}</div>
                      </td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 font-mono text-[11px]">
                        {g.modelCode || "—"}
                      </td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5">{g.taskKind || "—"}</td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-right tabular-nums">
                        {g.count}
                      </td>
                      <td className="border border-[#e8e8e8] px-2 py-1.5 text-right tabular-nums">
                        {g.credits}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {groupedSummary.length > 50 ? (
              <p className="mt-1 text-[11px] text-[#8c8c8c]">
                仅展示前 50 组，共 {groupedSummary.length} 组。
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-x-auto border border-[#e8e8e8]">
          <table className="min-w-[1400px] border-collapse text-xs">
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
                      {billColumnHeaderLabel(k)}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {useUserGrouping
                ? pagedUserGroups.flatMap((group) => {
                    const expanded = expandedUsers.has(group.userId);
                    return [
                      <tr
                        key={`group-${group.userId}`}
                        className="cursor-pointer bg-[#f0f7ff] hover:bg-[#e6f4ff]"
                        onClick={() => toggleUserExpanded(group.userId)}
                      >
                        <td
                          colSpan={totalColumnCount}
                          className="border border-[#e8e8e8] px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#262626]">
                            <span className="inline-flex items-center gap-1 font-medium">
                              {expanded ? (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0" />
                              )}
                              {group.userName}
                            </span>
                            <span className="font-mono text-[10px] text-[#8c8c8c]">
                              {group.userId}
                            </span>
                            <span className="text-[#595959]">
                              {group.rows.length} 条 · 积分 {group.credits}
                            </span>
                            <span className="text-[#8c8c8c]">
                              最新 {group.latestTimeLabel}
                            </span>
                          </div>
                        </td>
                      </tr>,
                      ...(expanded
                        ? group.rows.map((row, ri) => renderDetailRow(row, ri))
                        : []),
                    ];
                  })
                : paged.map((row, ri) => renderDetailRow(row, ri))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[#595959]">
          <div>
            共{" "}
            <span className="text-[#262626]">
              {useUserGrouping ? userGroups.length : filteredSorted.length}
            </span>{" "}
            {useUserGrouping ? "位用户" : "条"} · 每页
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
