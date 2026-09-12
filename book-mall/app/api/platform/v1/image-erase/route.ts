import { type NextRequest, NextResponse } from "next/server";

import { resolvePlatformUser } from "@/lib/platform-auth";
import { runCanvasImageErase } from "@/lib/canvas-image-edit/run-canvas-image-erase";

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
  const maskDataUrl =
    typeof body.maskDataUrl === "string" ? body.maskDataUrl.trim() : "";
  const clientPage =
    typeof body.clientPage === "string" ? body.clientPage.trim() : undefined;

  if (!sourceImageUrl) {
    return NextResponse.json({ error: "sourceImageUrl 必填" }, { status: 400 });
  }
  if (!maskDataUrl) {
    return NextResponse.json({ error: "maskDataUrl 必填" }, { status: 400 });
  }

  try {
    const result = await runCanvasImageErase({
      userId: user.id,
      sourceImageUrl,
      maskDataUrl,
      clientPage,
    });
    return NextResponse.json({
      imageUrls: result.imageUrls,
      logId: result.logId,
      creditsCharged: result.creditsCharged ?? undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "擦除失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
