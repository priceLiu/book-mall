/**
 * 我的 AI 空间 · 阿里云（DashScope / 百炼）Gateway 鉴权
 *
 * S2V / 形象检测须优先使用华北2（北京）业务空间凭证；CosyVoice TTS 仍走 BAILIAN 分支。
 */

import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";
import {
  resolveDashscopeApiRoot,
} from "@/lib/gateway/dashscope-client";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { prisma } from "@/lib/prisma";

export const AI_SPACE_S2V_BEIJING_CREDENTIAL_ALIAS = "DashScope 北京 S2V";

/** sk-ws- 开头的华北2业务空间 Key（wan2.2-s2v / detect 须用 sk-ws，API 根域名仍走 dashscope.aliyuncs.com） */
export function isDashscopeWorkspaceApiKey(apiKey: string): boolean {
  return apiKey.trim().startsWith("sk-ws-");
}

/**
 * 解析 wan2.2-s2v / detect 应使用的 API 根域名。
 *
 * sk-ws 业务空间 Key 仍走 DashScope **通用根域名** `https://dashscope.aliyuncs.com`；
 * 若误用 `{WorkspaceId}.cn-beijing.maas.aliyuncs.com`，厂商会立刻返回
 * `BadRequest.IllegalEndpoint / Workspace endpoint is invalid`（2026-08 实测）。
 *
 * 凭证里若存了华北2子域或 compatible-mode 路径，一律归一化为通用根域名。
 */
export function resolveAiSpaceS2vBaseUrl(
  _apiKey: string,
  storedBaseUrl?: string | null,
): string {
  const stored = storedBaseUrl?.trim();
  if (
    stored &&
    !/cn-beijing\.maas\.aliyuncs\.com/i.test(stored) &&
    !/dashscope\.aliyuncs\.com/i.test(stored)
  ) {
    return resolveDashscopeApiRoot(stored);
  }
  return resolveDashscopeApiRoot(null);
}

function isBeijingS2vCredential(row: {
  alias: string;
  baseUrl: string | null;
}): boolean {
  if (/cn-beijing\.maas\.aliyuncs\.com/i.test(row.baseUrl ?? "")) return true;
  if (row.alias.trim() === AI_SPACE_S2V_BEIJING_CREDENTIAL_ALIAS) return true;
  return /北京.*s2v|s2v.*北京/i.test(row.alias);
}

/** 在已绑定的 sk-gw 凭证中优先选用华北2 S2V 专用 Key */
export async function pickAiSpaceS2vCredentialId(
  auth: ResolvedGatewayApiKeyAuth,
): Promise<string | null> {
  const boundIds = auth.credentials.map((c) => c.id);
  if (boundIds.length === 0) return null;

  const rows = await prisma.gatewayVendorCredential.findMany({
    where: { id: { in: boundIds }, active: true },
    select: {
      id: true,
      alias: true,
      baseUrl: true,
      providerKind: true,
      isDefaultForProvider: true,
      sortOrder: true,
    },
  });

  const beijing = rows.filter(isBeijingS2vCredential);
  if (beijing.length > 0) {
    beijing.sort((a, b) => {
      const da = a.isDefaultForProvider ? 0 : 1;
      const db = b.isDefaultForProvider ? 0 : 1;
      if (da !== db) return da - db;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
    return beijing[0]!.id;
  }

  return (
    pickCredentialForKind(auth.credentials, "DASHSCOPE") ??
    pickCredentialForKind(auth.credentials, "BAILIAN")
  );
}

export async function requireAiSpaceDashscopeAuth(userId: string) {
  await assertGatewayApiKeyLinkedForUser(userId);
  const auth = await resolveGatewayAuthForBookUser(userId);
  if (!auth) {
    throw new GatewayRequiredError("请先在个人中心关联 Gateway API Key");
  }
  const credentialId = await pickAiSpaceS2vCredentialId(auth);
  if (!credentialId) {
    throw new GatewayRequiredError(
      "Gateway Key 未绑定阿里云（百炼 / DashScope）凭证，请在 Gateway 模型管理页绑定后重试",
    );
  }
  return { auth, credentialId };
}
