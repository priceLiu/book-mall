import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { importCanvasPortraitAsset } from "@/lib/canvas/canvas-portrait-import-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 私域虚拟人像 · 图片 URL 入库（CreateAsset + 轮询 Active） */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const body = (await request.json()) as {
      imageUrl?: string;
      name?: string;
      projectId?: string;
      edition?: "sbv1" | "pro2";
      pollUntilActive?: boolean;
    };
    const result = await importCanvasPortraitAsset({
      userId: guard.user.id,
      kind: "virtual",
      imageUrl: String(body.imageUrl ?? ""),
      name: body.name,
      projectId: body.projectId,
      edition: body.edition,
      pollUntilActive: body.pollUntilActive !== false,
    });
    return NextResponse.json(result, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
