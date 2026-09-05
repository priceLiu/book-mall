import { type NextRequest } from "next/server";

import { createPortalLogoutResponse } from "@private/federated-portal-logout";
import { getAppPublicOrigin, getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/** 门户登出：与 book 联邦 full-signout 同一套（回跳子站首页）。 */
export async function GET(request: NextRequest) {
  return createPortalLogoutResponse(request, {
    appPublicOrigin: getAppPublicOrigin(),
    mainSiteOrigin: getMainSiteOrigin(),
  });
}
