import type { Prisma } from "@prisma/client";

import { maskApiKey } from "@/lib/canvas/secret";
import { prisma } from "@/lib/prisma";

function displayLogModelKey(log: {
  model: string;
  canonicalModelKey: string | null;
}): string {
  const canonical = log.canonicalModelKey?.trim();
  return canonical || log.model;
}

export type GatewayLogListFacets = {
  models: string[];
  providerKinds: string[];
  credentialKeys: { id: string; masked: string }[];
};

/** 筛选项下拉：在 scope + 日期/状态/应用/厂商 下采样，不含 model / credential 自身筛选 */
export async function resolveGatewayLogListFacets(
  facetWhere: Prisma.GatewayRequestLogWhereInput,
  providerKind?: string,
): Promise<GatewayLogListFacets> {
  const where: Prisma.GatewayRequestLogWhereInput = providerKind
    ? {
        AND: [
          facetWhere,
          {
            providerKind:
              providerKind as Prisma.EnumGatewayProviderKindFilter,
          },
        ],
      }
    : facetWhere;

  const [modelRows, credentialRows, providerRows] = await Promise.all([
    prisma.gatewayRequestLog.findMany({
      where,
      select: { model: true, canonicalModelKey: true },
      orderBy: { submittedAt: "desc" },
      take: 400,
    }),
    prisma.gatewayRequestLog.findMany({
      where,
      select: { credentialId: true },
      distinct: ["credentialId"],
      take: 50,
    }),
    prisma.gatewayRequestLog.groupBy({
      by: ["providerKind"],
      where,
      _count: { _all: true },
    }),
  ]);

  const models = new Set<string>();
  for (const row of modelRows) {
    const key = displayLogModelKey(row).trim();
    if (key) models.add(key);
  }

  const credentialIds = [
    ...new Set(
      credentialRows
        .map((r) => r.credentialId)
        .filter((id): id is string => !!id),
    ),
  ];
  const credentials =
    credentialIds.length > 0
      ? await prisma.gatewayVendorCredential.findMany({
          where: { id: { in: credentialIds } },
          select: { id: true, apiKeyEncrypted: true },
        })
      : [];

  return {
    models: [...models].sort((a, b) => a.localeCompare(b)),
    providerKinds: providerRows
      .map((r) => r.providerKind)
      .filter((k) => k != null)
      .map((k) => k as string),
    credentialKeys: credentials
      .map((c) => ({ id: c.id, masked: maskApiKey(c.apiKeyEncrypted) }))
      .sort((a, b) => a.masked.localeCompare(b.masked)),
  };
}
