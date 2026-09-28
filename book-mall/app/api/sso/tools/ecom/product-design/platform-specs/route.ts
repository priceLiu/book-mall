import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  DEFAULT_ECOM_PLATFORM_CODE,
  ECOM_PLATFORM_SPECS,
} from "@/lib/ecom/ecom-platform-spec";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 平台出图规则唯一来源，前端勿再写一份 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return ecomJson({ error: "未登录" }, { status: 401 });
  }
  return ecomJson({
    specs: ECOM_PLATFORM_SPECS,
    defaultPlatform: DEFAULT_ECOM_PLATFORM_CODE,
  });
}
