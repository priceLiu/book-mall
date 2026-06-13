import { type NextRequest, NextResponse } from "next/server";

import {
  createCanvasProjectHistoryForUser,
  listCanvasProjectHistoryForUser,
} from "@/lib/canvas/canvas-project-history-service";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";

type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  try {
    const items = await listCanvasProjectHistoryForUser(guard.user.id, id);
    return NextResponse.json({ items }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { id } = await ctx.params;
  try {
    const source =
      body.body.source === "manual" ? ("manual" as const) : ("autosave" as const);
    const item = await createCanvasProjectHistoryForUser(guard.user.id, id, {
      canvas: body.body.canvas,
      thumbnailUrl:
        typeof body.body.thumbnailUrl === "string"
          ? body.body.thumbnailUrl
          : undefined,
      source,
      label: typeof body.body.label === "string" ? body.body.label : undefined,
    });
    return NextResponse.json({ item }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
