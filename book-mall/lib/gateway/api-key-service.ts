import { createHash, randomBytes } from "crypto";
import type {
  GatewayApiKey,
  GatewayApiKeyScope,
  GatewayProviderKind,
  GatewayUser,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const KEY_PREFIX = "sk-gw-";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateGatewayApiKeyMaterial(): {
  raw: string;
  prefix: string;
  hash: string;
} {
  const secret = randomBytes(24).toString("hex");
  const raw = `${KEY_PREFIX}${secret}`;
  const prefix = raw.slice(0, KEY_PREFIX.length + 8);
  return { raw, prefix, hash: hashKey(raw) };
}

/**
 * PERSONAL sk-gw 创建时会绑定当时全部 active 凭证；之后新增的厂商凭证需同步到已有 Key。
 * PLATFORM 密钥保持显式绑定，不参与自动同步。
 */
export async function syncPersonalGatewayApiKeyBindings(
  gatewayUserId: string,
): Promise<void> {
  const [activeCreds, personalKeys] = await Promise.all([
    prisma.gatewayVendorCredential.findMany({
      where: { userId: gatewayUserId, active: true },
      select: { id: true },
    }),
    prisma.gatewayApiKey.findMany({
      where: { userId: gatewayUserId, scope: "PERSONAL", revokedAt: null },
      select: { id: true },
    }),
  ]);
  if (personalKeys.length === 0) return;

  const activeIds = activeCreds.map((c) => c.id);
  await prisma.$transaction(async (tx) => {
    for (const key of personalKeys) {
      await tx.gatewayApiKeyCredential.deleteMany({ where: { apiKeyId: key.id } });
      if (activeIds.length > 0) {
        await tx.gatewayApiKeyCredential.createMany({
          data: activeIds.map((credentialId) => ({
            apiKeyId: key.id,
            credentialId,
          })),
          skipDuplicates: true,
        });
      }
    }
  });
}

async function personalBindingsNeedSync(
  gatewayUserId: string,
  apiKeyId: string,
): Promise<boolean> {
  const [activeCreds, boundCreds] = await Promise.all([
    prisma.gatewayVendorCredential.findMany({
      where: { userId: gatewayUserId, active: true },
      select: { id: true },
      orderBy: { id: "asc" },
    }),
    prisma.gatewayApiKeyCredential.findMany({
      where: { apiKeyId, credential: { active: true } },
      select: { credentialId: true },
      orderBy: { credentialId: "asc" },
    }),
  ]);
  const activeIds = activeCreds.map((c) => c.id).join(",");
  const boundIds = boundCreds.map((b) => b.credentialId).join(",");
  return activeIds !== boundIds;
}

async function ensurePersonalApiKeyBindingsSynced(
  apiKeyId: string,
  scope: GatewayApiKeyScope,
  gatewayUserId: string,
): Promise<void> {
  if (scope !== "PERSONAL") return;
  if (!(await personalBindingsNeedSync(gatewayUserId, apiKeyId))) return;
  await syncPersonalGatewayApiKeyBindings(gatewayUserId);
}

export type ResolvedCredential = {
  id: string;
  providerKind: GatewayProviderKind;
  alias: string;
  channel: string | null;
  sortOrder: number;
  isDefaultForProvider: boolean;
};

export type ResolvedGatewayApiKeyAuth = GatewayApiKey & {
  user: GatewayUser;
  credentials: ResolvedCredential[];
};

/** 解析凭证时统一 select（含多 Key 路由字段）。 */
const CREDENTIAL_SELECT = {
  id: true,
  providerKind: true,
  alias: true,
  channel: true,
  sortOrder: true,
  isDefaultForProvider: true,
  active: true,
} as const;

function mapResolvedGatewayApiKeyAuth(
  row: GatewayApiKey & {
    user: GatewayUser;
    bindings: {
      credential: {
        id: string;
        providerKind: GatewayProviderKind;
        alias: string;
        channel: string | null;
        sortOrder: number;
        isDefaultForProvider: boolean;
        active: boolean;
      };
    }[];
  },
): ResolvedGatewayApiKeyAuth {
  return {
    ...row,
    credentials: row.bindings
      .map((b) => b.credential)
      .filter((c) => c.active)
      .map((c) => ({
        id: c.id,
        providerKind: c.providerKind,
        alias: c.alias,
        channel: c.channel,
        sortOrder: c.sortOrder,
        isDefaultForProvider: c.isDefaultForProvider,
      })),
  };
}

export async function createGatewayApiKey(opts: {
  userId: string;
  name: string;
  scope?: GatewayApiKeyScope;
  credentialIds?: string[];
  ipWhitelist?: string[];
  spendLimitUsd?: number | null;
}): Promise<{ apiKey: GatewayApiKey; rawKey: string }> {
  const { raw, prefix, hash } = generateGatewayApiKeyMaterial();
  const apiKey = await prisma.$transaction(async (tx) => {
    const row = await tx.gatewayApiKey.create({
      data: {
        userId: opts.userId,
        name: opts.name.trim() || "默认",
        scope: opts.scope ?? "PERSONAL",
        keyPrefix: prefix,
        keyHash: hash,
        ipWhitelist: opts.ipWhitelist?.length ? opts.ipWhitelist : undefined,
        spendLimitUsd: opts.spendLimitUsd ?? undefined,
      },
    });
    const credIds = opts.credentialIds ?? [];
    if (credIds.length > 0) {
      await tx.gatewayApiKeyCredential.createMany({
        data: credIds.map((credentialId) => ({
          apiKeyId: row.id,
          credentialId,
        })),
        skipDuplicates: true,
      });
    } else {
      const all = await tx.gatewayVendorCredential.findMany({
        where: { userId: opts.userId, active: true },
        select: { id: true },
      });
      if (all.length > 0) {
        await tx.gatewayApiKeyCredential.createMany({
          data: all.map((c) => ({ apiKeyId: row.id, credentialId: c.id })),
          skipDuplicates: true,
        });
      }
    }
    return row;
  });
  return { apiKey, rawKey: raw };
}

export async function resolveGatewayApiKeyFromBearer(
  authorization: string | null,
): Promise<ResolvedGatewayApiKeyAuth | null> {
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const raw = authorization.slice(7).trim();
  if (!raw.startsWith(KEY_PREFIX)) return null;
  const prefix = raw.slice(0, KEY_PREFIX.length + 8);
  const hash = hashKey(raw);
  const row = await prisma.gatewayApiKey.findFirst({
    where: {
      keyPrefix: prefix,
      keyHash: hash,
      revokedAt: null,
    },
    include: {
      user: true,
      bindings: {
        include: {
          credential: {
            select: CREDENTIAL_SELECT,
          },
        },
      },
    },
  });
  if (!row) return null;
  await ensurePersonalApiKeyBindingsSynced(row.id, row.scope, row.userId);
  if (row.scope === "PERSONAL") {
    const refreshed = await prisma.gatewayApiKey.findFirst({
      where: { id: row.id },
      include: {
        user: true,
        bindings: {
          include: {
            credential: {
              select: CREDENTIAL_SELECT,
            },
          },
        },
      },
    });
    if (!refreshed) return null;
    return mapResolvedGatewayApiKeyAuth(refreshed);
  }
  return mapResolvedGatewayApiKeyAuth(row);
}

export function maskGatewayApiKey(prefix: string): string {
  return `${prefix}****`;
}

/** 服务端 Canvas 用：按 GatewayApiKey id 解析（等同 sk-gw 鉴权结果） */
export async function resolveGatewayApiKeyById(
  apiKeyId: string,
): Promise<ResolvedGatewayApiKeyAuth | null> {
  const row = await prisma.gatewayApiKey.findFirst({
    where: { id: apiKeyId, revokedAt: null },
    include: {
      user: true,
      bindings: {
        include: {
          credential: {
            select: CREDENTIAL_SELECT,
          },
        },
      },
    },
  });
  if (!row) return null;
  await ensurePersonalApiKeyBindingsSynced(row.id, row.scope, row.userId);
  if (row.scope === "PERSONAL") {
    const refreshed = await prisma.gatewayApiKey.findFirst({
      where: { id: row.id },
      include: {
        user: true,
        bindings: {
          include: {
            credential: {
              select: CREDENTIAL_SELECT,
            },
          },
        },
      },
    });
    if (!refreshed) return null;
    return mapResolvedGatewayApiKeyAuth(refreshed);
  }
  return mapResolvedGatewayApiKeyAuth(row);
}
