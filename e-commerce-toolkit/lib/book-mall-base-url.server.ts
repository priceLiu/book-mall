import { getMainSiteOrigin } from "@/lib/site-origin";

export function getBookMallBaseUrlServer(): string {
  return getMainSiteOrigin() ?? "http://localhost:3000";
}
