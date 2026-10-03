import type { Prisma } from "@prisma/client";

import {
  ECOM_IP_MASTER_LIBRARY_MODULE,
  type IpMasterTemplateVersion,
} from "@/lib/ecom/ecom-ip-master-types";
import { prisma } from "@/lib/prisma";

export async function persistIpMasterLibraryAsset(opts: {
  userId: string;
  projectId: string;
  entry: IpMasterTemplateVersion;
  benchmarkUrl: string;
  imagePromptPositive?: string;
}): Promise<void> {
  const benchmarkUrl = opts.benchmarkUrl.trim();
  if (!benchmarkUrl) return;

  const metaBase = {
    projectId: opts.projectId,
    templateVersion: opts.entry.version,
    label: opts.entry.label,
    savedAt: opts.entry.createdAt,
    source: "ip-master-template",
  } satisfies Record<string, unknown>;

  const rows = await prisma.ecomAsset.findMany({
    where: { userId: opts.userId, module: ECOM_IP_MASTER_LIBRARY_MODULE },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, meta: true },
  });

  const existing = rows.find((row) => {
    const m = (row.meta as Record<string, unknown> | null) ?? {};
    return m.projectId === opts.projectId && m.templateVersion === opts.entry.version;
  });

  const data = {
    module: ECOM_IP_MASTER_LIBRARY_MODULE,
    kind: "image",
    title: (opts.entry.label?.trim() || opts.entry.version).slice(0, 120),
    prompt: opts.imagePromptPositive?.trim()?.slice(0, 4000) || null,
    ossUrl: benchmarkUrl,
    thumbnailUrl: benchmarkUrl,
    meta: metaBase as Prisma.InputJsonValue,
  };

  if (existing) {
    await prisma.ecomAsset.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await prisma.ecomAsset.create({
    data: {
      userId: opts.userId,
      ...data,
    },
  });
}
