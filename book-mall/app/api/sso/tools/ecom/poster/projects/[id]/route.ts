import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  getEcomPosterProject,
  updateEcomPosterProject,
} from "@/lib/ecom/ecom-poster-service";
import { parsePosterPlan, sanitizePosterReferences } from "@/lib/ecom/ecom-poster-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomPosterProject(auth.userId, params.id);
    if (!project) return ecomJson({ error: "不存在" }, { status: 404 });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "加载失败" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await updateEcomPosterProject(auth.userId, params.id, {
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(body.brief !== undefined
        ? { brief: body.brief as Record<string, unknown> | null }
        : {}),
      ...(body.settings !== undefined
        ? { settings: body.settings as Record<string, unknown> }
        : {}),
      ...(body.references !== undefined
        ? { references: sanitizePosterReferences(body.references) }
        : {}),
      ...(body.plan !== undefined ? { plan: parsePosterPlan(body.plan) } : {}),
      ...(body.meta !== undefined ? { meta: body.meta as Record<string, unknown> } : {}),
      ...(typeof body.status === "string" ? { status: body.status } : {}),
    });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "保存失败" }, { status: 400 });
  }
}
