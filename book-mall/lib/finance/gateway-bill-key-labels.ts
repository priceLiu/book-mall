import { maskApiKey } from "@/lib/canvas/secret";
import { maskGatewayApiKey } from "@/lib/gateway/api-key-service";
import { prisma } from "@/lib/prisma";

export type GatewayLogKeyLabelInput = {
  apiKeyId: string;
  credentialId: string | null;
  credentialAliasSnapshot: string | null;
};

export type GatewayLogKeyLabels = {
  gatewayKey: string;
  userKey: string;
};

const EMPTY = "--";

export type GatewayLogKeyLabelInput = {
  apiKeyId: string;
  credentialId: string | null;
  credentialAliasSnapshot: string | null;
};

export type GatewayLogKeyLabels = {
  gatewayKey: string;
  userKey: string;
};

function formatGatewayKeyLabel(
  row: { name: string; keyPrefix: string } | undefined,
): string {
  if (!row) return EMPTY;
  const masked = maskGatewayApiKey(row.keyPrefix);
  const name = row.name.trim();
  return name ? `${name} · ${masked}` : masked;
}

function formatUserKeyLabel(
  cred:
    | {
        alias: string;
        apiKeyEncrypted: string;
        ownerScope: string;
      }
    | undefined,
  aliasSnapshot: string | null,
): string {
  if (!cred) return EMPTY;
  if (cred.ownerScope === "TENANT") {
    // 团队凭证仍展示脱敏 Key
  }
  const masked = maskApiKey(cred.apiKeyEncrypted);
  const alias = (aliasSnapshot ?? cred.alias).trim();
  return alias ? `${alias} · ${masked}` : masked;
}

/** 批量解析 Gateway / 厂商 User Key 展示文案（脱敏）。 */
export async function loadGatewayLogKeyLabels(
  logs: GatewayLogKeyLabelInput[],
): Promise<Map<string, GatewayLogKeyLabels>> {
  const apiKeyIds = [...new Set(logs.map((l) => l.apiKeyId))];
  const credentialIds = [
    ...new Set(logs.map((l) => l.credentialId).filter((id): id is string => !!id)),
  ];

  const [apiKeys, credentials] = await Promise.all([
    apiKeyIds.length
      ? prisma.gatewayApiKey.findMany({
          where: { id: { in: apiKeyIds } },
          select: { id: true, name: true, keyPrefix: true, managedByPlatform: true },
        })
      : Promise.resolve([]),
    credentialIds.length
      ? prisma.gatewayVendorCredential.findMany({
          where: { id: { in: credentialIds } },
          select: {
            id: true,
            alias: true,
            apiKeyEncrypted: true,
            ownerScope: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const apiKeyById = new Map(apiKeys.map((k) => [k.id, k]));
  const credById = new Map(credentials.map((c) => [c.id, c]));

  const out = new Map<string, GatewayLogKeyLabels>();
  for (const log of logs) {
    const apiKey = apiKeyById.get(log.apiKeyId);
    const cred = log.credentialId ? credById.get(log.credentialId) : undefined;
    out.set(`${log.apiKeyId}:${log.credentialId ?? ""}`, {
      gatewayKey: formatGatewayKeyLabel(apiKey),
      userKey:
        apiKey?.managedByPlatform && !cred
          ? EMPTY
          : formatUserKeyLabel(cred, log.credentialAliasSnapshot),
    });
  }
  return out;
}

export function pickGatewayLogKeyLabels(
  map: Map<string, GatewayLogKeyLabels>,
  log: GatewayLogKeyLabelInput,
): GatewayLogKeyLabels {
  return (
    map.get(`${log.apiKeyId}:${log.credentialId ?? ""}`) ?? {
      gatewayKey: EMPTY,
      userKey: EMPTY,
    }
  );
}
