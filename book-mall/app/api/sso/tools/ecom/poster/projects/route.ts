import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  createEcomPosterProject,
  listEcomPosterProjects,
} from "@/lib/ecom/ecom-poster-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const items = await listEcomPosterProjects(auth.userId);
    return ecomJson({ items });
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
    /* */
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const title = typeof body.title === "string" ? body.title : undefined;
    const project = await createEcomPosterProject(auth.userId, { title });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "创建失败" }, { status: 500 });
  }
}
