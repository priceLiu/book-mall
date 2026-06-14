/** 与 docs/dev.md 端口表一致；仅 development 且未配置 env 时使用。 */
export const DEV_BOOK_MALL_DEFAULT = "http://localhost:3000";

/** 服务端读取主站 Origin（运行时 env；供 layout 注入客户端，避免 NEXT_PUBLIC_* 仅构建期内联） */
export function getBookMallBaseUrlServer(): string {
  const raw =
    process.env.BOOK_MALL_URL?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    (process.env.NODE_ENV === "development" ? DEV_BOOK_MALL_DEFAULT : "");
  return raw.replace(/\/$/, "");
}
