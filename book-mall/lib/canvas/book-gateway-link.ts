/** Canvas 兼容层 → @/lib/gateway/book-gateway-link */
export {
  getGatewayLinkStatusForUser,
  unlinkGatewayApiKeyForUser,
  resolveGatewayAuthForBookUser,
  type GatewayLinkStatusDto,
} from "@/lib/gateway/book-gateway-link";

import { CanvasProjectError } from "./canvas-project-service";
import {
  assertGatewayApiKeyLinkedForUser as assertGw,
  GatewayRequiredError,
  linkGatewayApiKeyForUser as linkGw,
} from "@/lib/gateway/book-gateway-link";

function mapGatewayError(e: GatewayRequiredError): CanvasProjectError {
  const code =
    e.code === "INVALID_INPUT"
      ? "INVALID_INPUT"
      : e.code === "FORBIDDEN"
        ? "FORBIDDEN"
        : "GATEWAY_KEY_REQUIRED";
  return new CanvasProjectError(code, e.message, e.httpStatus);
}

export async function assertGatewayApiKeyLinkedForUser(
  userId: string,
  opts?: { role?: string | null },
): Promise<void> {
  try {
    await assertGw(userId, opts);
  } catch (e) {
    if (e instanceof GatewayRequiredError) throw mapGatewayError(e);
    throw e;
  }
}

export async function linkGatewayApiKeyForUser(userId: string, rawSkGw: string) {
  try {
    return await linkGw(userId, rawSkGw);
  } catch (e) {
    if (e instanceof GatewayRequiredError) throw mapGatewayError(e);
    throw e;
  }
}
