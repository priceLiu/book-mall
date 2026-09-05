import { type NextRequest } from "next/server";

import { createPortalLogoutResponse } from "@private/federated-portal-logout";
import { getMainSiteOrigin, getToolsSitePublicOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/** 工具站门户登出：与 book 联邦 full-signout 同一套。 */
export async function GET(request: NextRequest) {
  return createPortalLogoutResponse(request, {
    appPublicOrigin: getToolsSitePublicOrigin(),
    mainSiteOrigin: getMainSiteOrigin(),
  });
}
