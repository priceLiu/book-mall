import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
  resolveCanvasApiAdmin,
} from "@/lib/canvas/api-helpers";
import {
  createPro2PromptTemplate,
  listPro2PromptTemplates,
} from "@/lib/canvas/pro2-prompt-template-service";
import type { Pro2PromptBlock } from "@/lib/canvas/pro2-prompt-template-types";
import type {
  Pro2PromptTemplatePassKind,
  Pro2PromptTemplateRegistry,
} from "@prisma/client";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 管理员 · Pro2 提示词模板列表 */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  if (!(await resolveCanvasApiAdmin(guard.user))) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: jsonHeaders(request) },
    );
  }
  const registryRaw = request.nextUrl.searchParams.get("registry")?.trim().toUpperCase();
  const passKindRaw = request.nextUrl.searchParams.get("passKind")?.trim().toUpperCase();
  const enabledRaw = request.nextUrl.searchParams.get("enabled");
  const registry =
    registryRaw === "SCRIPT" || registryRaw === "ASSET"
      ? (registryRaw as Pro2PromptTemplateRegistry)
      : undefined;
  const passKinds: Pro2PromptTemplatePassKind[] = [
    "OUTLINE",
    "CHARACTER",
    "SCENE",
    "STORYBOARD",
    "CHARACTER_FOUR_VIEW",
    "SCENE_FOUR_PANORAMA",
    "PROP_SIX_VIEW",
  ];
  const passKind = passKinds.includes(passKindRaw as Pro2PromptTemplatePassKind)
    ? (passKindRaw as Pro2PromptTemplatePassKind)
    : undefined;
  const enabled =
    enabledRaw === "true" ? true : enabledRaw === "false" ? false : undefined;
  try {
    const templates = await listPro2PromptTemplates({ registry, passKind, enabled });
    return NextResponse.json({ templates }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

/** POST · 管理员 · 新建 Pro2 提示词模板 */
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
    const registry = body.registry as Pro2PromptTemplateRegistry;
    const passKind = body.passKind as Pro2PromptTemplatePassKind;
    const templateKey = String(body.templateKey ?? "").trim();
    const name = String(body.name ?? "").trim();
    if (!registry || !passKind || !templateKey || !name) {
      return NextResponse.json(
        { error: "INVALID_INPUT" },
        { status: 400, headers: jsonHeaders(request) },
      );
    }
    const template = await createPro2PromptTemplate({
      registry,
      passKind,
      templateKey,
      name,
      description: body.description != null ? String(body.description) : null,
      version: body.version != null ? String(body.version) : "1",
      enabled: body.enabled !== false,
      blocks: Array.isArray(body.blocks) ? (body.blocks as Pro2PromptBlock[]) : [],
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    });
    return NextResponse.json({ template }, { headers: jsonHeaders(request) });
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
