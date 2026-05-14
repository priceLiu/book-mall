/** 单笔充值营销赠送的风控护栏（配置化活动上线后可改为查规则表） */
const MAX_TOPUP_BONUS_MULTIPLIER = 10;
const MAX_TOPUP_BONUS_ABSOLUTE_POINTS = 5_000_000; // 等价 ¥50,000

export function assertReasonableTopupBonus(paidAmountPoints: number, bonusPoints: number): void {
  if (bonusPoints === 0) return;
  if (!Number.isInteger(bonusPoints) || bonusPoints < 0) {
    throw new Error("赠送点须为非负整数");
  }
  if (!Number.isInteger(paidAmountPoints) || paidAmountPoints <= 0) {
    throw new Error("充值本金无效");
  }
  if (bonusPoints > MAX_TOPUP_BONUS_ABSOLUTE_POINTS) {
    throw new Error("赠送点超出单笔绝对上限，请检查活动配置");
  }
  if (bonusPoints > paidAmountPoints * MAX_TOPUP_BONUS_MULTIPLIER) {
    throw new Error("赠送点相对本金过高，请检查活动配置");
  }
}
