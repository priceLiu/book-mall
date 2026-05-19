/** 与个人中心进入费用区约定：URL 携带后，管理员也按「普通用户费用」顶栏与导航上下文处理。 */
export const FEES_FROM_ACCOUNT_QUERY = "from";
export const FEES_FROM_ACCOUNT_VALUE = "account";

export function feesFromAccountQuerySuffix(): string {
  return `?${FEES_FROM_ACCOUNT_QUERY}=${FEES_FROM_ACCOUNT_VALUE}`;
}
