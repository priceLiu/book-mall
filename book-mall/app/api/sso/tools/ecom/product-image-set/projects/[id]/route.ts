import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import {
  getProductImageSetProject,
  updateProductImageSetProject,
} from "@/lib/ecom/product-image-set/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getProductImageSetProject(auth.userId, id);
  if (!project) return ecomJson({ error: "未找到项目" }, { status: 404 });
  return ecomJson({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  const project = await updateProductImageSetProject(auth.userId, id, {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(body.settings && typeof body.settings === "object"
      ? { settings: body.settings as Parameters<typeof updateProductImageSetProject>[2]["settings"] }
      : {}),
    ...(body.meta && typeof body.meta === "object"
      ? { meta: body.meta as Parameters<typeof updateProductImageSetProject>[2]["meta"] }
      : {}),
    ...(body.output && typeof body.output === "object"
      ? { output: body.output as Parameters<typeof updateProductImageSetProject>[2]["output"] }
      : {}),
  });
  if (!project) return ecomJson({ error: "未找到项目" }, { status: 404 });
  return ecomJson({ project });
}
