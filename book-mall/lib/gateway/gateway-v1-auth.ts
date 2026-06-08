import {
  resolveGatewayApiKeyById,
  resolveGatewayApiKeyFromBearer,
  type ResolvedGatewayApiKeyAuth,
} from "@/lib/gateway/api-key-service";

const INTERNAL_PREFIX = "gateway-internal ";

function getGatewayInternalInvokeSecret(): string | null {
  const s =
    process.env.GATEWAY_INTERNAL_INVOKE_SECRET?.trim() ||
    process.env.GATEWAY_SSO_SERVER_SECRET?.trim() ||
    process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

/**
 * 解析 Gateway API 鉴权：
 * - Bearer sk-gw-...（外部 / gateway-web 代理）
 * - Gateway-Internal {secret}:{apiKeyId}（book-mall 服务端经关联 Key 调 /api/gw/v1）
 */
export async function resolveGatewayApiKeyFromAuthorization(
  authorization: string | null,
): Promise<ResolvedGatewayApiKeyAuth | null> {
  if (!authorization?.trim()) return null;

  const lower = authorization.toLowerCase();
  if (lower.startsWith(INTERNAL_PREFIX)) {
    const payload = authorization.slice(INTERNAL_PREFIX.length).trim();
    const colon = payload.indexOf(":");
    if (colon <= 0) return null;
    const secret = payload.slice(0, colon);
    const apiKeyId = payload.slice(colon + 1).trim();
    const expected = getGatewayInternalInvokeSecret();
    if (!expected || secret !== expected || !apiKeyId) return null;
    return resolveGatewayApiKeyById(apiKeyId);
  }

  return resolveGatewayApiKeyFromBearer(authorization);
}

export function buildGatewayInternalAuthorization(apiKeyId: string): string {
  const secret = getGatewayInternalInvokeSecret();
  if (!secret) {
    throw new Error(
      "GATEWAY_INTERNAL_INVOKE_SECRET 未配置（可与 GATEWAY_SSO_SERVER_SECRET 共用）",
    );
  }
  return `Gateway-Internal ${secret}:${apiKeyId}`;
}
