import { type NextRequest, NextResponse } from "next/server";

import { resolvePlatformUser } from "@/lib/platform-auth";
import { cropCanvasImageToOss } from "@/lib/canvas-image-edit/crop-canvas-image";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await resolvePlatformUser(request);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sourceImageUrl =
    typeof body.sourceImageUrl === "string" ? body.sourceImageUrl.trim() : "";
  const bboxRaw = body.bbox;
  if (!sourceImageUrl) {
    return NextResponse.json({ error: "sourceImageUrl 必填" }, { status: 400 });
  }
  if (!Array.isArray(bboxRaw) || bboxRaw.length !== 4) {
    return NextResponse.json({ error: "bbox 必填（x1,y1,x2,y2）" }, { status: 400 });
  }
  const nums = bboxRaw.map((v) => Number(v));
  if (!nums.every((n) => Number.isFinite(n))) {
    return NextResponse.json({ error: "bbox 坐标无效" }, { status: 400 });
  }

  try {
    const ossUrl = await cropCanvasImageToOss({
      userId: user.id,
      sourceImageUrl,
      bbox: nums as [number, number, number, number],
    });
    return NextResponse.json({ imageUrls: [ossUrl] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "裁剪失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
