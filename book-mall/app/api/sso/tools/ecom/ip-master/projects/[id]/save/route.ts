import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { persistIpMasterWorkflowSnapshot } from "@/lib/ecom/ecom-ip-master-snapshot";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  const ipName =
    (typeof body.ipName === "string" ? body.ipName.trim() : "") ||
    (typeof body.projectName === "string" ? body.projectName.trim() : "");
  if (!ipName) {
    return ecomJson({ error: "请填写 IP 名" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const snapshot = await persistIpMasterWorkflowSnapshot({
      userId: auth.userId,
      projectId,
      ipName,
    });
    return ecomJson({ snapshot });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    const status =
      message === "项目不存在" ? 404 : message.includes("请先") ? 400 : 500;
    return ecomJson({ error: message }, { status });
  }
}
