import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  createCanvasProjectForUser,
  listCanvasProjectsForUser,
} from "@/lib/canvas/canvas-project-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projects = await listCanvasProjectsForUser(guard.user.id);
    return NextResponse.json({ projects }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const project = await createCanvasProjectForUser(guard.user.id, {
      name: String(body.body.name ?? ""),
      description: body.body.description ? String(body.body.description) : "",
      canvas: body.body.canvas,
    });
    return NextResponse.json(
      { project },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
