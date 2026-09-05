import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { assertAccessibleCanvasProject } from "@/lib/canvas/canvas-project-access";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 轻量版本号：仅 updatedAt，供乐观锁对齐（避免全量拉 canvas JSON） */
export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    await assertAccessibleCanvasProject(guard.user.id, id);
    const row = await prisma.canvasProject.findFirst({
      where: { id, deletedAt: null },
      select: { updatedAt: true },
    });
    if (!row) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "project not found" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json(
      { updatedAt: row.updatedAt.toISOString() },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
