import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { listEcomWorkflowDrafts } from "@/lib/ecom/ecom-workflow-drafts-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return ecomJson({ error: "未登录" }, { status: 401 });
  }
  try {
    const drafts = await listEcomWorkflowDrafts(auth.userId);
    return ecomJson({ drafts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "暂存列表加载失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
