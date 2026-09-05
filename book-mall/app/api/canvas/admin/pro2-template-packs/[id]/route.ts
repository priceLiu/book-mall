import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import {
  softDeletePro2TemplatePack,
  updatePro2TemplatePack,
} from "@/lib/canvas/pro2-prompt-template-service";
import { prisma } from "@/lib/prisma";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

type RouteContext = { params: Promise<{ id: string }> };

async function findPackByRouteId(id: string) {
  const byId = await prisma.pro2TemplatePack.findFirst({
    where: { id, deletedAt: null },
    include: {
      outlineTemplate: true,
      characterTemplate: true,
      sceneTemplate: true,
      storyboardTemplate: true,
    },
  });
  if (byId) return byId;
  return null;
}

/** GET · 管理员 · Pro2 模板包详情 */
export async function GET(request: NextRequest, context: RouteContext) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!(await resolveCanvasApiAdmin(guard.user))) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  const { id } = await context.params;
  try {
    const row = await findPackByRouteId(id);
    if (!row) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    const { listPro2TemplatePacks } = await import(
      "@/lib/canvas/pro2-prompt-template-service"
    );
    const packs = await listPro2TemplatePacks();
    const pack = packs.find((p) => p.id === id);
    return NextResponse.json({ pack }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** PATCH · 管理员 · 更新 Pro2 模板包 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!(await resolveCanvasApiAdmin(guard.user))) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  const { id } = await context.params;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pack = await updatePro2TemplatePack(id, {
      ...(body.name != null ? { name: String(body.name) } : {}),
      ...(body.enabled != null ? { enabled: Boolean(body.enabled) } : {}),
      ...(body.categoryDocTitle !== undefined
        ? {
            categoryDocTitle:
              body.categoryDocTitle != null ? String(body.categoryDocTitle) : null,
          }
        : {}),
      ...(body.categoryDocBody !== undefined
        ? {
            categoryDocBody:
              body.categoryDocBody != null ? String(body.categoryDocBody) : null,
          }
        : {}),
      ...(body.outlineTemplateId != null
        ? { outlineTemplateId: String(body.outlineTemplateId) }
        : {}),
      ...(body.characterTemplateId != null
        ? { characterTemplateId: String(body.characterTemplateId) }
        : {}),
      ...(body.sceneTemplateId != null
        ? { sceneTemplateId: String(body.sceneTemplateId) }
        : {}),
      ...(body.storyboardTemplateId != null
        ? { storyboardTemplateId: String(body.storyboardTemplateId) }
        : {}),
      ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
    });
    if (!pack) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json({ pack }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** DELETE · 管理员 · 软删 Pro2 模板包 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!(await resolveCanvasApiAdmin(guard.user))) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  const { id } = await context.params;
  try {
    const ok = await softDeletePro2TemplatePack(id);
    if (!ok) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
