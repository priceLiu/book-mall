import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KIND = new Set([
  "ALL",
  "COVER_IMAGE",
  "CHARACTER_AVATAR",
  "FRAME_IMAGE",
  "FRAME_VIDEO",
]);
const ALLOWED_STATUS = new Set([
  "ALL",
  "PENDING",
  "SUBMITTED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") ?? "ALL").toUpperCase();
  const status = (url.searchParams.get("status") ?? "ALL").toUpperCase();
  const limitRaw = Number(url.searchParams.get("limit") ?? 100);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);

  const where: Prisma.StoryGenerationTaskWhereInput = {};
  if (ALLOWED_KIND.has(kind) && kind !== "ALL") {
    where.kind = kind as Prisma.EnumStoryGenerationKindFilter["equals"];
  }
  if (ALLOWED_STATUS.has(status) && status !== "ALL") {
    where.status = status as Prisma.EnumStoryGenerationStatusFilter["equals"];
  }

  const [tasks, totalsByStatus] = await Promise.all([
    prisma.storyGenerationTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        projectId: true,
        characterId: true,
        frameId: true,
        kind: true,
        status: true,
        model: true,
        kieTaskId: true,
        inputPayload: true,
        resultPayload: true,
        ephemeralUrl: true,
        ossUrl: true,
        failCode: true,
        failMessage: true,
        submittedAt: true,
        completedAt: true,
        lastPolledAt: true,
        pollCount: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.storyGenerationTask.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    total: tasks.length,
    counts: Object.fromEntries(
      totalsByStatus.map((row) => [row.status, row._count._all]),
    ),
    tasks,
  });
}
