import { NextResponse } from "next/server";

import {
  appendEcomOutfitVideoModelGalleryAssets,
  appendEcomOutfitVideoModelGalleryUploads,
  removeEcomOutfitVideoModelGalleryItem,
} from "@/lib/ecom/ecom-outfit-video-service";
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
    const files = form
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File);
    if (files.length < 1) {
      return NextResponse.json({ error: "请上传至少 1 张图片" }, { status: 400 });
    }
    try {
      const project = await appendEcomOutfitVideoModelGalleryUploads(auth.userId, id, files);
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

  const assetsRaw = body.assets;
  if (Array.isArray(assetsRaw)) {
    const assets = assetsRaw
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const o = row as Record<string, unknown>;
        const ossUrl = typeof o.ossUrl === "string" ? o.ossUrl.trim() : "";
        if (!ossUrl) return null;
        return {
          ossUrl,
          title: typeof o.title === "string" ? o.title : undefined,
        };
      })
      .filter(Boolean) as Array<{ ossUrl: string; title?: string }>;
    try {
      const project = await appendEcomOutfitVideoModelGalleryAssets(auth.userId, id, assets);
      return NextResponse.json({ project });
    } catch (e) {
      const message = e instanceof Error ? e.message : "导入失败";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "请上传图片或传入 assets" }, { status: 400 });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const refId = typeof body.refId === "string" ? body.refId.trim() : "";
  if (!refId) {
    return NextResponse.json({ error: "缺少 refId" }, { status: 400 });
  }

  try {
    const project = await removeEcomOutfitVideoModelGalleryItem(auth.userId, id, refId);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
