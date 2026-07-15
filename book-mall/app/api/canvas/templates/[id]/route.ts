import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  isAdmin,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import { prisma } from "@/lib/prisma";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

type RouteCtx = { params: Promise<{ id: string }> };

function canManageTemplate(
  ownerUserId: string | null,
  user: { id: string; role?: string },
): boolean {
  return ownerUserId === user.id || isAdmin(user);
}

async function canManageTemplateAsync(
  ownerUserId: string | null,
  user: { id: string; role?: string },
): Promise<boolean> {
  if (ownerUserId === user.id) return true;
  return resolveCanvasApiAdmin(user);
}

/** PATCH：改名 / 分享开关 / 描述 */
export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const row = await prisma.canvasTemplate.findUnique({ where: { id } });
  if (!row || row.builtin) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: jsonHeaders(request) });
  }
  if (!(await canManageTemplateAsync(row.ownerUserId, guard.user))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: jsonHeaders(request) });
  }
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const data: Record<string, unknown> = {};
  if (typeof body.body.name === "string" && body.body.name.trim()) {
    data.name = body.body.name.trim();
  }
  if (typeof body.body.description === "string") {
    data.description = body.body.description.trim();
  }
  if (body.body.visibility === "public" || body.body.visibility === "private") {
    data.visibility = body.body.visibility;
  }
  try {
    const updated = await prisma.canvasTemplate.update({
      where: { id },
      data,
    });
    return NextResponse.json({ template: updated }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** DELETE：本人或平台管理员 */
export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const row = await prisma.canvasTemplate.findUnique({ where: { id } });
  if (!row || row.builtin) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: jsonHeaders(request) });
  }
  if (!(await canManageTemplateAsync(row.ownerUserId, guard.user))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: jsonHeaders(request) });
  }
  await prisma.canvasTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
}
