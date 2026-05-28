/** Phase D：按月技术服务费模式（整站未上线，默认全开）。 */
export const TOOL_SERVICE_FEE_MODE = true;

/** 单次开通/续订周期（天） */
export const TOOL_SERVICE_FEE_PERIOD_DAYS = 30;

/** AI 类 toolKey 前缀：这些 key 的 usage reserve/settle 不再扣钱包 */
const SERVICE_FEE_TOOL_KEY_PREFIXES = [
  "fitting-room",
  "text-to-image",
  "image-to-video",
  "visual-lab",
  "smart-support",
] as const;

export function isServiceFeeMeteredToolKey(toolKey: string): boolean {
  if (!TOOL_SERVICE_FEE_MODE) return false;
  const t = toolKey.trim();
  return SERVICE_FEE_TOOL_KEY_PREFIXES.some(
    (p) => t === p || t.startsWith(`${p}__`),
  );
}
