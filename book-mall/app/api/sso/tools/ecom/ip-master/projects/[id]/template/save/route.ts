import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { saveIpMasterTemplateVersion } from "@/lib/ecom/ecom-ip-master-service";
import type { IpMasterTemplateSource } from "@/lib/ecom/ecom-ip-master-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { markdown?: unknown; source?: unknown; json?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }

  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  if (!markdown.trim()) {
    return ecomJson({ error: "模板内容不能为空" }, { status: 400 });
  }

  const source =
    body.source === "image" || body.source === "text" || body.source === "mixed"
      ? (body.source as IpMasterTemplateSource)
      : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await saveIpMasterTemplateVersion(auth.userId, id, {
      markdown,
      source,
      json:
        body.json && typeof body.json === "object"
          ? (body.json as Record<string, unknown>)
          : undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
