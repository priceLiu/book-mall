import { getMainSiteOrigin } from "@/lib/site-origin";

/** 服务端写入 BookMallBaseUrlProvider；与 getMainSiteOrigin 同源，供客户端拼 SSO 链接。 */
export function getBookMallBaseUrlServer(): string {
  return getMainSiteOrigin()?.replace(/\/$/, "") ?? "";
}
