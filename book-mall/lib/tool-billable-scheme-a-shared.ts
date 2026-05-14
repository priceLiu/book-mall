/**
 * 客户端与安全边界均可用的类型与纯函数（无 Node fs/path）。
 * 价目加载逻辑见 `tool-billable-scheme-a-admin-cost.ts`。
 */

export type SchemeAModelOption = {
  catalogModelId: string;
  label: string;
  /** 价目库有匹配行时可算；否则 null（仍可手填成本） */
  defaultCostYuan: number | null;
};

export function schemeABillableOptionsKey(
  toolKey: string,
  action: string | null | undefined,
): string {
  return `${toolKey.trim()}\0${(action ?? "").trim()}`;
}
