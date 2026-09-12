import { type NextRequest, NextResponse } from "next/server";

import { resolvePlatformUser } from "@/lib/platform-auth";
import {
  runCanvasImageOutpaint,
  type CanvasOutpaintOffsets,
} from "@/lib/canvas-image-edit/run-canvas-image-outpaint";

export const dynamic = "force-dynamic";

function parseOffsets(raw: unknown): CanvasOutpaintOffsets | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const nums = {
    left_offset: Number(o.left_offset ?? 0),
    right_offset: Number(o.right_offset ?? 0),
    top_offset: Number(o.top_offset ?? 0),
    bottom_offset: Number(o.bottom_offset ?? 0),
  };
  if (!Object.values(nums).every((n) => Number.isFinite(n) && n >= 0)) {
    return null;
  }
  return nums;
}

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
  const clientPage =
    typeof body.clientPage === "string" ? body.clientPage.trim() : undefined;
  const offsets = parseOffsets(body.offsets);

  if (!sourceImageUrl) {
    return NextResponse.json({ error: "sourceImageUrl 必填" }, { status: 400 });
  }
  if (!offsets) {
    return NextResponse.json({ error: "offsets 必填" }, { status: 400 });
  }

  try {
    const result = await runCanvasImageOutpaint({
      userId: user.id,
      sourceImageUrl,
      offsets,
      clientPage,
    });
    return NextResponse.json({
      imageUrls: result.imageUrls,
      logId: result.logId,
      creditsCharged: result.creditsCharged ?? undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "扩图失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
