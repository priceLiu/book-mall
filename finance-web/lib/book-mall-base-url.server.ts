/** 服务端读取主站 Origin（运行时 env；供 layout 注入客户端，避免 NEXT_PUBLIC_* 仅构建期内联） */
export function getBookMallBaseUrlServer(): string {
  const raw =
    process.env.BOOK_MALL_URL?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}
