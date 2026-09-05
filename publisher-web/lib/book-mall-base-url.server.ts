export function getBookMallBaseUrlServer(): string {
  const raw =
    process.env.MAIN_SITE_ORIGIN?.trim() ||
    process.env.BOOK_MALL_URL?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
