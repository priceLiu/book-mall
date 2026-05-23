import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  deleteUserPromptTemplate,
  updateUserPromptTemplate,
} from "@/lib/canvas/canvas-prompt-template-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  try {
    const template = await updateUserPromptTemplate(
      guard.user.id,
      params.id,
      {
        name:
          body.body.name !== undefined ? String(body.body.name) : undefined,
        content:
          body.body.content !== undefined
            ? String(body.body.content)
            : undefined,
        sortOrder:
          typeof body.body.sortOrder === "number"
            ? body.body.sortOrder
            : undefined,
      },
    );
    return NextResponse.json({ template }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    await deleteUserPromptTemplate(guard.user.id, params.id);
    return NextResponse.json({ ok: true }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
