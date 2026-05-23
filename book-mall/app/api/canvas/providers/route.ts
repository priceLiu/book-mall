import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  readJsonBody,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import {
  createProviderForUser,
  listProvidersForUser,
} from "@/lib/canvas/canvas-provider-service";
import { listSystemProviderDtos } from "@/lib/canvas/canvas-system-provider";
import type { CanvasProviderKind } from "@prisma/client";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const userProviders = await listProvidersForUser(guard.user.id);
    // 系统 Provider 排在最前（用户更易发现 / 默认就有 KIE 多模态可用）
    const providers = [...listSystemProviderDtos(), ...userProviders];
    return NextResponse.json({ providers }, { headers: jsonHeaders(request) });
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
    const provider = await createProviderForUser(guard.user.id, {
      alias: String(body.body.alias ?? ""),
      kind: String(body.body.kind ?? "") as CanvasProviderKind,
      apiKey: String(body.body.apiKey ?? ""),
      baseUrl:
        body.body.baseUrl === null
          ? null
          : body.body.baseUrl
            ? String(body.body.baseUrl)
            : undefined,
    });
    return NextResponse.json(
      { provider },
      { status: 201, headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}
