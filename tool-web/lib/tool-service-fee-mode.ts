/** Phase D：工具 AI 按次扣点已退役；单次生成不另扣钱包点数。 */
export const TOOL_SERVICE_FEE_MODE = true;

export const SERVICE_FEE_CHARGE_LINE =
  "套餐额度内不另扣积分；超额编排从轻量包扣";

export const SERVICE_FEE_CHARGE_TITLE =
  "工具使用权：按月技术服务费（通用积分池）。生成：厂商费走 Gateway BYOK；平台编排超额（文生图/视频等）按 BYOK 套餐额度，超出后扣通用积分轻量包。";

export function serviceFeeBillableHintJson() {
  return {
    serviceFeeMode: true,
    pricePoints: 0,
    chargeLine: SERVICE_FEE_CHARGE_LINE,
    chargeTitle: SERVICE_FEE_CHARGE_TITLE,
  };
}

export function serviceFeeSettleJson() {
  return {
    ok: true,
    recorded: false,
    serviceFeeMode: true,
    message: "Phase D：单次生成不扣点，已含在工具技术服务费内",
  };
}
