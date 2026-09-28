import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  createEcomFilmPullProject,
  listEcomFilmPullProjects,
} from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const items = await listEcomFilmPullProjects(auth.userId);
    return ecomJson({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return ecomJson({ error: message }, { status: 500 });
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
    const title = typeof body.title === "string" ? body.title : undefined;
    const sourceApp = body.sourceApp === "canvas" ? "canvas" : "ecom";
    const canvasProjectId =
      typeof body.canvasProjectId === "string" ? body.canvasProjectId : undefined;
    const project = await createEcomFilmPullProject(auth.userId, {
      title,
      sourceApp,
      canvasProjectId,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
