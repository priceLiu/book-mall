/** Phase D：工具 AI 按次扣点已退役；单次生成不另扣钱包点数。 */
export const TOOL_SERVICE_FEE_MODE = true;

export const SERVICE_FEE_CHARGE_LINE =
  "已含在工具技术服务费内，单次生成不另扣点";

export const SERVICE_FEE_CHARGE_TITLE =
  "工具使用权按月「技术服务费」从钱包扣点；云厂商调用费用走 Gateway BYOK，Book 不对每次生成扣点。";

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
