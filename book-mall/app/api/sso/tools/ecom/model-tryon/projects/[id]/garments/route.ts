import { NextResponse } from "next/server";

import {
  patchEcomModelTryonGarments,
  uploadEcomModelTryonGarment,
} from "@/lib/ecom/ecom-model-tryon-service";
import type { VtonGarmentItem } from "@/lib/ecom/ecom-vton/types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file" }, { status: 400 });
  }
  if (kind !== "top" && kind !== "bottom" && kind !== "one_piece") {
    return NextResponse.json({ error: "无效 kind" }, { status: 400 });
  }

  try {
    const project = await uploadEcomModelTryonGarment(auth.userId, id, kind, file);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传服装失败";
    const status = message === "项目不存在" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: {
    add?: Array<Omit<VtonGarmentItem, "id"> & { id?: string }>;
    removeIds?: string[];
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  try {
    const project = await patchEcomModelTryonGarments(auth.userId, id, body);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新服装池失败";
    const status = message === "项目不存在" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
