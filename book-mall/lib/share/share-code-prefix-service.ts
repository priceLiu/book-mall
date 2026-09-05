import type { ShareRewardChannel, WorkflowShareApp } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ShareCodePrefixRow = {
  id: string;
  prefix: string;
  kind: ShareRewardChannel;
  app: WorkflowShareApp | null;
  enabled: boolean;
  note: string;
};

const DEFAULT_PREFIXES: {
  prefix: string;
  kind: ShareRewardChannel;
  app: WorkflowShareApp | null;
  note: string;
}[] = [
  { prefix: "RK", kind: "REFERRAL", app: null, note: "邀请注册默认前缀" },
  { prefix: "CVAS", kind: "WORKFLOW", app: "CANVAS", note: "画布工作流" },
  { prefix: "ECOM", kind: "WORKFLOW", app: "ECOM", note: "电商分镜工作流" },
  { prefix: "QREP", kind: "WORKFLOW", app: "QUICK_REPLICA", note: "快速复刻工作流" },
];

export async function ensureDefaultShareCodePrefixes(): Promise<number> {
  let created = 0;
  for (const item of DEFAULT_PREFIXES) {
    const existing = await prisma.shareCodePrefix.findUnique({
      where: { prefix: item.prefix },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.shareCodePrefix.create({
      data: {
        prefix: item.prefix,
        kind: item.kind,
        app: item.app,
        note: item.note,
      },
    });
    created += 1;
  }
  return created;
}

export async function listShareCodePrefixes(): Promise<ShareCodePrefixRow[]> {
  return prisma.shareCodePrefix.findMany({
    orderBy: [{ kind: "asc" }, { prefix: "asc" }],
    select: {
      id: true,
      prefix: true,
      kind: true,
      app: true,
      enabled: true,
      note: true,
    },
  });
}

export async function findEnabledPrefixForCode(
  code: string,
): Promise<ShareCodePrefixRow | null> {
  const rows = await prisma.shareCodePrefix.findMany({
    where: { enabled: true },
    select: {
      id: true,
      prefix: true,
      kind: true,
      app: true,
      enabled: true,
      note: true,
    },
  });
  const matches = rows.filter((row) => code.startsWith(row.prefix));
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.prefix.length - a.prefix.length);
  return matches[0] ?? null;
}

export async function getEnabledReferralPrefix(): Promise<string> {
  const row = await prisma.shareCodePrefix.findFirst({
    where: { kind: "REFERRAL", enabled: true },
    orderBy: { createdAt: "asc" },
    select: { prefix: true },
  });
  if (!row) {
    await ensureDefaultShareCodePrefixes();
    const again = await prisma.shareCodePrefix.findFirst({
      where: { kind: "REFERRAL", enabled: true },
      orderBy: { createdAt: "asc" },
      select: { prefix: true },
    });
    if (!again) throw new Error("未配置邀请分享前缀");
    return again.prefix;
  }
  return row.prefix;
}

export async function getEnabledWorkflowPrefix(
  app: WorkflowShareApp,
): Promise<string> {
  const row = await prisma.shareCodePrefix.findFirst({
    where: { kind: "WORKFLOW", app, enabled: true },
    orderBy: { createdAt: "asc" },
    select: { prefix: true },
  });
  if (!row) {
    await ensureDefaultShareCodePrefixes();
    const again = await prisma.shareCodePrefix.findFirst({
      where: { kind: "WORKFLOW", app, enabled: true },
      orderBy: { createdAt: "asc" },
      select: { prefix: true },
    });
    if (!again) throw new Error(`未配置 ${app} 工作流分享前缀`);
    return again.prefix;
  }
  return row.prefix;
}
