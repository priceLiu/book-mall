import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  getActivePro2TemplatesSnapshot,
  resolveActivePro2TemplatePack,
} from "@/lib/canvas/pro2-prompt-template-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** GET · 登录用户 · 启用的 Pro2 模板快照（Hub/Dock 运行时） */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  const packKey = request.nextUrl.searchParams.get("packKey")?.trim();
  try {
    const snapshot = await getActivePro2TemplatesSnapshot();
    const pack = packKey
      ? await resolveActivePro2TemplatePack(packKey)
      : await resolveActivePro2TemplatePack("default-master");
    return NextResponse.json(
      { snapshot, pack },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
