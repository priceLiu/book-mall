/**
 * 分析室计费：与主站 ToolBillablePrice（toolKey + action）一致。
 * 修改默认扣点时须同步迁移或后台「工具管理 → 按次单价」。
 */
export const VISUAL_LAB_ANALYSIS_TOOL_KEY = "visual-lab__analysis";
export const VISUAL_LAB_ANALYSIS_ACTION = "invoke";
/** 默认 1500 点 = ¥15；仅用于前台展示提示，实扣以主站标价为准 */
export const VISUAL_LAB_ANALYSIS_DEFAULT_PRICE_POINTS = 1500;
