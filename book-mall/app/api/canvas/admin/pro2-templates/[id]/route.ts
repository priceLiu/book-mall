import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import {
  getPro2PromptTemplateById,
  softDeletePro2PromptTemplate,
  updatePro2PromptTemplate,
} from "@/lib/canvas/pro2-prompt-template-service";
import type { Pro2PromptBlock } from "@/lib/canvas/pro2-prompt-template-types";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

type RouteContext = { params: Promise<{ id: string }> };

/** GET · 管理员 · Pro2 提示词模板详情 */
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
    const template = await getPro2PromptTemplateById(id);
    if (!template) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json({ template }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** PATCH · 管理员 · 更新 Pro2 提示词模板 */
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
    const template = await updatePro2PromptTemplate(id, {
      ...(body.name != null ? { name: String(body.name) } : {}),
      ...(body.description !== undefined
        ? { description: body.description != null ? String(body.description) : null }
        : {}),
      ...(body.version != null ? { version: String(body.version) } : {}),
      ...(body.enabled != null ? { enabled: Boolean(body.enabled) } : {}),
      ...(body.blocks != null ? { blocks: body.blocks as Pro2PromptBlock[] } : {}),
      ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
    });
    if (!template) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404, headers: jsonHeaders(request) },
      );
    }
    return NextResponse.json({ template }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** DELETE · 管理员 · 软删 Pro2 提示词模板 */
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
    const ok = await softDeletePro2PromptTemplate(id);
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
