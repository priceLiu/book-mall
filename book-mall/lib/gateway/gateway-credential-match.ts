import type { GatewayProviderKind } from "@prisma/client";

/**
 * 百炼 OpenAI 兼容（BAILIAN）与 DashScope 原生异步 API（DASHSCOPE）共用同一阿里云 API Key。
 * 用户仅在 Gateway 添加「百炼」凭证时，亦应能使用万相生图 / 视频等 DASHSCOPE 路由模型。
 */
export function gatewayCredentialSubstitutes(
  kind: GatewayProviderKind,
): GatewayProviderKind[] {
  if (kind === "BAILIAN" || kind === "DASHSCOPE") {
    return ["DASHSCOPE", "BAILIAN"];
  }
  return [kind];
}

export function isGatewayProviderBound(
  boundKinds: Iterable<GatewayProviderKind>,
  required: GatewayProviderKind,
): boolean {
  const bound = new Set(boundKinds);
  return gatewayCredentialSubstitutes(required).some((k) => bound.has(k));
}

export function pickCredentialIdForProvider(
  credentials: { id: string; providerKind: GatewayProviderKind }[],
  required: GatewayProviderKind,
): string | null {
  for (const kind of gatewayCredentialSubstitutes(required)) {
    const hit = credentials.find((c) => c.providerKind === kind);
    if (hit) return hit.id;
  }
  return null;
}
