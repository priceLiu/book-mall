import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  readTemplateGalleryCatalogLive,
  upsertTemplateGalleryEntry,
  type EcomTemplateGalleryEntry,
} from "@/lib/ecom/ecom-template-gallery-service";

export const dynamic = "force-dynamic";

function parseEntry(body: Record<string, unknown>): EcomTemplateGalleryEntry | null {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const mediaKind = body.mediaKind === "video" ? "video" : "image";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const ossUrl = typeof body.ossUrl === "string" ? body.ossUrl.trim() : "";
  const thumbUrl = typeof body.thumbUrl === "string" ? body.thumbUrl.trim() : ossUrl;
  if (!id || !category || !title || !ossUrl) return null;
  const refs = Array.isArray(body.referenceImages)
    ? body.referenceImages
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const o = item as Record<string, unknown>;
          const url = typeof o.url === "string" ? o.url.trim() : "";
          if (!url) return null;
          return {
            url,
            label: typeof o.label === "string" ? o.label : undefined,
          };
        })
        .filter((x): x is { url: string; label?: string } => x !== null)
    : undefined;
  return {
    id,
    category,
    mediaKind,
    title,
    hot: body.hot === true,
    ossUrl,
    thumbUrl,
    coverUrl: typeof body.coverUrl === "string" ? body.coverUrl : null,
    mainImageUrl: typeof body.mainImageUrl === "string" ? body.mainImageUrl : null,
    referenceImages: refs,
    promptText: typeof body.promptText === "string" ? body.promptText : null,
    negativePrompt: typeof body.negativePrompt === "string" ? body.negativePrompt : null,
    defaultModelKey: typeof body.defaultModelKey === "string" ? body.defaultModelKey : null,
    defaultParams:
      body.defaultParams && typeof body.defaultParams === "object"
        ? (body.defaultParams as Record<string, unknown>)
        : null,
    posterUrl: typeof body.posterUrl === "string" ? body.posterUrl : null,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
  };
}

export async function GET() {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const catalog = await readTemplateGalleryCatalogLive();
    return NextResponse.json(catalog);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message, templates: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const entry = parseEntry(body);
  if (!entry) {
    return NextResponse.json({ error: "id/category/title/ossUrl 必填" }, { status: 400 });
  }
  const saved = await upsertTemplateGalleryEntry(entry);
  return NextResponse.json({ entry: saved }, { status: 201 });
}
