import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import type { DetailPageSuiteModuleDef } from "@/lib/ecom/detail-page-suite/types";
import { copyTemplate } from "@/lib/ecom/detail-page-suite/template-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.sourceId !== "string") {
    return ecomJson({ error: "sourceId 必填" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const item = await copyTemplate({
      sourceId: body.sourceId,
      userId: auth.userId,
      asUser: true,
      templateName: typeof body.templateName === "string" ? body.templateName : undefined,
      modules: Array.isArray(body.modules) ? (body.modules as DetailPageSuiteModuleDef[]) : undefined,
    });
    return ecomJson({ item });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "复制失败" },
      { status: 400 },
    );
  }
}
