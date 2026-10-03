import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { linkIpMasterToBrandViProject } from "@/lib/ecom/ecom-ip-master-link";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id: brandViProjectId } = await ctx.params;

  let body: { ipMasterProjectId?: unknown; version?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }

  const ipMasterProjectId =
    typeof body.ipMasterProjectId === "string" ? body.ipMasterProjectId.trim() : "";
  if (!ipMasterProjectId) {
    return ecomJson({ error: "缺少 ipMasterProjectId" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await linkIpMasterToBrandViProject({
      userId: auth.userId,
      brandViProjectId,
      ipMasterProjectId,
      version: typeof body.version === "string" ? body.version : undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "载入失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
