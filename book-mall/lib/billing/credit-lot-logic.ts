/**
 * 积分批次（CreditLot）纯逻辑：排序 / 分配 / 回补 / 到期计划。
 * 与 DB 无关，便于单测；credit-account-service.ts 的事务代码调用这里的决策函数。
 */
import type { CreditSource } from "@prisma/client";

/** 充值积分默认有效期（政策：12 个月）。 */
export const TOPUP_VALIDITY_MONTHS = 12;
/** 活动 / 注册赠送免费积分默认有效期（政策：30 天）。 */
export const FREE_VALIDITY_DAYS = 30;

export function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
export function monthPeriodKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 扣费顺序里的来源兜底排序：即将到期优先，同到期则订阅 < 免费 < 充值。 */
export const LOT_SOURCE_RANK: Record<CreditSource, number> = {
  SUBSCRIPTION: 0,
  FREE: 1,
  TOPUP: 2,
};

export type LotRow = {
  id: string;
  source: CreditSource;
  remainingCredits: number;
  expiresAt: Date | null;
  grantedAt: Date;
};

/** 消费排序：expiresAt 升序（null 最后）→ 来源 rank → grantedAt 升序。 */
export function sortLotsForSpend(a: LotRow, b: LotRow): number {
  const ax = a.expiresAt ? a.expiresAt.getTime() : Number.POSITIVE_INFINITY;
  const bx = b.expiresAt ? b.expiresAt.getTime() : Number.POSITIVE_INFINITY;
  if (ax !== bx) return ax - bx;
  const ar = LOT_SOURCE_RANK[a.source];
  const br = LOT_SOURCE_RANK[b.source];
  if (ar !== br) return ar - br;
  return a.grantedAt.getTime() - b.grantedAt.getTime();
}

/**
 * 已拥有额度变化：ownedDelta = credits + reservedDelta。
 * >0 增额（建批次/回补）；<0 减额（FIFO 扣批次）；==0 冻结/释放（批次不动）。
 */
export function computeOwnedDelta(credits: number, reservedDelta: number): number {
  return credits + reservedDelta;
}

export type AllocationStep = { id: string; take: number; newRemaining: number };

/** FIFO 分配计划：按 sortLotsForSpend 顺序扣减 amount。返回每批次扣减步骤与不足额。 */
export function planAllocation(
  lots: LotRow[],
  amount: number,
): { steps: AllocationStep[]; shortfall: number } {
  const steps: AllocationStep[] = [];
  if (amount <= 0) return { steps, shortfall: Math.max(0, -amount) };
  const sorted = [...lots].sort(sortLotsForSpend);
  let left = amount;
  for (const lot of sorted) {
    if (left <= 0) break;
    if (lot.remainingCredits <= 0) continue;
    const take = Math.min(lot.remainingCredits, left);
    steps.push({ id: lot.id, take, newRemaining: lot.remainingCredits - take });
    left -= take;
  }
  return { steps, shortfall: left };
}

/** 回补目标：最早到期的活跃批次 id；无则 null（调用方需新建永久批次）。 */
export function planRestoreTargetId(lots: LotRow[]): string | null {
  if (lots.length === 0) return null;
  const sorted = [...lots].sort(sortLotsForSpend);
  return sorted[0]!.id;
}

/**
 * 到期计划：把已到期批次归零，但整池扣减额不超过可用余额（应对到期批次中含冻结额的极端情形）。
 * 返回 toExpire（写 EXPIRE 的金额）与逐批次归零步骤。
 */
export function planExpiry(
  dueLots: Array<{ id: string; remainingCredits: number }>,
  availableBalance: number,
): { toExpire: number; steps: AllocationStep[] } {
  const sum = dueLots.reduce((s, l) => s + Math.max(0, l.remainingCredits), 0);
  const toExpire = Math.max(0, Math.min(sum, availableBalance));
  const steps: AllocationStep[] = [];
  let left = toExpire;
  for (const lot of dueLots) {
    if (left <= 0) break;
    if (lot.remainingCredits <= 0) continue;
    const take = Math.min(lot.remainingCredits, left);
    steps.push({ id: lot.id, take, newRemaining: lot.remainingCredits - take });
    left -= take;
  }
  return { toExpire, steps };
}

/** 按来源解析批次默认到期（undefined=按来源默认；null=永久）。 */
export function resolveLotExpiry(
  source: CreditSource,
  explicit: Date | null | undefined,
  now: Date,
): Date | null {
  if (explicit !== undefined) return explicit;
  if (source === "FREE") return addDays(now, FREE_VALIDITY_DAYS);
  if (source === "TOPUP") return addMonths(now, TOPUP_VALIDITY_MONTHS);
  return null; // SUBSCRIPTION 无显式到期时按永久（实际由调用方传 currentPeriodEnd）
}
