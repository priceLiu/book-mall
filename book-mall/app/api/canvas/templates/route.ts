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

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET：当前用户可见模板 = 内置 (builtin=true) + 私有 (ownerUserId=user) */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const rows = await prisma.canvasTemplate.findMany({
    where: {
      OR: [{ builtin: true }, { ownerUserId: guard.user.id }],
    },
    orderBy: [{ builtin: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ templates: rows }, { headers: jsonHeaders(request) });
}

/** POST：用户保存私有模板（不涉及 builtin） */
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
  try {
    const created = await prisma.canvasTemplate.create({
      data: {
        ownerUserId: guard.user.id,
        category,
        name,
        thumbnail,
        canvas: canvas as Prisma.InputJsonValue,
        builtin: false,
      },
    });
    return NextResponse.json(
      { template: created },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
