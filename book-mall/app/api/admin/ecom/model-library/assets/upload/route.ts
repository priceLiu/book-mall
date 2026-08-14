import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { uploadEcomModelLibraryPreview } from "@/lib/canvas/canvas-oss";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseDataUrl(dataUrl: string): { buf: Buffer; contentType: string; ext: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("dataUrl 格式无效");
  const contentType = m[1] ?? "image/jpeg";
  const buf = Buffer.from(m[2] ?? "", "base64");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
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
  const id = typeof body.id === "string" ? body.id.trim() : `model-${Date.now()}`;
  if (!dataUrl) {
    return NextResponse.json({ error: "dataUrl 必填" }, { status: 400 });
  }

  try {
    const parsed = parseDataUrl(dataUrl);
    const url = await uploadEcomModelLibraryPreview({
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
