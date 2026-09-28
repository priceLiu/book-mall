import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  createEcomModelShotProject,
  listEcomModelShotProjects,
  listEcomModelShotProjectSummaries,
} from "@/lib/ecom/ecom-model-shot-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const url = new URL(req.url);
    if (url.searchParams.get("summary") === "1") {
      return ecomJson({ items: await listEcomModelShotProjectSummaries(auth.userId) });
    }
    return ecomJson({ items: await listEcomModelShotProjects(auth.userId) });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "加载失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await createEcomModelShotProject(auth.userId, {
      title: typeof body.title === "string" ? body.title : undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "创建失败" }, { status: 500 });
  }
}
