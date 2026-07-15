import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { prisma } from "@/lib/prisma";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

type RouteCtx = { params: Promise<{ id: string }> };

/** POST：复制公开/内置模板到自己的私有副本（forkCount++） */
export async function POST(request: NextRequest, ctx: RouteCtx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const source = await prisma.canvasTemplate.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: jsonHeaders(request) });
  }
  const canFork =
    source.builtin ||
    source.visibility === "public" ||
    source.ownerUserId === guard.user.id;
  if (!canFork) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: jsonHeaders(request) });
  }

  const [forked] = await prisma.$transaction([
    prisma.canvasTemplate.create({
      data: {
        ownerUserId: guard.user.id,
        category: source.category,
        name: `${source.name}（副本）`,
        thumbnail: source.thumbnail,
        description: source.description,
        edition: source.edition,
        sourceLabel: source.sourceLabel || source.name,
        visibility: "private",
        canvas: source.canvas,
        builtin: false,
      },
    }),
    ...(source.builtin || source.visibility === "public"
      ? [
          prisma.canvasTemplate.update({
            where: { id: source.id },
            data: { forkCount: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(
    { template: forked, sourceId: source.id },
    { status: 201, headers: jsonHeaders(request) },
  );
}
