import { createHash, randomBytes } from "crypto";
import type { GatewayApiKey, GatewayProviderKind, GatewayUser } from "@prisma/client";
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

export async function createGatewayApiKey(opts: {
  userId: string;
  name: string;
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
): Promise<
  | (GatewayApiKey & {
      user: GatewayUser;
      credentials: { id: string; providerKind: GatewayProviderKind; alias: string }[];
    })
  | null
> {
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const raw = authorization.slice(7).trim();
  if (!raw.startsWith(KEY_PREFIX)) return null;
  const prefix = raw.slice(0, KEY_PREFIX.length + 8);
  const hash = hashKey(raw);
  return prisma.gatewayApiKey.findFirst({
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
            select: {
              id: true,
              providerKind: true,
              alias: true,
              active: true,
            },
          },
        },
      },
    },
  }).then((row) => {
    if (!row) return null;
    return {
      ...row,
      credentials: row.bindings
        .map((b) => b.credential)
        .filter((c) => c.active),
    };
  });
}

export function maskGatewayApiKey(prefix: string): string {
  return `${prefix}****`;
}

export type ResolvedGatewayApiKeyAuth = GatewayApiKey & {
  user: GatewayUser;
  credentials: { id: string; providerKind: GatewayProviderKind; alias: string }[];
};

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
            select: {
              id: true,
              providerKind: true,
              alias: true,
              active: true,
            },
          },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    credentials: row.bindings
      .map((b) => b.credential)
      .filter((c) => c.active),
  };
}
