import Link from "next/link";
import type { CreditPool, CreditSource } from "@prisma/client";

type Lot = {
  pool: CreditPool;
  source: CreditSource;
  remainingCredits: number;
  expiresAt: Date | null;
};

const SOURCE_LABEL: Record<CreditSource, string> = {
  SUBSCRIPTION: "订阅赠送",
  TOPUP: "充值加量",
  FREE: "活动/注册赠送",
};

const POOL_LABEL: Record<CreditPool, string> = {
  GENERAL: "通用积分",
  VIDEO: "视频积分",
};

function fmtDate(d: Date | null): string {
  if (!d) return "永久有效";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")} 到期`;
}

/** 账户中心：按「池 + 来源 + 最近到期」展示有效积分批次（透明化清零规则）。 */
export function CreditLotBreakdown({ lots }: { lots: Lot[] }) {
  if (!lots || lots.length === 0) return null;

  // 聚合到 (pool, source)：合计剩余、取最近到期。
  const map = new Map<string, { pool: CreditPool; source: CreditSource; remaining: number; nearest: Date | null }>();
  for (const lot of lots) {
    const key = `${lot.pool}:${lot.source}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        pool: lot.pool,
        source: lot.source,
        remaining: lot.remainingCredits,
        nearest: lot.expiresAt,
      });
    } else {
      prev.remaining += lot.remainingCredits;
      if (lot.expiresAt && (!prev.nearest || lot.expiresAt < prev.nearest)) {
        prev.nearest = lot.expiresAt;
      }
    }
  }
  const rows = Array.from(map.values()).sort((a, b) => {
    if (a.pool !== b.pool) return a.pool === "GENERAL" ? -1 : 1;
    const ax = a.nearest ? a.nearest.getTime() : Number.POSITIVE_INFINITY;
    const bx = b.nearest ? b.nearest.getTime() : Number.POSITIVE_INFINITY;
    return ax - bx;
  });

  return (
    <section className="mt-8 rounded-2xl border border-secondary bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">积分构成与到期</h3>
        <Link
          href="/pricing-disclosure#credit-expiry"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          清零规则
        </Link>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        扣费时优先使用最先到期的积分。会员服务月付 31 天、年付 365 天；订阅积分每 31 天清零刷新、充值 12 个月、活动/注册赠送 30 天。
      </p>
      <ul className="divide-y divide-secondary">
        {rows.map((r) => (
          <li key={`${r.pool}:${r.source}`} className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">
              {POOL_LABEL[r.pool]} · {SOURCE_LABEL[r.source]}
            </span>
            <span className="flex items-center gap-3">
              <span className="font-medium tabular-nums">{r.remaining.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">{fmtDate(r.nearest)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
