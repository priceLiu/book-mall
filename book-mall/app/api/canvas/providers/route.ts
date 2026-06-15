import { type NextRequest, NextResponse } from "next/server";
import {
  canvasErrorToResponse,
  corsOptionsResponse,
  jsonHeaders,
  requireSessionUser,
} from "@/lib/canvas/api-helpers";
import { getGatewayLinkStatusForUser } from "@/lib/canvas/book-gateway-link";
import { listCanvasProvidersForUser } from "@/lib/canvas/canvas-gateway-providers";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";

export async function OPTIONS(request: NextRequest) {
  return corsOptionsResponse(request);
}

/** 仅返回 Gateway 虚拟 Provider；Canvas 自建 Provider 已下线 */
export async function GET(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  try {
    const gatewayProviders = await listCanvasProvidersForUser(guard.user.id);
    const gatewayLink = await getGatewayLinkStatusForUser(guard.user.id);
    return NextResponse.json(
      { providers: gatewayProviders, gatewayLink },
      { headers: jsonHeaders(request) },
    );
  } catch (err) {
    return canvasErrorToResponse(request, err);
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireSessionUser(request);
  if (!guard.ok) return guard.response;
  return canvasErrorToResponse(
    request,
    new CanvasProjectError(
      "GATEWAY_KEY_REQUIRED",
      "Canvas 自建 Provider 已下线。请在 Gateway 控制台绑定厂商凭证，并在 Book 个人中心关联 sk-gw",
      403,
    ),
  );
}
