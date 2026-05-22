import { type NextRequest, NextResponse } from "next/server";
import {
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
  storyErrorToResponse,
} from "@/lib/story/api-helpers";
import {
  createProjectForUser,
  listProjectsForUser,
} from "@/lib/story/story-project-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const projects = await listProjectsForUser(guard.user.id);
    return NextResponse.json({ projects }, { headers: jsonHeaders(request) });
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  try {
    const project = await createProjectForUser(guard.user.id, {
      name: String(body.body.name ?? ""),
      description: String(body.body.description ?? ""),
      aspectRatio: String(body.body.aspectRatio ?? ""),
      styleId: Number(body.body.styleId ?? NaN),
    });
    return NextResponse.json(
      { project },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return storyErrorToResponse(request, err);
  }
}
