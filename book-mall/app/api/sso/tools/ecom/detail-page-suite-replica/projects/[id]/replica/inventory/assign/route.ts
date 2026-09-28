import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { assignReplicaSegmentModule } from "@/lib/ecom/detail-page-suite-replica/replica-segment-mapping-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  const itemKey = typeof body.itemKey === "string" ? body.itemKey : "";
  const moduleId =
    body.moduleId === null
      ? null
      : typeof body.moduleId === "string"
        ? body.moduleId
        : undefined;
  if (!itemKey.trim()) {
    return ecomJson({ error: "缺少 itemKey" }, { status: 400 });
  }
  if (moduleId === undefined) {
    return ecomJson({ error: "缺少 moduleId（可为 null）" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await assignReplicaSegmentModule({
      userId: auth.userId,
      projectId: id,
      itemKey,
      moduleId,
    });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "保存归类失败" },
      { status: 500 },
    );
  }
}
