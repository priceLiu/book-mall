/** VIP 大额预充 · 报价页合规公示文案（见 docs/大额vip.md） */

import { VIP_CREDIT_VALIDITY_YEARS } from "@/lib/finance/vip-package-calculator";

export { VIP_CREDIT_VALIDITY_YEARS };

export const VIP_PACKAGE_TITLE = "VIP大额预充套餐";

export const VIP_PACKAGE_INTRO =
  "一次性充值解锁双池独立积分（通用池+视频池），席位数量、成员人均消耗上限支持自主配置；" +
  `积分有效期${VIP_CREDIT_VALIDITY_YEARS}年，有效期内无月度清零。` +
  "开通后激活团队共享积分池，适配长期高频图文、AI视频生产的企业客户。";

export const VIP_FUND_RISK_NOTE =
  "本预充值仅用于兑换平台AI模型调用服务，非理财、投资产品，无任何资金增值、返利收益。";

export const VIP_CREDIT_NO_CASH_NOTE =
  "积分仅为平台AI服务消耗额度，不具备现金价值，无法折现、赎回、提现。";

export const VIP_CONSUMPTION_ORDER_NOTE =
  "团队积分消耗顺序：成员个人分配额度 → 团队公共共享积分池；通用积分、视频积分分区独立消耗，不可跨池互换。";

export const VIP_SEAT_POLICY_NOTE =
  "开通后主账号可在团队中心调整席位人均积分消耗上限；席位仅支持增购，不支持单独退订席位；删除席位仅可通过清空账号回收未分配积分。";

export const VIP_MEMBER_POLICY_NOTE =
  "团队成员仅可使用分配给自己的积分额度，无积分划转、对外分享、转售积分权限，违规转分平台有权冻结对应账号未消耗积分。";

export const VIP_CONTRACT_NOTE =
  "本VIP大额套餐为商务定制服务，需线下签订正式服务合同、统一开具增值税服务发票；" +
  "页面积分测算数据仅为展示参考，最终充值配比、服务规则以双方盖章合同及公司财务确认为准。";

export const VIP_BENEFITS = [
  `一次性预充值，双池积分${VIP_CREDIT_VALIDITY_YEARS}年有效期，周期内无月度清零`,
  "套餐开通后席位支持增购，管理员自主分配成员积分额度",
  "主账号管理员可设置团队成员人均积分消耗上限",
  "普通团队成员无积分划转、对外分享、转售积分权限",
  "配套功能：共享素材资源库、团队用量报表、成员消耗台账",
] as const;

export const VIP_COMPLIANCE_FOOTER_TITLE = "积分与预充值合规须知";

export const VIP_COMPLIANCE_FOOTER_ITEMS = [
  "平台通用、视频积分仅用于抵扣AI文本、图文、视频模型调用消耗，为虚拟服务权益，不具备现金价值，无法提现、折现、转让、交易；",
  `大额预充积分自充值到账起有效期${VIP_CREDIT_VALIDITY_YEARS}年，有效期内无月度清零；超出有效期未消耗积分自动失效，不予退款、补偿；`,
  "退款规则：订单付款7自然日内，积分无任何消耗可申请全额退款；产生任意积分消耗后，剩余额度不支持折算退费；超出冷静期，企业自身原因申请退款不予受理；仅平台服务故障导致无法使用，可按剩余积分补偿；",
  "本预充值服务仅兑换平台AI技术服务，不属于理财、投资、金融产品，无资金增值、返利相关权益；",
  "企业不得倒卖、转售套餐积分，违规使用平台有权限制账号服务、冻结未消耗积分；",
  "平台调整积分相关规则将提前90日公示，调整前已充值积分按原合同约定执行。",
] as const;

export function formatComputePowerRefYuan(faceValueYuan: number): string {
  return `算力市场价参考：约${faceValueYuan.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}元（仅行业算力价格参考，积分无现金面值，不可兑现）`;
}
