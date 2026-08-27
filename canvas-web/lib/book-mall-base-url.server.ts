const DEV_BOOK_MALL_ORIGIN = "http://localhost:3000";

export function getBookMallBaseUrlServer(): string {
  const raw =
    process.env.BOOK_MALL_URL?.trim() ||
    process.env.NEXT_PUBLIC_BOOK_MALL_URL?.trim() ||
    process.env.MAIN_SITE_ORIGIN?.trim() ||
    "";
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") {
    return DEV_BOOK_MALL_ORIGIN;
  }
  return "";
}
