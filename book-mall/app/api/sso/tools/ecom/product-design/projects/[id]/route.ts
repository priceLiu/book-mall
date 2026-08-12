import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteProductDesignProject,
  getProductDesignProject,
  updateProductDesignProject,
  type ProductDesignPatch,
} from "@/lib/ecom/ecom-product-design-service";
import { productDesignSchema } from "@/lib/ecom/ecom-product-design-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const project = await getProductDesignProject(auth.userId, id);
  if (!project) {
    return NextResponse.json({ error: "未找到" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const patch: ProductDesignPatch = {};
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.platform === "string") patch.platform = body.platform;
    if (typeof body.status === "string") patch.status = body.status;
    if (body.brief && typeof body.brief === "object") {
      patch.brief = body.brief as Record<string, unknown>;
    }
    if (body.settings && typeof body.settings === "object") {
      patch.settings = body.settings as ProductDesignPatch["settings"];
    }
    if (Array.isArray(body.references)) patch.references = body.references as never;
    if (Array.isArray(body.chatHistory)) patch.chatHistory = body.chatHistory as never;
    if (body.design !== undefined) {
      if (body.design === null) {
        patch.design = null;
      } else {
        const parsed = productDesignSchema.safeParse(body.design);
        if (!parsed.success) {
          return NextResponse.json({ error: "设计稿格式不正确" }, { status: 400 });
        }
        patch.design = parsed.data;
      }
    }
    if (body.designPatch && typeof body.designPatch === "object") {
      const parsed = productDesignSchema.partial().safeParse(body.designPatch);
      if (!parsed.success) {
        return NextResponse.json({ error: "设计稿补丁格式不正确" }, { status: 400 });
      }
      patch.designPatch = parsed.data;
    }
    if (body.meta && typeof body.meta === "object") {
      patch.meta = body.meta as Record<string, unknown>;
    }

    const project = await updateProductDesignProject(auth.userId, id, patch);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    await deleteProductDesignProject(auth.userId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
