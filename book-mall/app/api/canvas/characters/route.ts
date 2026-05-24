import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  createCanvasCharacter,
  listCanvasCharacters,
} from "@/lib/canvas/canvas-character-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET：当前用户保存的三视图角色 */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const characters = await listCanvasCharacters(guard.user.id);
    return NextResponse.json({ characters }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** POST：保存三视图为角色 */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const name = String(body.body.name ?? "").trim();
  const imageUrl = String(body.body.imageUrl ?? "").trim();
  const model = body.body.model != null ? String(body.body.model) : null;
  const sourceTaskId =
    body.body.sourceTaskId != null ? String(body.body.sourceTaskId) : null;
  const sourceProjectId =
    body.body.sourceProjectId != null ? String(body.body.sourceProjectId) : null;
  try {
    const character = await createCanvasCharacter(guard.user.id, {
      name,
      imageUrl,
      model,
      sourceTaskId,
      sourceProjectId,
    });
    return NextResponse.json(
      { character },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
