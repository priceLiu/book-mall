import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  corsOptionsResponse,
  isAdmin,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { CANVAS_BUILTIN_MODELS } from "@/lib/canvas/canvas-constants";
import { Prisma } from "@prisma/client";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET：列出已启用的模型；当 DB 为空时返回内置默认（不写库），便于首次使用。 */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const rows = await prisma.canvasEngineModel.findMany({
    where: { active: true },
    orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
  });
  if (rows.length > 0) {
    return NextResponse.json({ models: rows }, { headers: jsonHeaders(request) });
  }
  // fallback：内置三条
  return NextResponse.json(
    {
      models: CANVAS_BUILTIN_MODELS.map((m, i) => ({
        id: `builtin-${m.modelKey}`,
        modelKey: m.modelKey,
        displayName: m.displayName,
        vendor: m.vendor,
        role: m.role,
        description: m.description,
        sortOrder: m.sortOrder,
        active: true,
        defaultParams: m.defaultParams,
        builtin: true,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      })),
      builtinFallback: true,
    },
    { headers: jsonHeaders(request) },
  );
}

/** POST: admin 新增模型 */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.user)) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const b = body.body;
  const modelKey = String(b.modelKey ?? "").trim();
  const displayName = String(b.displayName ?? "").trim();
  const vendor = String(b.vendor ?? "").trim();
  const roleStr = String(b.role ?? "IMAGE").toUpperCase();
  const role =
    roleStr === "VIDEO" ? "VIDEO" : roleStr === "LLM" ? "LLM" : "IMAGE";
  if (!modelKey || !displayName || !vendor) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "modelKey/displayName/vendor required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  const description = b.description ? String(b.description) : null;
  const sortOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999;
  const active = b.active === false ? false : true;
  const defaultParams =
    b.defaultParams && typeof b.defaultParams === "object"
      ? (b.defaultParams as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  try {
    const created = await prisma.canvasEngineModel.create({
      data: {
        modelKey,
        displayName,
        vendor,
        role,
        description,
        sortOrder,
        active,
        defaultParams,
      },
    });
    return NextResponse.json(
      { model: created },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint/i.test(msg)) {
      return NextResponse.json(
        { error: "DUPLICATE_MODEL_KEY" },
        { status: 409, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: msg },
      { status: 500, headers: jsonHeaders(request) },
    );
  }
}

/** PATCH: admin 更新模型 */
export async function PATCH(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.user)) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const id = String(body.body.id ?? "").trim();
  if (!id) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "id required" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  const data: Prisma.CanvasEngineModelUpdateInput = {};
  if (typeof body.body.displayName === "string") data.displayName = body.body.displayName;
  if (typeof body.body.vendor === "string") data.vendor = body.body.vendor;
  if (typeof body.body.description === "string") data.description = body.body.description;
  if (typeof body.body.sortOrder === "number") data.sortOrder = body.body.sortOrder;
  if (typeof body.body.active === "boolean") data.active = body.body.active;
  if (body.body.defaultParams && typeof body.body.defaultParams === "object") {
    data.defaultParams = body.body.defaultParams as Prisma.InputJsonValue;
  }

  const updated = await prisma.canvasEngineModel.update({
    where: { id },
    data,
  });
  return NextResponse.json(
    { model: updated },
    { headers: jsonHeaders(request) },
  );
}
