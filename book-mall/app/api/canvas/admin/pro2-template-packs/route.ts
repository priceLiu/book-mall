import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import {
  createPro2TemplatePack,
  listPro2TemplatePacks,
} from "@/lib/canvas/pro2-prompt-template-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 管理员 · Pro2 剧本模板包列表 */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!(await resolveCanvasApiAdmin(guard.user))) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  try {
    const packs = await listPro2TemplatePacks();
    return NextResponse.json({ packs }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** POST · 管理员 · 新建 Pro2 剧本模板包 */
export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!(await resolveCanvasApiAdmin(guard.user))) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const packKey = String(body.packKey ?? "").trim();
    const name = String(body.name ?? "").trim();
    const outlineTemplateId = String(body.outlineTemplateId ?? "").trim();
    const characterTemplateId = String(body.characterTemplateId ?? "").trim();
    const sceneTemplateId = String(body.sceneTemplateId ?? "").trim();
    const storyboardTemplateId = String(body.storyboardTemplateId ?? "").trim();
    if (
      !packKey ||
      !name ||
      !outlineTemplateId ||
      !characterTemplateId ||
      !sceneTemplateId ||
      !storyboardTemplateId
    ) {
      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400, headers: jsonHeaders(request) },
      );
    }
    const pack = await createPro2TemplatePack({
      packKey,
      name,
      enabled: body.enabled !== false,
      categoryDocTitle:
        body.categoryDocTitle != null ? String(body.categoryDocTitle) : null,
      categoryDocBody:
        body.categoryDocBody != null ? String(body.categoryDocBody) : null,
      outlineTemplateId,
      characterTemplateId,
      sceneTemplateId,
      storyboardTemplateId,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    });
    return NextResponse.json({ pack }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
