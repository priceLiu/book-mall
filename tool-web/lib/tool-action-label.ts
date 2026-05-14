/** 与主站 `ToolBillablePrice.action` 对应的简体中文说明（价格表展示用）。 */
export function toolActionToLabelZh(action: string): string {
  const a = action.trim();
  switch (a) {
    case "invoke":
      return "单次调用";
    case "try_on":
      return "试衣成片";
    case "page_view":
      return "页面浏览";
    default:
      return a.length > 0 ? a : "—";
  }
}
