import { type NextRequest, NextResponse } from "next/server";

import {
  createCanvasProjectHistoryForUser,
  getCanvasProjectHistoryForUser,
  getCanvasProjectHistoryMetaForUser,
  listCanvasProjectHistoryForUser,
  type CanvasHistorySource,
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
  const entryId = request.nextUrl.searchParams.get("entryId")?.trim();
  try {
    if (entryId) {
      const item = await getCanvasProjectHistoryForUser(
        guard.user.id,
        id,
        entryId,
      );
      return NextResponse.json({ item }, { headers: jsonHeaders(request) });
    }
    const sourceRaw = request.nextUrl.searchParams.get("source")?.trim();
    const source: CanvasHistorySource | undefined =
      sourceRaw === "manual" || sourceRaw === "autosave" ? sourceRaw : undefined;
    const [items, meta] = await Promise.all([
      listCanvasProjectHistoryForUser(guard.user.id, id, { source }),
      getCanvasProjectHistoryMetaForUser(guard.user.id, id),
    ]);
    return NextResponse.json({ items, meta }, { headers: jsonHeaders(request) });
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
