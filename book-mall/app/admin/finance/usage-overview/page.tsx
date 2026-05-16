import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";
import { UsageOverviewExportButton, type ExportLine } from "./usage-overview-export-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "费用多维度概览 — 管理后台",
};

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function qp(sp: Props["searchParams"], key: string): string {
  const v = sp?.[key];
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "";
}

function monthLabel(yyyymm: string): string {
  if (!/^\d{6}$/.test(yyyymm)) return yyyymm;
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4)}`;
}

function ymKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const y = x.getUTCFullYear();
  const m = x.getUTCMonth() + 1;
  return `${y}${String(m).padStart(2, "0")}`;
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === "object" && "toString" in (v as object)) {
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export default async function AdminFinanceUsageOverviewPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const sinceMonth = (qp(searchParams, "since") || "").trim();
  const onlyTool = (qp(searchParams, "tool") || "").trim();
  const onlyUserId = (qp(searchParams, "userId") || "").trim();

  const now = new Date();
  const defaultSince = new Date(now.getUTCFullYear(), now.getUTCMonth() - 5, 1);
  const sinceCutoff = sinceMonth && /^\d{6}$/.test(sinceMonth)
    ? new Date(Date.UTC(parseInt(sinceMonth.slice(0, 4), 10), parseInt(sinceMonth.slice(4), 10) - 1, 1))
    : defaultSince;

  const where = {
    source: "TOOL_USAGE_GENERATED" as const,
    createdAt: { gte: sinceCutoff },
    ...(onlyUserId ? { userId: onlyUserId } : {}),
    ...(onlyTool
      ? {
          cloudRow: {
            path: ["产品信息/计费项Code"],
            string_contains: onlyTool,
          },
        }
      : {}),
  };

  const lines = await prisma.toolBillingDetailLine.findMany({
    where,
    select: {
      id: true,
      userId: true,
      createdAt: true,
      internalChargedPoints: true,
      internalYuanReference: true,
      internalRetailMultiplier: true,
      internalCloudCostUnitYuan: true,
      cloudRow: true,
      pricingTemplateKey: true,
    },
    take: 5000,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(lines.map((l) => l.userId))) } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  function toolKeyOf(l: { cloudRow: unknown }): string {
    const cr = (l.cloudRow ?? {}) as Record<string, unknown>;
    const v = cr["产品信息/计费项Code"] ?? cr["toolKey"] ?? cr["tool_key"];
    return typeof v === "string" && v.length > 0 ? v : "(unknown)";
  }
  function modelKeyOf(l: { cloudRow: unknown }): string {
    const cr = (l.cloudRow ?? {}) as Record<string, unknown>;
    const v =
      cr["产品信息/规格"] ?? cr["modelId"] ?? cr["apiModel"] ?? cr["videoModel"] ?? cr["tryOnModel"];
    return typeof v === "string" && v.length > 0 ? v : "(unknown)";
  }

  type Agg = { yuan: number; count: number };
  const byMonth = new Map<string, Agg>();
  const byTool = new Map<string, Agg>();
  const byModel = new Map<string, Agg>();
  const byUser = new Map<string, Agg>();
  let totalYuan = 0;
  let totalCount = 0;

  for (const l of lines) {
    const yuan = l.internalYuanReference != null
      ? asNumber(l.internalYuanReference)
      : (l.internalChargedPoints ?? 0) / 100;
    totalYuan += yuan;
    totalCount += 1;
    const m = ymKey(l.createdAt);
    const t = toolKeyOf(l);
    const md = modelKeyOf(l);
    const u = l.userId;
    bump(byMonth, m, yuan);
    bump(byTool, t, yuan);
    bump(byModel, md, yuan);
    bump(byUser, u, yuan);
  }
  function bump(m: Map<string, Agg>, k: string, yuan: number) {
    const ex = m.get(k) ?? { yuan: 0, count: 0 };
    ex.yuan += yuan;
    ex.count += 1;
    m.set(k, ex);
  }

  function sortDesc<K>(m: Map<K, Agg>): Array<{ k: K; yuan: number; count: number }> {
    return Array.from(m.entries())
      .map(([k, v]) => ({ k, ...v }))
      .sort((a, b) => b.yuan - a.yuan || b.count - a.count);
  }

  const financeWebOrigin = getFinanceWebPublicOrigin();

  /** 生成导出用的扁平行（包含 user 名 + 邮箱），让客户端直接转 CSV。 */
  const exportRows: ExportLine[] = lines.map((l) => {
    const u = userMap.get(l.userId);
    const yuan =
      l.internalYuanReference != null
        ? asNumber(l.internalYuanReference)
        : (l.internalChargedPoints ?? 0) / 100;
    return {
      createdAt: l.createdAt.toISOString().replace("T", " ").slice(0, 19),
      userId: l.userId,
      userName: u?.name ?? "",
      userEmail: u?.email ?? "",
      toolKey: toolKeyOf(l),
      modelKey: modelKeyOf(l),
      pricingTemplateKey: l.pricingTemplateKey ?? null,
      internalCloudCostUnitYuan:
        l.internalCloudCostUnitYuan != null
          ? asNumber(l.internalCloudCostUnitYuan).toFixed(4)
          : null,
      internalRetailMultiplier:
        l.internalRetailMultiplier != null ? String(l.internalRetailMultiplier) : null,
      internalChargedPoints: l.internalChargedPoints ?? null,
      yuan: Number(yuan.toFixed(2)),
    };
  });
  const exportRangeLabel = (() => {
    const parts: string[] = [];
    if (sinceMonth) parts.push(`since-${sinceMonth}`);
    if (onlyTool) parts.push(`tool-${onlyTool.replace(/[^\w-]/g, "_")}`);
    if (onlyUserId) parts.push(`user-${onlyUserId.slice(0, 6)}`);
    return parts.length > 0 ? parts.join("_") : "all";
  })();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            费用多维度概览
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            来源：<code className="text-foreground">ToolBillingDetailLine</code>（仅 <code className="text-foreground">TOOL_USAGE_GENERATED</code>，
            即工具站实际调用产生的内部计价行）。所有金额均为
            <strong className="font-medium text-foreground">我方零售价</strong>（cost × 系数）。
          </p>
        </div>
        <UsageOverviewExportButton rows={exportRows} rangeLabel={exportRangeLabel} />
      </header>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <form className="flex flex-wrap items-end gap-3" action="/admin/finance/usage-overview">
          <label className="flex flex-col gap-1 text-sm">
            <span>起始月份 (YYYYMM)</span>
            <input
              name="since"
              defaultValue={sinceMonth}
              placeholder="202512 (默认近 6 个月)"
              className="w-36 rounded border border-[#d1d5db] px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>仅指定工具</span>
            <input
              name="tool"
              defaultValue={onlyTool}
              placeholder="如 fitting-room__ai-fit"
              className="w-56 rounded border border-[#d1d5db] px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>仅指定用户 ID</span>
            <input
              name="userId"
              defaultValue={onlyUserId}
              placeholder="cmp..."
              className="w-48 rounded border border-[#d1d5db] px-2 py-1 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-[#d1d5db] bg-white px-3 py-1.5 text-sm hover:bg-[#fafafa]"
          >
            查询
          </button>
          <span className="text-xs text-muted-foreground">
            共 {totalCount} 条记账 / 合计 ¥{totalYuan.toFixed(2)}（上限 5000 条窗口）
          </span>
        </form>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <AggCard title="按月份" rows={sortDesc(byMonth).slice(0, 12)} fmtKey={(k) => monthLabel(String(k))} />
        <AggCard title="按工具" rows={sortDesc(byTool).slice(0, 20)} fmtKey={(k) => `${toolKeyToLabel(String(k))} · ${k}`} />
        <AggCard title="按模型" rows={sortDesc(byModel).slice(0, 20)} fmtKey={(k) => String(k)} />
        <AggCard
          title="按用户（点击进入费用明细）"
          rows={sortDesc(byUser).slice(0, 20)}
          fmtKey={(k) => {
            const u = userMap.get(String(k));
            return u ? `${u.name ?? "(no name)"} · ${u.email ?? ""}` : String(k);
          }}
          rowHref={(k) =>
            financeWebOrigin
              ? `${financeWebOrigin}/admin/billing/users/${encodeURIComponent(String(k))}`
              : undefined
          }
        />
      </div>

      <section className="rounded border border-[#e8e8e8] bg-white p-4">
        <h2 className="mb-2 text-sm font-medium">最新 50 条记账（带价格依据快照）</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#fafafa]">
              <tr>
                <th className="border-b px-2 py-2 text-left font-medium">时间</th>
                <th className="border-b px-2 py-2 text-left font-medium">用户</th>
                <th className="border-b px-2 py-2 text-left font-medium">工具</th>
                <th className="border-b px-2 py-2 text-left font-medium">模型</th>
                <th className="border-b px-2 py-2 text-left font-medium">模板</th>
                <th className="border-b px-2 py-2 text-right font-medium">cost (¥)</th>
                <th className="border-b px-2 py-2 text-right font-medium">M</th>
                <th className="border-b px-2 py-2 text-right font-medium">扣点</th>
                <th className="border-b px-2 py-2 text-right font-medium">≈ ¥</th>
              </tr>
            </thead>
            <tbody>
              {lines
                .slice()
                .sort((a, b) => +b.createdAt - +a.createdAt)
                .slice(0, 50)
                .map((l) => {
                  const u = userMap.get(l.userId);
                  const yuan = l.internalYuanReference != null
                    ? asNumber(l.internalYuanReference)
                    : (l.internalChargedPoints ?? 0) / 100;
                  return (
                    <tr key={l.id} className="bg-white hover:bg-[#fafafa]">
                      <td className="border-b px-2 py-1.5 text-muted-foreground">
                        {l.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="border-b px-2 py-1.5">
                        {u ? (u.name ?? u.email ?? l.userId) : (
                          <code className="text-xs">{l.userId}</code>
                        )}
                      </td>
                      <td className="border-b px-2 py-1.5">
                        <code>{toolKeyOf(l)}</code>
                      </td>
                      <td className="border-b px-2 py-1.5">
                        <code>{modelKeyOf(l)}</code>
                      </td>
                      <td className="border-b px-2 py-1.5">
                        <code className="text-[11px] text-muted-foreground">
                          {l.pricingTemplateKey ?? "—"}
                        </code>
                      </td>
                      <td className="border-b px-2 py-1.5 text-right">
                        {l.internalCloudCostUnitYuan != null
                          ? asNumber(l.internalCloudCostUnitYuan).toFixed(4)
                          : "—"}
                      </td>
                      <td className="border-b px-2 py-1.5 text-right">
                        {l.internalRetailMultiplier != null
                          ? String(l.internalRetailMultiplier)
                          : "—"}
                      </td>
                      <td className="border-b px-2 py-1.5 text-right">
                        {l.internalChargedPoints ?? "—"}
                      </td>
                      <td className="border-b px-2 py-1.5 text-right">¥{yuan.toFixed(2)}</td>
                    </tr>
                  );
                })}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">
                    所选范围内没有记账。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="text-xs text-muted-foreground">
        相关入口：{" "}
        <Link href="/admin/finance/pricing-templates" className="text-blue-600 hover:underline">
          计费模板与公式
        </Link>{" "}
        ·{" "}
        <Link href="/admin/finance/cloud-pricing" className="text-blue-600 hover:underline">
          云厂商价目表
        </Link>{" "}
        ·{" "}
        <Link href="/admin/finance/reconciliation" className="text-blue-600 hover:underline">
          云账单对账
        </Link>
      </section>
    </div>
  );
}

function AggCard<K>({
  title,
  rows,
  fmtKey,
  rowHref,
}: {
  title: string;
  rows: Array<{ k: K; yuan: number; count: number }>;
  fmtKey: (k: K) => string;
  rowHref?: (k: K) => string | undefined;
}) {
  const total = rows.reduce((s, r) => s + r.yuan, 0);
  return (
    <section className="rounded border border-[#e8e8e8] bg-white">
      <header className="border-b bg-[#fafafa] px-3 py-2 text-sm font-medium">
        {title}{" "}
        <span className="ml-1 text-xs text-muted-foreground">
          合计 ¥{total.toFixed(2)} · {rows.length} 项
        </span>
      </header>
      <ul className="divide-y text-sm">
        {rows.map(({ k, yuan, count }) => {
          const label = fmtKey(k);
          const href = rowHref?.(k);
          const inner = (
            <div className="flex items-baseline gap-3 px-3 py-1.5">
              <span className="flex-1 truncate" title={label}>{label}</span>
              <span className="text-xs text-muted-foreground">{count} 次</span>
              <span className="w-20 text-right font-medium">¥{yuan.toFixed(2)}</span>
            </div>
          );
          if (href) {
            return (
              <li key={String(k)}>
                <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-[#fafafa]">
                  {inner}
                </a>
              </li>
            );
          }
          return <li key={String(k)}>{inner}</li>;
        })}
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-center text-muted-foreground">无数据</li>
        ) : null}
      </ul>
    </section>
  );
}
