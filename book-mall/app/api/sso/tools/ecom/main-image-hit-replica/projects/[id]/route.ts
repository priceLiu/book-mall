import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import {
  deleteMainImageHitReplicaProject,
  getMainImageHitReplicaProject,
  updateMainImageHitReplicaProject,
} from "@/lib/ecom/main-image-hit-replica/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getMainImageHitReplicaProject(auth.userId, id);
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
  const project = await updateMainImageHitReplicaProject(auth.userId, id, {
    ...(typeof body.title === "string" ? { title: body.title } : {}),
    ...(body.settings && typeof body.settings === "object"
      ? {
          settings: body.settings as Parameters<
            typeof updateMainImageHitReplicaProject
          >[2]["settings"],
        }
      : {}),
    ...(body.meta && typeof body.meta === "object"
      ? { meta: body.meta as Parameters<typeof updateMainImageHitReplicaProject>[2]["meta"] }
      : {}),
    ...(body.output && typeof body.output === "object"
      ? { output: body.output as Parameters<typeof updateMainImageHitReplicaProject>[2]["output"] }
      : {}),
    ...(Array.isArray(body.references)
      ? {
          references: body.references as Parameters<
            typeof updateMainImageHitReplicaProject
          >[2]["references"],
        }
      : {}),
  });
  if (!project) return ecomJson({ error: "未找到项目" }, { status: 404 });
  return ecomJson({ project });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteMainImageHitReplicaProject(auth.userId, id);
  if (!ok) return ecomJson({ error: "未找到项目" }, { status: 404 });
  return ecomJson({ ok: true });
}