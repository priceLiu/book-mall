/**
 * Book 用户 ↔ Gateway sk-gw 关联（Canvas / Story / 工具站共用）
 */

import type { GatewayProviderKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  maskGatewayApiKey,
  resolveGatewayApiKeyById,
  resolveGatewayApiKeyFromBearer,
} from "@/lib/gateway/api-key-service";
import { findGatewayUserByBookUserId } from "@/lib/gateway/sync-user";

export type GatewayErrorCode =
  | "GATEWAY_KEY_REQUIRED"
  | "INVALID_INPUT"
  | "FORBIDDEN"
  | "UPSTREAM_ERROR";

export class GatewayRequiredError extends Error {
  constructor(
    message: string,
    public code: GatewayErrorCode = "GATEWAY_KEY_REQUIRED",
    public httpStatus = 403,
  ) {
    super(message);
    this.name = "GatewayRequiredError";
  }
}

export function summarizeUpstreamFailMessage(raw: string, status: number): string {
  const t = raw.trim();
  if (!t) return `上游服务返回 HTTP ${status}`;
  try {
    const j = JSON.parse(t) as {
      error?: { message?: string; code?: string };
      message?: string;
    };
    const msg = j.error?.message ?? j.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch {
    /* plain text */
  }
  return t.length > 500 ? `${t.slice(0, 500)}…` : t;
}

export type GatewayLinkStatusDto = {
  linked: boolean;
  gatewayApiKeyId: string | null;
  keyPrefix: string | null;
  keyName: string | null;
  linkedAt: string | null;
  boundKinds: GatewayProviderKind[];
  revoked: boolean;
};

export async function getGatewayLinkStatusForUser(
  userId: string,
): Promise<GatewayLinkStatusDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      gatewayApiKeyId: true,
      gatewayApiKeyLinkedAt: true,
      linkedGatewayApiKey: {
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          revokedAt: true,
        },
      },
    },
  });

  const key = user?.linkedGatewayApiKey;
  const linked = Boolean(user?.gatewayApiKeyId && key && !key.revokedAt);
  let boundKinds: GatewayProviderKind[] = [];
  if (linked && user?.gatewayApiKeyId) {
    const auth = await resolveGatewayApiKeyById(user.gatewayApiKeyId);
    boundKinds = [
      ...new Set(auth?.credentials.map((c) => c.providerKind) ?? []),
    ];
  }

  return {
    linked,
    gatewayApiKeyId: user?.gatewayApiKeyId ?? null,
    keyPrefix: key ? maskGatewayApiKey(key.keyPrefix) : null,
    keyName: key?.name ?? null,
    linkedAt: user?.gatewayApiKeyLinkedAt?.toISOString() ?? null,
    boundKinds,
    revoked: Boolean(key?.revokedAt),
  };
}

export async function linkGatewayApiKeyForUser(
  userId: string,
  rawSkGw: string,
): Promise<GatewayLinkStatusDto> {
  const trimmed = rawSkGw.trim();
  if (!trimmed.startsWith("sk-gw-")) {
    throw new GatewayRequiredError("请输入有效的 sk-gw-... 密钥", "INVALID_INPUT", 400);
  }

  const auth = await resolveGatewayApiKeyFromBearer(`Bearer ${trimmed}`);
  if (!auth) {
    throw new GatewayRequiredError(
      "Gateway API Key 无效或已吊销",
      "INVALID_INPUT",
      400,
    );
  }

  const gwUser = await findGatewayUserByBookUserId(userId);
  if (!gwUser || gwUser.id !== auth.userId) {
    throw new GatewayRequiredError(
      "该 Gateway Key 不属于当前 Book 账号，请使用同一邮箱在 Gateway 创建的密钥",
      "FORBIDDEN",
      403,
    );
  }

  if (auth.credentials.length === 0) {
    throw new GatewayRequiredError(
      "该 Gateway Key 未绑定任何厂商凭证，请先在 Gateway 控制台绑定厂商 API Key",
      "INVALID_INPUT",
      400,
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      gatewayApiKeyId: auth.id,
      gatewayApiKeyLinkedAt: new Date(),
    },
  });

  return getGatewayLinkStatusForUser(userId);
}

export async function unlinkGatewayApiKeyForUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      gatewayApiKeyId: null,
      gatewayApiKeyLinkedAt: null,
    },
  });
}

export async function resolveGatewayAuthForBookUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gatewayApiKeyId: true },
  });
  if (!user?.gatewayApiKeyId) return null;
  return resolveGatewayApiKeyById(user.gatewayApiKeyId);
}

/** 须关联 Gateway Key；ADMIN 亦须关联（生产路径） */
export async function assertGatewayApiKeyLinkedForUser(
  userId: string,
  _opts?: { role?: string | null },
): Promise<void> {
  const status = await getGatewayLinkStatusForUser(userId);
  if (status.linked) return;
  if (status.revoked && status.gatewayApiKeyId) {
    throw new GatewayRequiredError(
      "Gateway API Key 已吊销，请在 Book 个人中心重新关联，或在 Gateway 控制台创建新密钥",
    );
  }
  throw new GatewayRequiredError(
    "请先在 Gateway 控制台绑定厂商凭证并创建 sk-gw-...，再在 Book 个人中心关联 Gateway API Key",
  );
}
