import { NextResponse } from "next/server";

import {
  importTemplateGalleryItem,
  type TemplateGalleryUploadInput,
} from "@/lib/ecom/ecom-template-gallery-service";
import { getToolsSsoEligibility } from "@/lib/tools-sso-access";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
/** 大图双拉取 + OSS；避免 BFF 300s 超时导致前端误报失败 */
export const maxDuration = 600;

/** 单条模板导入（admin only · idempotent） */
export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  const elig = await getToolsSsoEligibility(auth.userId);
  if (!elig.isAdmin) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  let body: Partial<TemplateGalleryUploadInput>;
  try {
    body = (await req.json()) as Partial<TemplateGalleryUploadInput>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const category = body.category?.trim();
  const id = body.id?.trim();
  const sourceUrl = body.sourceUrl?.trim();
  const title = body.title?.trim() || "模板案例";
  const ext = body.ext?.trim() || "jpg";
  const mediaKind = body.mediaKind === "video" ? "video" : "image";

  if (!category || !id || !sourceUrl) {
    return NextResponse.json(
      { error: "缺少 category / id / sourceUrl" },
      { status: 400 },
    );
  }

  const result = await importTemplateGalleryItem({
    category,
    id,
    sourceUrl,
    title,
    hot: Boolean(body.hot),
    ext,
    mediaKind,
    posterUrl: body.posterUrl ?? null,
    thumbSourceUrl: body.thumbSourceUrl ?? null,
  });

  if (result.status === "failed") {
    return NextResponse.json(
      { status: "failed", error: result.error },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
