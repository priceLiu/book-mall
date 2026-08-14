import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { uploadEcomTemplateGalleryPreview } from "@/lib/canvas/canvas-oss";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseDataUrl(dataUrl: string): { buf: Buffer; contentType: string; ext: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("dataUrl 格式无效");
  const contentType = m[1] ?? "application/octet-stream";
  const buf = Buffer.from(m[2] ?? "", "base64");
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("mp4")
        ? "mp4"
        : contentType.includes("webm")
          ? "webm"
          : "jpg";
  return { buf, contentType, ext };
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

  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const id = typeof body.id === "string" ? body.id.trim() : `tmp-${Date.now()}`;
  if (!dataUrl || !category) {
    return NextResponse.json({ error: "dataUrl / category 必填" }, { status: 400 });
  }

  try {
    const parsed = parseDataUrl(dataUrl);
    const url = await uploadEcomTemplateGalleryPreview({
      category,
      id,
      buf: parsed.buf,
      contentType: parsed.contentType,
      ext: parsed.ext,
    });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 500 },
    );
  }
}
