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

export interface RoutableCredential {
  id: string;
  providerKind: GatewayProviderKind;
  alias?: string;
  channel?: string | null;
  sortOrder?: number;
  isDefaultForProvider?: boolean;
}

/**
 * 多 Key 路由（gateway-multi-credential · 轨道 A）：
 * 同一厂商存在多条凭证时，按优先级选用：
 *   1. 显式指定的 preferredCredentialId（须命中且 providerKind 可代）
 *   2. isDefaultForProvider = true（每厂商默认凭证）
 *   3. sortOrder 升序最小
 *   4. 兜底：绑定列表第一条
 */
export function pickCredentialIdForProvider(
  credentials: RoutableCredential[],
  required: GatewayProviderKind,
  preferredCredentialId?: string | null,
): string | null {
  const kinds = gatewayCredentialSubstitutes(required);
  const matches = credentials.filter((c) => kinds.includes(c.providerKind));
  if (matches.length === 0) return null;

  if (preferredCredentialId) {
    const explicit = matches.find((c) => c.id === preferredCredentialId);
    if (explicit) return explicit.id;
  }

  const byKindOrder = (c: RoutableCredential) => {
    const idx = kinds.indexOf(c.providerKind);
    return idx < 0 ? kinds.length : idx;
  };
  const sorted = [...matches].sort((a, b) => {
    // 默认凭证优先
    const da = a.isDefaultForProvider ? 0 : 1;
    const db = b.isDefaultForProvider ? 0 : 1;
    if (da !== db) return da - db;
    // 同厂商替代顺序（required 优先于 substitute）
    const ka = byKindOrder(a);
    const kb = byKindOrder(b);
    if (ka !== kb) return ka - kb;
    // sortOrder 升序
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
  return sorted[0]?.id ?? null;
}
