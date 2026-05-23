import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import type { CanvasPromptEngineKind } from "@/lib/canvas/canvas-prompt-templates";
import {
  createUserPromptTemplate,
  listPromptTemplatesForUser,
} from "@/lib/canvas/canvas-prompt-template-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET：内置 + 当前用户自定义提示词模板 */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const engine = request.nextUrl.searchParams.get("engine");
  const engineFilter =
    engine === "LLM" || engine === "IMAGE"
      ? (engine as CanvasPromptEngineKind)
      : undefined;
  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "1";
  try {
    const templates = await listPromptTemplatesForUser(
      guard.user.id,
      engineFilter,
      { includeArchived },
    );
    return NextResponse.json({ templates }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** POST：新增用户自定义模板（LLM+IMAGE 活跃合计最多 8 条） */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const engine = body.body.engine;
  if (engine !== "LLM" && engine !== "IMAGE") {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "engine must be LLM or IMAGE" },
      { status: 400, headers: jsonHeaders(request) },
    );
  }
  try {
    const template = await createUserPromptTemplate(guard.user.id, {
      engine,
      name: String(body.body.name ?? ""),
      content: String(body.body.content ?? ""),
    });
    return NextResponse.json(
      { template },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
