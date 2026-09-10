import { NextResponse } from "next/server";

import {
  attachEcomVtonTextTryonRef,
  removeEcomVtonTextTryonRef,
  uploadEcomVtonTextTryonRef,
} from "@/lib/ecom/ecom-vton-text-tryon";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传图片" }, { status: 400 });
    }
    try {
      const project = await uploadEcomVtonTextTryonRef(auth.userId, id, file);
      return NextResponse.json({ project });
    } catch (e) {
      const message = e instanceof Error ? e.message : "上传失败";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }
  const ossUrl = typeof body.ossUrl === "string" ? body.ossUrl.trim() : "";
  if (!ossUrl) {
    return NextResponse.json({ error: "缺少 ossUrl" }, { status: 400 });
  }
  try {
    const project = await attachEcomVtonTextTryonRef(
      auth.userId,
      id,
      ossUrl,
      typeof body.label === "string" ? body.label : undefined,
    );
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "绑定失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  const url = new URL(req.url);
  const refId = url.searchParams.get("refId")?.trim() ?? "";
  if (!refId) {
    return NextResponse.json({ error: "缺少 refId" }, { status: 400 });
  }

  try {
    const project = await removeEcomVtonTextTryonRef(auth.userId, id, refId);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
