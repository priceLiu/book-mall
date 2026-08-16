import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  deleteTemplateGalleryEntry,
  getTemplateGalleryEntry,
  parseRefImages,
  upsertTemplateGalleryEntry,
} from "@/lib/ecom/ecom-template-gallery-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const entry = await getTemplateGalleryEntry(id);
  if (!entry) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const existing = await getTemplateGalleryEntry(id);
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 传了数组就以其为准（空数组即清空）；没传才保留原值
  const refs = Array.isArray(body.referenceImages)
    ? parseRefImages(body.referenceImages)
    : existing.referenceImages;

  const saved = await upsertTemplateGalleryEntry({
    ...existing,
    category: typeof body.category === "string" ? body.category : existing.category,
    mediaKind: body.mediaKind === "video" || body.mediaKind === "image" ? body.mediaKind : existing.mediaKind,
    title: typeof body.title === "string" ? body.title : existing.title,
    hot: typeof body.hot === "boolean" ? body.hot : existing.hot,
    ossUrl: typeof body.ossUrl === "string" ? body.ossUrl : existing.ossUrl,
    thumbUrl: typeof body.thumbUrl === "string" ? body.thumbUrl : existing.thumbUrl,
    coverUrl: typeof body.coverUrl === "string" ? body.coverUrl.trim() || null : existing.coverUrl,
    mainImageUrl:
      typeof body.mainImageUrl === "string" ? body.mainImageUrl.trim() || null : existing.mainImageUrl,
    referenceImages: refs,
    promptText: typeof body.promptText === "string" ? body.promptText.trim() || null : existing.promptText,
    negativePrompt:
      typeof body.negativePrompt === "string" ? body.negativePrompt.trim() || null : existing.negativePrompt,
    defaultModelKey:
      typeof body.defaultModelKey === "string" ? body.defaultModelKey.trim() || null : existing.defaultModelKey,
    defaultParams:
      body.defaultParams && typeof body.defaultParams === "object"
        ? (body.defaultParams as Record<string, unknown>)
        : existing.defaultParams,
    posterUrl: typeof body.posterUrl === "string" ? body.posterUrl : existing.posterUrl,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : existing.sortOrder,
  });
  return NextResponse.json({ entry: saved });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const deleteOss = url.searchParams.get("deleteOss") !== "0";
  const ok = await deleteTemplateGalleryEntry(id, { deleteOss });
  if (!ok) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
