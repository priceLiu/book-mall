import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { countPromptTemplateUsage } from "@/lib/canvas/canvas-prompt-template-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET：该模板仍被多少画布节点引用 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const nodeCount = await countPromptTemplateUsage(
      guard.user.id,
      params.id,
    );
    return NextResponse.json(
      { nodeCount },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
