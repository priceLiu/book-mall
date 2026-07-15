import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveListThumbnailUrl } from "@/lib/canvas/resolve-list-thumbnail";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

function templateSelect() {
  return {
    id: true,
    name: true,
    category: true,
    thumbnail: true,
    description: true,
    visibility: true,
    featured: true,
    edition: true,
    forkCount: true,
    sourceLabel: true,
    builtin: true,
    ownerUserId: true,
    canvas: true,
    sortOrder: true,
    createdAt: true,
    updatedAt: true,
    owner: { select: { id: true, name: true, email: true } },
  } as const;
}

/** GET：scope=featured|public|my|all（默认 all = builtin + 自己的） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;

  const scope = request.nextUrl.searchParams.get("scope")?.trim() || "all";

  let where: Prisma.CanvasTemplateWhereInput;
  if (scope === "featured") {
    where = {
      OR: [{ builtin: true, featured: true }, { featured: true, visibility: "public" }],
    };
  } else if (scope === "public") {
    where = { visibility: "public", builtin: false };
  } else if (scope === "my") {
    where = { ownerUserId: guard.user.id };
  } else {
    where = {
      OR: [{ builtin: true }, { ownerUserId: guard.user.id }],
    };
  }

  const rows = await prisma.canvasTemplate.findMany({
    where,
    orderBy: [{ featured: "desc" }, { builtin: "desc" }, { sortOrder: "asc" }, { forkCount: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: templateSelect(),
  });
  const templates = rows.map((row) => ({
    ...row,
    thumbnailUrl: resolveListThumbnailUrl({
      storedUrl: row.thumbnail,
      canvas: row.canvas,
    }),
  }));
  return NextResponse.json({ templates }, { headers: jsonHeaders(request) });
}

/** POST：用户保存模板（私有或公开） */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const name = String(body.body.name ?? "").trim();
  const category = String(body.body.category ?? "user").trim() || "user";
  const canvas = body.body.canvas;
  if (!name || !canvas || typeof canvas !== "object") {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "name + canvas required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  const thumbnail = body.body.thumbnail ? String(body.body.thumbnail) : "";
  const description = String(body.body.description ?? "").trim();
  const edition = String(body.body.edition ?? "").trim();
  const sourceLabel = String(body.body.sourceLabel ?? "").trim();
  const visibility =
    body.body.visibility === "public" ? "public" : "private";

  try {
    const created = await prisma.canvasTemplate.create({
      data: {
        ownerUserId: guard.user.id,
        category,
        name,
        thumbnail,
        description,
        edition,
        sourceLabel,
        visibility,
        canvas: canvas as Prisma.InputJsonValue,
        builtin: false,
      },
      select: templateSelect(),
    });
    return NextResponse.json(
      { template: created },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
