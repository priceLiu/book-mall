export function getBookMallBaseUrlServer(): string {
  const raw =
    process.env.BOOK_MALL_URL?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    "";
  return raw.replace(/\/$/, "");
}
