import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { deleteCanvasCharacter } from "@/lib/canvas/canvas-character-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** DELETE：删除已保存的角色（仅删库记录，不删 OSS 原图） */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  try {
    await deleteCanvasCharacter(guard.user.id, id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
