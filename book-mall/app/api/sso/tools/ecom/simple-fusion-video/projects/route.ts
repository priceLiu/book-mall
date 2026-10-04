import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  createSimpleFusionProject,
  listSimpleFusionProjects,
} from "@/lib/ecom/simple-fusion-video/service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const url = new URL(req.url);
  const module = url.searchParams.get("module")?.trim() ?? "";
  if (!module) return ecomJson({ error: "缺少 module" }, { status: 400 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const items = await listSimpleFusionProjects(auth.userId, module);
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
    /* */
  }
  const module = typeof body.module === "string" ? body.module.trim() : "";
  if (!module) return ecomJson({ error: "缺少 module" }, { status: 400 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const title = typeof body.title === "string" ? body.title : undefined;
    const project = await createSimpleFusionProject(auth.userId, module, { title });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
