/** CreditLedger 类型中文标签（finance-web 展示用）。 */
export const LEDGER_TYPE_LABEL: Record<string, string> = {
  GRANT: "发放",
  CONSUME: "消耗",
  REFUND: "返还",
  EXPIRE: "过期清零",
  TOPUP: "充值",
  ADJUST: "人工校正",
  RESERVE: "冻结",
  SETTLE: "结算",
  RELEASE: "解冻",
};

export function formatLedgerCredits(credits: number): string {
  if (credits > 0) return `+${credits}`;
  return String(credits);
}

/** 流水摘要：类型 + 积分 + 说明/时间（不再使用已废弃的 pool 字段）。 */
export function formatLedgerSummary(input: {
  type: string;
  credits: number;
  description?: string | null;
  createdAt?: string | null;
}): string {
  const label = LEDGER_TYPE_LABEL[input.type] ?? input.type;
  const detail =
    input.description?.trim() ||
    (input.createdAt
      ? new Date(input.createdAt).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—");
  return `${label} ${formatLedgerCredits(input.credits)} · ${detail}`;
}
