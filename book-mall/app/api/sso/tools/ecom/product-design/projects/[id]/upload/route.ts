import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  addProductDesignReferenceUpload,
  getProductDesignProject,
  removeProductDesignReference,
} from "@/lib/ecom/ecom-product-design-service";
import {
  assertProductDesignRefUploadAllowed,
} from "@/lib/ecom/ecom-product-design-ref-rules";
import type { ProductDesignReference } from "@/lib/ecom/ecom-product-design-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "无效表单" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "缺少 file" }, { status: 400 });
  }
  if (file.size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "文件过大（最大 30MB）" }, { status: 413 });
  }

  const label = String(form.get("label") ?? "产品图").slice(0, 40);
  const roleRaw = String(form.get("role") ?? "product");
  const role: ProductDesignReference["role"] =
    roleRaw === "product" ||
    roleRaw === "main-style" ||
    roleRaw === "detail-style" ||
    roleRaw === "scene" ||
    roleRaw === "model"
      ? roleRaw
      : "other";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getProductDesignProject(auth.userId, id);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    assertProductDesignRefUploadAllowed({
      role,
      existingCountForRole: project.references.filter((r) => r.role === role).length,
      visionModelKey: project.settings.visionModelKey,
      imageModelKey: project.settings.imageModelKey,
    });
    const buf = Buffer.from(await file.arrayBuffer());
    const reference = await addProductDesignReferenceUpload(auth.userId, id, {
      label,
      role,
      buf,
    });
    return NextResponse.json({ reference });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const refId = new URL(req.url).searchParams.get("refId")?.trim();
  if (!refId) {
    return NextResponse.json({ error: "缺少 refId" }, { status: 400 });
  }
  try {
    await removeProductDesignReference(auth.userId, id, refId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
